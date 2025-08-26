import 'dotenv/config';
import Fastify from 'fastify';
import fastifyVite from '@fastify/vite';
import react from '@vitejs/plugin-react';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { promises as fs } from 'fs';
import crypto from 'crypto';

// --- Setup ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SESSIONS_DIR = resolve(__dirname, 'sessions');

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
  systemInstruction: `You are an expert TypeScript developer specializing in Pixi.js animations. Your task is to create a new animation class based on a user's description. The class MUST adhere to the following rules:
1. It MUST be a single TypeScript class definition, with necessary imports from 'pixi.js' and '../core/BaseAnimate'.
2. It MUST extend the \`BaseAnimate\` class.
3. It MUST have a \`public static readonly animationName: string\` property. This name should be a short, PascalCase identifier for the animation (e.g., 'MyCoolAnimation').
4. It MUST have a \`public static getRequiredSpriteCount(): number\` method that returns the number of sprites the animation requires.
5. It MUST implement the \`public update(deltaTime: number): void\` method. \`deltaTime\` is the time in seconds since the last frame.
6. The animation logic should be contained within the \`update\` method. You can access the sprites to animate via \`this.sprites\`, which is an array of \`PIXI.Sprite\`.
7. You MUST only use TypeScript and the Pixi.js library. Do not import any other libraries.
8. When you have finished generating the code, you MUST call the \`create_animation_file\` function to save the file. The filename should be the same as the class name.
9. Be conversational and explain what you are creating.`,
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

  // --- Vite Frontend ---
  await server.register(fastifyVite, {
    // Point to the editor directory so @fastify/vite finds editor/vite.config.ts
    root: resolve(__dirname),
    dev: true,
    spa: true,
  });

  // --- API Routes ---
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
      try {
          await fs.access(sessionDir);
          const files = await fs.readdir(sessionDir);
          const tsFiles = files.filter(f => f.endsWith('.ts')).map(f => f.replace('.ts', ''));
          return tsFiles;
      } catch (error) {
          // Directory doesn't exist, return empty array
          return [];
      }
  });

  server.get('/api/animation-code/:sessionId/:animName', async (request, reply) => {
    const { sessionId, animName } = request.params as any;
    const filePath = resolve(SESSIONS_DIR, sessionId, 'animations', `${animName}.ts`);
    try {
        await fs.access(filePath);
        const code = await fs.readFile(filePath, 'utf-8');
        reply.header('Content-Type', 'text/plain');
        return code;
    } catch (error) {
        server.log.error(error, `Could not find or read animation file: ${filePath}`);
        reply.status(404).send({ error: 'Animation file not found.' });
    }
  });

  // --- Frontend Catch-all ---
  server.get('/*', (req, reply) => { reply.html(); });

  await server.vite.ready();
  await server.listen({ port: 3000 });
}

main();
