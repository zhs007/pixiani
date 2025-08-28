import 'dotenv/config';
import Fastify from 'fastify';
import fastifyVite from '@fastify/vite';
import fastifyStatic from '@fastify/static';
import { ProxyAgent, setGlobalDispatcher } from 'undici';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { promises as fs, createWriteStream } from 'fs';
import crypto from 'crypto';
import multipart from '@fastify/multipart';
import path from 'path';
import util from 'util';
import { pipeline } from 'stream';
import { verifyAnimation } from './simulation';

const pump = util.promisify(pipeline);

// --- Setup ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Store sessions outside of editor/ to avoid dev server restarts on file writes
const SESSIONS_DIR = resolve(__dirname, '../.sessions');
const ANIMATIONS_DIR = resolve(__dirname, '../src/animations');
// Path to sprite assets folder (served by Vite publicDir in editor/vite.config.ts)
const ASSETS_SPRITE_DIR = resolve(__dirname, '../assets/sprite');

// Optional HTTP(S) proxy for outgoing requests (e.g., Gemini API)
// Supported envs: HTTPS_PROXY, HTTP_PROXY, ALL_PROXY, PROXY_URL
const PROXY_URL =
  process.env.HTTPS_PROXY ||
  process.env.HTTP_PROXY ||
  process.env.ALL_PROXY ||
  process.env.PROXY_URL;
if (PROXY_URL) {
  try {
    setGlobalDispatcher(new ProxyAgent(PROXY_URL));
    console.warn(`[editor] Using proxy: ${PROXY_URL}`);
  } catch (e) {
    console.warn('[editor] Failed to set proxy agent:', e);
  }
}

// In-memory store for session chat histories.
// In a real app, this would be a database.
interface SessionData {
  chatHistory: any[];
  state: 'clarifying' | 'awaiting_confirmation' | 'generating';
  originalPrompt?: string;
}
const sessions = new Map<string, SessionData>();

// --- Gemini AI Configuration ---
const API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

if (!API_KEY) {
  console.error('FATAL: GEMINI_API_KEY environment variable is not set.');
  process.exit(1);
}
const genAI = new GoogleGenerativeAI(API_KEY);
const BASE_SYSTEM_INSTRUCTION = `You are an expert TypeScript developer specializing in Pixi.js animations. Your task is to create a new animation class based on a user's description of the desired EFFECT. Implement it robustly in this project without pitfalls. Follow these exact rules so the file compiles and works in our editor:
1) Imports:
   - Use: \`import * as PIXI from 'pixi.js'\`.
   - Use: \`import { BaseAnimate } from 'pixi-animation-library'\`.
   - Do NOT import from relative core paths like '../core/BaseAnimate'.
2) BaseAnimate contract (mandatory):
   - Export a single named class that \`extends BaseAnimate\`.
   - Include: \`public static readonly animationName: string\` (PascalCase, short).
   - Include: \`public static getRequiredSpriteCount(): number\` (>= 1 if sprites are used).
  - Implement EXACTLY: \`protected reset(): void\` (initialize/allocate state, set up meshes/containers, and prepare to start). Do not rename it.
   - Implement: \`public update(deltaTime: number): void\` with all per-frame logic.
   - Do NOT override \`play()\`, \`pause()\`, \`resume()\`, or \`setState()\`. Use the provided lifecycle.
  - Do NOT call \`play()\` or \`setState()\` inside \`constructor\` or \`reset()\`. \`reset()\` must be side-effect free w.r.t. state; only allocate/initialize. Changing state in \`reset()\` causes infinite loops because \`BaseAnimate.play()\` calls \`reset()\`.
  - If you override \`stop()\`, keep it minimal (e.g., restore sprite visibility, hide/destroy temporary nodes) and then call \`super.stop()\` OR explicitly set \`this.setState('IDLE')\`. Avoid side effects beyond cleanup.
   - Access sprites via \`this.sprites\`. The editor sets \`anchor.set(0.5)\` and calls \`play()\` automatically.
   - Do NOT import any other libraries.
3) Mesh-specific best practices (if your effect involves mesh/vertex warping):
   - Prefer \`new PIXI.MeshPlane({ texture, verticesX, verticesY })\` for evenly distributed grids.
   - Do NOT rely on \`mesh.width/height\` for positioning/normalizing. Use geometry (\`aPosition\`) bounds instead.
   - To align mesh with the original sprite:
     - Copy transform: \`mesh.position/scale/rotation\` from the source sprite.
     - Emulate anchor using pivot: \`mesh.pivot.set(minX + w*anchor.x, minY + h*anchor.y)\`.
     - Hide the source sprite during play (\`sprite.visible = false\`), and restore visibility on \`stop()\`.
   - Vertex updates:
     - Read/write the \`aPosition\` buffer (Float32Array) and call \`buffer.update()\` each frame after modifying vertices.
     - Compute and cache original vertices for baseline calculations.
     - Normalize across geometry bounds (min/max) — not via transformed sizes.
   - Performance:
     - Choose a sensible grid (e.g., 32x32/64x64) unless the user explicitly asks for very dense meshes.
     - Avoid per-vertex randomization unless the user asks for it.
4) Control flow and lifecycle:
   - Use \`this.state\` via \`play/pause/resume/stop\`. Set \`loop\` and \`speed\` only if needed.
  - When the effect reaches its terminal state, call \`this.setState('ENDED')\` from \`update()\`. If \`loop\` is true, it will restart via \`play()\`.
   - Keep public API surface minimal and avoid side effects beyond the passed sprites/object.
  - Texture readiness: In \`reset()\`, guard against missing sprites or invalid textures. If \`!sprite || !sprite.texture?.valid\`, skip heavy setup and let \`update()\` early-return until ready. Do not change state from \`reset()\`.
5) File output:
   - The file must export only that class.
   - After you output the code, you MUST call the \`create_animation_file\` function to save it (use the class name for the filename).

Examples of valid animations (concise and correct w.r.t. BaseAnimate):
// Example A: Single-sprite bounce scale
export class BounceScale extends BaseAnimate {
  public static readonly animationName = 'BounceScale';
  public static getRequiredSpriteCount(): number { return 1; }
  private t = 0;
  protected reset(): void {
    this.t = 0;
  }
  public update(dt: number): void {
    if (!this.isPlaying) return;
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
  protected reset(): void {
    this.t = 0;
  }
  public update(dt: number): void {
    if (!this.isPlaying) return;
    this.t += dt;
    const r = 50;
    this.sprites[0].x = Math.cos(this.t) * r;
    this.sprites[0].y = Math.sin(this.t) * r;
    this.sprites[1].x = Math.cos(this.t + Math.PI) * r;
    this.sprites[1].y = Math.sin(this.t + Math.PI) * r;
  }
}

Common pitfalls to avoid (must not do these):
- Missing \`protected reset(): void\` (required by BaseAnimate). Do not rename to init/start/setup.
- Overriding \`play()\` or calling \`reset()\` manually from update — let BaseAnimate manage lifecycle.
- Using \`mesh.width/height\` to normalize vertices — use geometry bounds from \`aPosition\`.

\n*** End Patch

Important:
- The user describes the EFFECT; implement it with the above engineering guardrails.
- Be conversational and explain briefly what you created before calling the tool.`;

const generationConfig = {
  temperature: 0.9,
  topK: 1,
  topP: 1,
  maxOutputTokens: 8192,
};

const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
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
            className: {
              type: 'STRING',
              description: 'The name of the animation class, in PascalCase.',
            },
            code: {
              type: 'STRING',
              description: 'The full TypeScript code for the animation class.',
            },
          },
          required: ['className', 'code'],
        },
      },
      {
        name: 'update_animation_file',
        description:
          'Updates an existing TypeScript animation file with new code (same class name).',
        parameters: {
          type: 'OBJECT',
          properties: {
            className: {
              type: 'STRING',
              description: 'The name of the animation class to update (PascalCase).',
            },
            code: {
              type: 'STRING',
              description: 'The full, updated TypeScript code for the animation class.',
            },
          },
          required: ['className', 'code'],
        },
      },
    ],
  },
];

// (Validation removed by user request)

/**
 * Creates a dynamic system instruction for the AI by injecting a list of existing
 * animation names to avoid duplicates.
 * @param sessionId The current user session ID.
 * @returns A promise that resolves to the full system instruction string.
 */
async function createDynamicSystemInstruction(sessionId: string): Promise<string> {
  let instruction = BASE_SYSTEM_INSTRUCTION;
  const existingNames = new Set<string>();

  // 1. Get built-in animations from src/animations
  try {
    const files = await fs.readdir(ANIMATIONS_DIR);
    files
      .filter((file) => file.endsWith('.ts'))
      .forEach((file) => existingNames.add(file.replace(/\.ts$/, '')));
  } catch (error) {
    // Log the error but don't fail the request
    console.error('Could not read built-in animations directory:', error);
  }

  // 2. Get session-specific animations created by the user
  try {
    const sessionAnimDir = resolve(SESSIONS_DIR, sessionId, 'animations');
    await fs.access(sessionAnimDir); // Check if directory exists
    const files = await fs.readdir(sessionAnimDir);
    files
      .filter((file) => file.endsWith('.ts'))
      .forEach((file) => existingNames.add(file.replace(/\.ts$/, '')));
  } catch (error) {
    // This is not a critical error, the directory might not exist yet.
  }

  if (existingNames.size > 0) {
    const namesList = Array.from(existingNames).join(', ');
    const rule = `\n\nIMPORTANT: Do NOT use any of the following existing animation class names, as it will cause a compilation error: ${namesList}. You must invent a new, unique name for the class.`;
    instruction += rule;
  }

  return instruction;
}

// --- Fastify Server ---
async function main() {
  await fs.mkdir(SESSIONS_DIR, { recursive: true });
  const server = Fastify({ logger: true });

  // Register multipart handler
  server.register(multipart);

  // Serve uploaded sprite assets at /sprite/*
  server.register(fastifyStatic as any, {
    root: ASSETS_SPRITE_DIR,
    prefix: '/sprite/',
    index: false,
    decorateReply: false,
  });

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
    const assetsDir = ASSETS_SPRITE_DIR;
    try {
      await fs.access(assetsDir);
      const files = await fs.readdir(assetsDir);
      // We only want image files, and filter out system files like .DS_Store
      const imageFiles = files.filter((file) => /\.(png|jpe?g|gif)$/i.test(file));
      reply.send(imageFiles);
    } catch (error) {
      server.log.error(error, 'Could not list assets in ' + assetsDir);
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
      const assetsDir = ASSETS_SPRITE_DIR;
      await fs.mkdir(assetsDir, { recursive: true }); // Ensure directory exists

      const filePath = path.join(assetsDir, safeFilename);
      await pump(data.file, createWriteStream(filePath));

      server.log.info(`Uploaded file: ${filePath}`);
      reply.send({ success: true, filename: safeFilename, path: `/sprite/${safeFilename}` });
    } catch (error) {
      server.log.error(error, 'Asset upload failed');
      reply.status(500).send({ error: 'Failed to upload asset.' });
    }
  });

  server.post('/api/chat', async (request, reply) => {
    try {
      const body = request.body as any;
      const { prompt: userPrompt } = body as { prompt: string };
      let { sessionId } = body as { sessionId?: string };

      // --- Session Management ---
      if (!sessionId) {
        sessionId = crypto.randomUUID();
        sessions.set(sessionId, { chatHistory: [], state: 'clarifying' });
      } else if (!sessions.has(sessionId)) {
        sessions.set(sessionId, { chatHistory: [], state: 'clarifying' });
      }
      const session = sessions.get(sessionId)!;

      // --- State Machine for Conversation Flow ---
      let systemInstruction = await createDynamicSystemInstruction(sessionId);
      let finalPrompt = userPrompt;

      if (session.state === 'clarifying') {
        session.originalPrompt = userPrompt;
        systemInstruction += `\n\n---
IMPORTANT: Your first task is to understand and clarify the user's request for an animation.
1. Analyze the user's prompt: "${userPrompt}".
2. If details like duration, speed, or intensity are missing, propose sensible defaults (e.g., "a 2-second duration").
3. Describe the animation you plan to create in plain text, listing all parameters.
4. Conclude by asking the user to confirm if your understanding is correct before you proceed to write the code.
5. Do NOT generate any TypeScript code or call any functions yet. Just send the text description for confirmation.`;
        session.state = 'awaiting_confirmation';
      } else if (session.state === 'awaiting_confirmation') {
        const isConfirmation = /^(yes|correct|ok|go|yep|yeah|proceed|looks good)/i.test(
          userPrompt,
        );

        if (isConfirmation) {
          session.state = 'generating';
          finalPrompt = `The user has confirmed the plan. Now, generate the TypeScript code for the following animation request: "${session.originalPrompt}". The user's confirmation message was: "${userPrompt}". Please now write the full code and call the 'create_animation_file' function.`;
          // Use the original, full system instruction for code generation
        } else {
          // User provided a modification, stay in clarification loop
          finalPrompt = `The user has provided feedback on your proposed animation plan. Their original request was: "${session.originalPrompt}". Your previous plan was based on this. Their new feedback is: "${userPrompt}". Please update your animation plan based on this feedback and present the new text description for confirmation. Do NOT write code yet.`;
          // State remains 'awaiting_confirmation'
        }
      }
      // If state is 'generating', we use the default flow with the dynamically generated prompt.

      const model = genAI.getGenerativeModel({
        model: GEMINI_MODEL,
        systemInstruction,
      });

      const chat = model.startChat({
        history: session.chatHistory,
        generationConfig,
        safetySettings,
        tools,
      });

      const result = await chat.sendMessage(finalPrompt);
      const geminiResponse: any = result.response as any;
      let responseText = geminiResponse.text();

      // --- Function Call Handling and Verification Loop ---
      const processAndVerify = async (
        initialResponse: any,
        attempt = 1,
      ): Promise<string> => {
        const MAX_ATTEMPTS = 2; // Initial attempt + 1 correction
        if (attempt > MAX_ATTEMPTS) {
          return `I tried to fix the animation ${attempt - 1} times but failed. I will stop for now. Please try a different prompt.`;
        }

        const calls = initialResponse.functionCalls?.() ?? [];
        if (!calls.length) {
          return initialResponse.text() ?? '';
        }

        let responseText =
          initialResponse.text() || 'OK, I will create the animation.';

        for (const call of calls) {
          if (
            call.name !== 'create_animation_file' &&
            call.name !== 'update_animation_file'
          )
            continue;

          const { className, code } = call.args;
          if (!className || !code) continue;

          server.log.info(
            `[Attempt ${attempt}] Verifying animation: ${className}`,
          );
          const result = await verifyAnimation(className, code);

          if (result.success) {
            server.log.info(
              `[Attempt ${attempt}] Verification successful for ${className}. Writing file.`,
            );
            const sessionDir = resolve(SESSIONS_DIR, sessionId, 'animations');
            await fs.mkdir(sessionDir, { recursive: true });
            const filePath = resolve(sessionDir, `${className}.ts`);
            await fs.writeFile(filePath, code);

            responseText =
              attempt > 1
                ? `I found a bug in my first attempt, but I've fixed it. The new version of \`${className}.ts\` has been created and verified.`
                : `I have created and verified the animation \`${className}.ts\`. You can now select it from the dropdown.`;
            return responseText; // Success, exit the loop
          }

          // --- VERIFICATION FAILED ---
          server.log.error(
            `[Attempt ${attempt}] Verification FAILED for ${className}.`,
            { errors: result.errors },
          );

          // This was the last attempt, return failure message
          if (attempt >= MAX_ATTEMPTS) {
            return `I tried to create an animation, but it failed verification. After a correction attempt, it failed again.
Final errors:
${result.errors.join('\n')}`;
          }

          // --- STARTING CORRECTION ATTEMPT ---
          responseText = `My first attempt to create the animation failed. I will now try to fix it.`;
          const correctionPrompt = `
You are an expert TypeScript developer fixing a broken Pixi.js animation.
The user's original request was: "${session.originalPrompt}"
You generated the following TypeScript code for a class named "${className}", but it failed verification:
--- BROKEN CODE START ---
${code}
--- BROKEN CODE END ---

Here are the captured results from the verification environment:
- Errors: ${result.errors.join('\n') || 'None'}
- Animation Logs: ${result.spyLogs.join('\n') || 'None'}

Your task is to analyze the code, errors, and logs to identify the bug.
Then, provide the fully corrected code.
Respond ONLY with a call to the \`update_animation_file\` function with the complete, fixed code for the class.
`;

          // Add user part of correction to history
          session.chatHistory.push({
            role: 'user',
            parts: [{ text: correctionPrompt }],
          });

          const chat = model.startChat({
            history: session.chatHistory,
            generationConfig,
            safetySettings,
            tools,
          });

          const correctionResult = await chat.sendMessage(correctionPrompt);
          const correctionResponse = correctionResult.response;

          // Add model part of correction to history
          session.chatHistory.push(correctionResponse.candidates[0].content);

          // Recursively call this function for the next attempt
          return processAndVerify(correctionResponse, attempt + 1);
        }
        return responseText;
      };

      responseText = await processAndVerify(geminiResponse);

      // --- Update History ---
      session.chatHistory.push({ role: 'user', parts: [{ text: userPrompt }] });
      // We need to store the full response from the model, including potential function calls
      session.chatHistory.push(geminiResponse.candidates[0].content);

      reply.send({ response: responseText, sessionId });
    } catch (error) {
      server.log.error(error, 'Error processing chat request');
      reply.status(500).send({ error: 'Failed to process chat request' });
    }
  });

  server.post('/api/clear_session', async (request, _reply) => {
    const { sessionId } = request.body as any;
    if (sessionId && sessions.has(sessionId)) {
      sessions.set(sessionId, []);
      server.log.info(`Cleared session for ${sessionId}`);
    }
    return { success: true };
  });

  server.get('/api/animations/:sessionId', async (request, _reply) => {
    const { sessionId } = request.params as any;
    const sessionDir = resolve(SESSIONS_DIR, sessionId, 'animations');
    const legacyDir = resolve(__dirname, 'sessions', sessionId, 'animations');
    const buildList = async (dir: string) => {
      const files = await fs.readdir(dir);
      const tsFiles = files.filter((f) => f.endsWith('.ts'));
      return tsFiles.map((f) => ({ name: f.replace(/\.ts$/, ''), fsPath: resolve(dir, f) }));
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

  server.get('/api/animation-code/:sessionId/:animName', async (request, _reply) => {
    const { sessionId, animName } = request.params as any;
    const primaryPath = resolve(SESSIONS_DIR, sessionId, 'animations', `${animName}.ts`);
    const legacyPath = resolve(__dirname, 'sessions', sessionId, 'animations', `${animName}.ts`);
    const tryRead = async (p: string) => {
      try {
        return await fs.readFile(p, 'utf-8');
      } catch {
        return null;
      }
    };
    const fromPrimary = await tryRead(primaryPath);
    if (fromPrimary) return fromPrimary;
    const fromLegacy = await tryRead(legacyPath);
    if (fromLegacy) return fromLegacy;
    return '';
  });

  // --- Frontend Catch-all ---
  server.get('/*', (req, reply) => {
    reply.html();
  });

  await server.vite.ready();
  await server.listen({ port: 3000 });
}

main();
