import 'dotenv/config';
import Fastify from 'fastify';
import fastifyVite from '@fastify/vite';
import { ProxyAgent, setGlobalDispatcher } from 'undici';
import react from '@vitejs/plugin-react';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { promises as fs, createWriteStream } from 'fs';
import crypto from 'crypto';
import multipart from '@fastify/multipart';
import path from 'path';
import util from 'util';
import { pipeline } from 'stream';

const pump = util.promisify(pipeline);

// --- Setup ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Store sessions outside of editor/ to avoid dev server restarts on file writes
const SESSIONS_DIR = resolve(__dirname, '../.sessions');

// Optional HTTP(S) proxy for outgoing requests (e.g., Gemini API)
// Supported envs: HTTPS_PROXY, HTTP_PROXY, ALL_PROXY, PROXY_URL
const PROXY_URL = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.ALL_PROXY || process.env.PROXY_URL;
if (PROXY_URL) {
  try {
    setGlobalDispatcher(new ProxyAgent(PROXY_URL));
    console.info(`[editor] Using proxy: ${PROXY_URL}`);
  } catch (e) {
    console.warn('[editor] Failed to set proxy agent:', e);
  }
}

// In-memory store for session chat histories.
// In a real app, this would be a database.
const sessions = new Map<string, any[]>();

// --- Gemini AI Configuration ---
const API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";

if (!API_KEY) {
  console.error("FATAL: GEMINI_API_KEY environment variable is not set.");
  process.exit(1);
}
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({
  model: GEMINI_MODEL,
  // The system instruction is the core prompt for the AI
  systemInstruction: `You are an expert TypeScript developer specializing in Pixi.js animations. Your task is to create a new animation class based on a user's description. Follow these exact rules so the file compiles in our editor:
1) Imports:
   - Use: \`import * as PIXI from 'pixi.js'\`.
   - Use: \`import { BaseAnimate } from 'pixi-animation-library'\`.
   - Do NOT import from relative core paths like '../core/BaseAnimate'.
2) Class:
   - Export a single named class that \`extends BaseAnimate\`.
   - Include: \`public static readonly animationName: string\` (PascalCase, short).
   - Include: \`public static getRequiredSpriteCount(): number\` (>= 1 if sprites are used).
   - Implement: \`public update(deltaTime: number): void\` with all animation logic.
   - Avoid custom constructors unless absolutely necessary. If you add one, the signature MUST be \`constructor(object: any, sprites: PIXI.Sprite[])\` and MUST call \`super(object, sprites)\`.
3) Runtime notes:
   - Access sprites via \`this.sprites\`.
   - The editor sets \`anchor.set(0.5)\` for each sprite and calls \`play()\` automatically.
   - Do NOT import any other libraries.
4) File output:
   - The file must export only that class.
   - After you output the code, you MUST call the \`create_animation_file\` function to save it (use the class name for the filename).

Examples of valid animations (concise):
// Example A: Single-sprite bounce scale
export class BounceScale extends BaseAnimate {
  public static readonly animationName = 'BounceScale';
  public static getRequiredSpriteCount(): number { return 1; }
  private t = 0;
  update(dt: number): void {
    this.t += dt;
    const s = 0.75 + Math.sin(this.t * Math.PI * 2) * 0.25; // 0.5..1.0
    this.sprites[0].scale.set(s);
  }
}

// Example B: Two-sprite orbit
export class TwinOrbit extends BaseAnimate {
  public static readonly animationName = 'TwinOrbit';
  public static getRequiredSpriteCount(): number { return 2; }
  private t = 0;
  update(dt: number): void {
    this.t += dt;
    const r = 50;
    this.sprites[0].x = Math.cos(this.t) * r;
    this.sprites[0].y = Math.sin(this.t) * r;
    this.sprites[1].x = Math.cos(this.t + Math.PI) * r;
    this.sprites[1].y = Math.sin(this.t + Math.PI) * r;
  }
}

Be conversational and explain briefly what you created before calling the tool.`,
});

const generationConfig = {
  temperature: 0.9,
  topK: 1,
  topP: 1,
  maxOutputTokens: 8192,
};

const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

// --- Gemini Function Calling Tool ---
const tools: any = [
  {
    functionDeclarations: [
      {
        name: 'create_animation_file',
        description: 'Creates a new TypeScript animation file with the provided code.',
        parameters: {
          type: 'OBJECT',
          properties: {
            className: { type: 'STRING', description: 'The name of the animation class, in PascalCase.' },
            code: { type: 'STRING', description: 'The full TypeScript code for the animation class.' },
          },
          required: ['className', 'code'],
        },
      },
    ],
  },
];

// --- Fastify Server ---
async function main() {
  await fs.mkdir(SESSIONS_DIR, { recursive: true });
  const server = Fastify({ logger: true });

  // Register multipart handler
  server.register(multipart);

  // --- Vite Frontend ---
  await server.register(fastifyVite, {
    // Point to the editor directory so @fastify/vite finds editor/vite.config.ts
    root: resolve(__dirname),
    dev: true,
    spa: true,
  });

  // --- API Routes ---

  // Asset Management
  server.get('/api/assets', async (request, reply) => {
    const assetsDir = resolve(__dirname, '../../assets/sprite');
    try {
      await fs.access(assetsDir);
      const files = await fs.readdir(assetsDir);
      // We only want image files, and filter out system files like .DS_Store
      const imageFiles = files.filter(file => /\.(png|jpe?g|gif)$/i.test(file));
      reply.send(imageFiles);
    } catch (error) {
      server.log.error(error, "Could not list assets in " + assetsDir);
      // If the directory doesn't exist, return an empty array
      reply.send([]);
    }
  });

  server.post('/api/upload-asset', async (request, reply) => {
    try {
      const data = await request.file();
      if (!data) {
        return reply.status(400).send({ error: 'No file uploaded.' });
      }

      // Ensure the filename is safe
      const safeFilename = path.basename(data.filename);
      const assetsDir = resolve(__dirname, '../../assets/sprite');
      await fs.mkdir(assetsDir, { recursive: true }); // Ensure directory exists

      const filePath = path.join(assetsDir, safeFilename);
      await pump(data.file, createWriteStream(filePath));

      server.log.info(`Uploaded file: ${filePath}`);
      reply.send({ success: true, filename: safeFilename, path: `/sprite/${safeFilename}` });
    } catch (error) {
      server.log.error(error, "Asset upload failed");
      reply.status(500).send({ error: 'Failed to upload asset.' });
    }
  });


  server.post('/api/chat', async (request, reply) => {
    try {
      let { history = [], prompt, sessionId } = request.body as any;

      if (!sessionId) {
        sessionId = crypto.randomUUID();
        sessions.set(sessionId, []);
      } else if (!sessions.has(sessionId)) {
        sessions.set(sessionId, []);
      }
      const chatHistory = sessions.get(sessionId)!;

      const chat = model.startChat({
        history: chatHistory,
        generationConfig,
        safetySettings,
        tools,
      });

  const result = await chat.sendMessage(prompt);
  const geminiResponse: any = result.response as any;

      let responseText = geminiResponse.text();

      // Handle function calls
      const calls: any[] = geminiResponse.functionCalls?.() ?? [];
      if (calls.length) {
        for (const call of calls) {
          if (call.name === 'create_animation_file') {
            const { className, code } = call.args || {};
            const sessionDir = resolve(SESSIONS_DIR, sessionId, 'animations');
            await fs.mkdir(sessionDir, { recursive: true });
            const filePath = resolve(sessionDir, `${className}.ts`);
            await fs.writeFile(filePath, code);

            console.log(`Animation file created: ${filePath}`);
            responseText = `I have created the animation file \`${className}.ts\`. You can now select it from the dropdown to preview it.`;
          }
        }
      }

      // Update history in our session store
  chatHistory.push({ role: 'user', parts: [{ text: prompt }] } as any);
  chatHistory.push({ role: 'model', parts: [{ text: responseText }] } as any);

      reply.send({ response: responseText, sessionId });

    } catch (error) {
      server.log.error(error, 'Error processing chat request');
      reply.status(500).send({ error: 'Failed to process chat request' });
    }
  });

  server.post('/api/clear_session', async (request, reply) => {
      const { sessionId } = request.body as any;
      if (sessionId && sessions.has(sessionId)) {
          sessions.set(sessionId, []);
          server.log.info(`Cleared session for ${sessionId}`);
      }
      return { success: true };
  });

  server.get('/api/animations/:sessionId', async(request, reply) => {
      const { sessionId } = request.params as any;
      const sessionDir = resolve(SESSIONS_DIR, sessionId, 'animations');
      const legacyDir = resolve(__dirname, 'sessions', sessionId, 'animations');
      const buildList = async (dir: string) => {
        const files = await fs.readdir(dir);
        const tsFiles = files.filter(f => f.endsWith('.ts'));
        return tsFiles.map(f => ({ name: f.replace(/\.ts$/, ''), fsPath: resolve(dir, f) }));
      };
      try {
          await fs.access(sessionDir);
          const list = await buildList(sessionDir);
          if (list.length > 0) return list;
      } catch {}
      // Fallback to legacy folder under editor/
      try {
          await fs.access(legacyDir);
          const list = await buildList(legacyDir);
          return list;
      } catch {}
      return [];
  });

  server.get('/api/animation-code/:sessionId/:animName', async (request, reply) => {
    const { sessionId, animName } = request.params as any;
    const primaryPath = resolve(SESSIONS_DIR, sessionId, 'animations', `${animName}.ts`);
    const legacyPath = resolve(__dirname, 'sessions', sessionId, 'animations', `${animName}.ts`);
    const tryRead = async (p: string) => {
      await fs.access(p);
      return await fs.readFile(p, 'utf-8');
    };
    try {
        let code: string | null = null;
        try {
          code = await tryRead(primaryPath);
        } catch {
          code = await tryRead(legacyPath);
        }
        reply.header('Content-Type', 'text/plain');
        return code;
    } catch (error) {
        server.log.error(error, `Could not find or read animation file: ${primaryPath} or legacy ${legacyPath}`);
        reply.status(404).send({ error: 'Animation file not found.' });
    }
  });

  // --- Frontend Catch-all ---
  server.get('/*', (req, reply) => { reply.html(); });

  await server.vite.ready();
  await server.listen({ port: 3000 });
}

main();
