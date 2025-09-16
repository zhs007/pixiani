import 'dotenv/config';
import Fastify from 'fastify';
import fastifyVite from '@fastify/vite';
import fastifyStatic from '@fastify/static';
import { ProxyAgent, setGlobalDispatcher } from 'undici';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, HarmCategory, HarmBlockThreshold, type SafetySetting } from '@google/genai';
import { promises as fs, createWriteStream } from 'fs';
import crypto from 'crypto';
import multipart from '@fastify/multipart';
import path from 'path';
import util from 'util';
import { pipeline } from 'stream';
import { glob } from 'glob';
import { exec } from 'child_process';

const pump = util.promisify(pipeline);

// --- Setup ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Place sessions at repo root to match Vite fs.allow and frontend dynamic imports
const SESSIONS_DIR = resolve(__dirname, '../../.sessions');
// Serve assets from the repo-level assets/sprite directory
const ASSETS_SPRITE_DIR = resolve(__dirname, '../../assets/sprite');
// apps/ directory
// Repository root (used for Vitest root so it can access .sessions/* tests)
const ROOT_DIR = resolve(__dirname, '../..');

const PROXY_URL =
  process.env.HTTPS_PROXY ||
  process.env.HTTP_PROXY ||
  process.env.ALL_PROXY ||
  process.env.PROXY_URL;
if (PROXY_URL) {
  try {
    setGlobalDispatcher(new ProxyAgent(PROXY_URL));
    console.warn(`[editor] Using proxy: ${PROXY_URL}`);
  } catch (e: any) {
    console.warn('[editor] Failed to set proxy agent:', e.message);
  }
}

const sessions = new Map<string, any[]>();

// --- Gemini AI Configuration ---
const API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

if (!API_KEY) {
  console.error('FATAL: GEMINI_API_KEY environment variable is not set.');
  process.exit(1);
}

const genAI = new GoogleGenAI({ apiKey: API_KEY });

const systemInstruction = `You are an expert TypeScript developer specializing in Pixi.js animations. Your primary task is to implement new animation classes based on user descriptions. You must follow a strict Test-Driven Development (TDD) process.

**Your Workflow:**

1.  **Understand the Requirements:** Read the user's request for a new animation.
2.  **Explore Existing Code:** Use the \`get_allowed_files()\` tool to see existing animations and tests. Use the \`read_file(filepath)\` tool to understand how they are implemented. This is crucial for consistency. Do not generate a class name that already exists. Before writing your own tests, read at least one reference test from \`tests/animations/FadeAnimation.test.ts\` or \`tests/animations/ComplexPopAnimation.test.ts\` to mirror their mocking style and structure.
3.  **Write the Animation Code:** Write the TypeScript code for the new animation class. The class name must be in PascalCase. Call \`create_animation_file(className, code)\` to save it.
4.  **Write a Test:** Create a comprehensive test file for your new animation using Vitest. The test should cover the animation's lifecycle, state changes, and visual properties. Call \`create_test_file(className, code)\` to save it.
5.  **Run Tests:** Execute \`run_tests(className)\` to validate your implementation.
6.  **Debug and Refine:**
    *   If the tests fail with a normal error, the tool will return the error output. Analyze the errors and use \`update_animation_file()\` or \`update_test_file()\` to fix the code. Repeat the \`run_tests()\` and update cycle until all tests pass.
    *   If \`run_tests()\` returns a message starting with \`SYSTEM_ERROR:\`, it means there is a problem with the testing environment itself. **Do not try to fix this.** Your task is finished. Report the full, detailed system error message to the user as your final answer so they can debug it.
7.  **Publish:** Once \`run_tests()\` returns a success message (including success with warnings), call \`publish_files(className)\` to make the files available to the editor UI.
8.  **Completion:** Inform the user that the animation has been created, tested, and published successfully.

**Strict Rules for Animation Code:**

1.  **Imports:**
    *   Use: \`import * as PIXI from 'pixi.js'\`.
    *   Use: \`import { BaseAnimate } from '@pixi-animation-library/pixiani-core'\`.
    *   Do NOT import from relative core paths like '../core/BaseAnimate'.
2.  **BaseAnimate Contract (Mandatory):**
    *   Export a single named class that \`extends BaseAnimate\`.
    *   Include: \`public static readonly animationName: string\` (PascalCase, must match the class name).
    *   Include: \`public static getRequiredSpriteCount(): number\` (>= 1 if sprites are used).
    *   Implement \`protected reset(): void\` for initialization.
    *   Implement \`public update(deltaTime: number): void\` for frame logic.
    *   Do NOT override \`play()\`, \`pause()\`, \`resume()\`, or \`setState()\`.
    *   Call \`this.setState('ENDED')\` from \`update()\` to finish the animation.
3.  **File Output:** The file must contain only the single exported class.

**Runtime & Timing Rules (Very Important):**

1.  Time units: The \`deltaTime\` passed to \`update(deltaTime)\` is in SECONDS. Do not treat it as milliseconds, and do not multiply by \`1000/60\`.
2.  Speed handling: The AnimationManager already applies both global speed and per-animation \`anim.speed\` BEFORE calling \`update()\`. Inside the animation, do NOT multiply time by \`this.speed\` again. Use \`elapsed += deltaTime\` directly.
3.  Rotation units: Use radians (clockwise positive in Pixi). One full turn = \`2 * Math.PI\`.
4.  Phase ends and clamping: At phase or animation boundaries, always clamp to the exact final values first (e.g., final scale/rotation), THEN call \`this.setState('ENDED')\` (or move to next phase). Never end before setting final values.
5.  BaseAnimate contract: Only implement \`reset()\` and \`update(deltaTime)\`; do not override \`play/pause/resume/setState\`. Keep \`getRequiredSpriteCount()\` consistent with the number of sprites used.


**Strict Rules for Test Code:**

1.  **Imports (VERY IMPORTANT):**
    *   Use \`import { describe, it, expect, vi, beforeEach } from 'vitest';\`
    *   **For the Animation Class you are testing:** You MUST use a relative path. The path from the test file to the animation file is always the same: \`import { YourClassName } from '../../src/animations/YourClassName';\`
    *   **For ALL other library code (\`BaseObject\`, \`BaseAnimate\`, etc.):** You MUST use the '@pixi-animation-library/pixiani-core' alias. Example: \`import { BaseObject, BaseAnimate } from '@pixi-animation-library/pixiani-core';\`
    *   Do NOT use relative paths like \`../../src/core/BaseObject.ts\`. Only use the alias.
    *   You can import the class-under-test and the library code in the same statement: \`import { YourClassName, BaseObject } from '@pixi-animation-library/pixiani-core';\` is WRONG. It must be two separate imports as described above.
2.  **Structure:**
    *   Use a \`describe\` block for the animation class.
    *   Use \`beforeEach\` to set up a clean instance of your animation before each test.
  *   Write multiple \`it\` blocks to test different aspects: initial state, play(), update() logic, looping, and completion. At minimum, include at least one \`it\` with an \`expect\` so the file never reports "no tests".

3.  **Mocking PIXI (MANDATORY for tests that construct PIXI objects):**
  *   Follow the examples in \`tests/animations/FadeAnimation.test.ts\` and \`tests/animations/ComplexPopAnimation.test.ts\`.
  *   Use \`vi.mock('pixi.js', async () => { const actual = await vi.importActual('pixi.js'); return { ...actual, Sprite: vi.fn().mockImplementation(factory) }; })\`.
  *   Only mock what you need (commonly \`Sprite\` and simple methods like \`anchor.set\`, \`scale.set\`). Keep the mock minimal, deterministic, and per-test reset with \`vi.clearAllMocks()\`.
  *   Do NOT rely on global or implicit pixi behavior. Tests must be self-contained and deterministic.

4.  **Timing in Tests (IMPORTANT):**
  *   Treat \`deltaTime\` as seconds when simulating frames (e.g., 0.016, 0.5, 1.0, etc.).
  *   Do NOT multiply \`deltaTime\` by speed again when stepping time. If you set \`anim.speed = 2\`, the effective duration halves even though you still pass seconds to \`update()\`.
  *   Use approximate assertions with a small epsilon (e.g., 1e-2) for floating-point checks at key times (0s/0.5s/1s/.../end).
  *   At boundary frames, assert final properties first, then assert state equals ENDED to avoid including \`reset()\` side effects.
`;

const generationConfig = {
  temperature: 0.9,
  topK: 1,
  topP: 1,
  maxOutputTokens: 8192,
};

const safetySettings: SafetySetting[] = [
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

// --- Agent continuation controls ---
const CONTINUE_TIMEOUT_MS = Number(process.env.AGENT_CONTINUE_TIMEOUT_MS ?? 30000);
const CONTINUE_RETRIES = Number(process.env.AGENT_CONTINUE_RETRIES ?? 1);

const tools: any = [
  {
    functionDeclarations: [
      {
        name: 'get_allowed_files',
        description:
          'Returns a list of existing animation and test files that can be read for reference.',
        parameters: { type: 'OBJECT', properties: {} },
      },
      {
        name: 'read_file',
        description: 'Reads the content of a single specified file from the allowed list.',
        parameters: {
          type: 'OBJECT',
          properties: {
            filepath: {
              type: 'STRING',
              description:
                'The full path of the file to read (e.g., "src/animations/ScaleAnimation.ts").',
            },
          },
          required: ['filepath'],
        },
      },
      {
        name: 'create_animation_file',
        description:
          'Creates a new TypeScript animation file with the provided code. The class name must not already exist.',
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
        name: 'create_test_file',
        description: 'Creates a new Vitest test file for the corresponding animation class.',
        parameters: {
          type: 'OBJECT',
          properties: {
            className: {
              type: 'STRING',
              description: 'The name of the animation class being tested (PascalCase).',
            },
            code: {
              type: 'STRING',
              description: 'The full TypeScript code for the test file.',
            },
          },
          required: ['className', 'code'],
        },
      },
      {
        name: 'run_tests',
        description:
          'Runs the tests for the specified animation class and returns the output. This should only be called after both the animation and test files have been created.',
        parameters: {
          type: 'OBJECT',
          properties: {
            className: {
              type: 'STRING',
              description: 'The name of the animation class to test (PascalCase).',
            },
          },
          required: ['className'],
        },
      },
      {
        name: 'update_animation_file',
        description: 'Updates an existing TypeScript animation file with new code.',
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
      {
        name: 'update_test_file',
        description: 'Updates an existing Vitest test file with new code.',
        parameters: {
          type: 'OBJECT',
          properties: {
            className: {
              type: 'STRING',
              description: 'The name of the animation class being tested (PascalCase).',
            },
            code: {
              type: 'STRING',
              description: 'The full, updated TypeScript code for the test file.',
            },
          },
          required: ['className', 'code'],
        },
      },
      {
        name: 'publish_files',
        description:
          'Publishes the staged animation and test files for the given className into the session directories so the editor can load them.',
        parameters: {
          type: 'OBJECT',
          properties: {
            className: {
              type: 'STRING',
              description: 'The name of the animation class to publish (PascalCase).',
            },
          },
          required: ['className'],
        },
      },
    ],
  },
];

// --- Tool Implementations ---

async function get_allowed_files(sessionId?: string): Promise<string> {
  const animationFiles = await glob('src/animations/*.ts');
  const testFiles = await glob('tests/animations/*.test.ts');
  const coreFiles = await glob('src/core/*.ts');
  const allFiles = [...animationFiles, ...testFiles, ...coreFiles];
  const out = `Allowed files:\n${allFiles.join('\n')}`;
  if (sessionId) {
    try {
      await logToolCall(sessionId, 'get_allowed_files', {}, { result: allFiles });
    } catch {}
  }
  return out;
}

async function read_file(filepath: string, sessionId?: string): Promise<string> {
  const resolvedPath = resolve(ROOT_DIR, filepath);
  if (
    !resolvedPath.startsWith(ROOT_DIR) ||
    (!filepath.endsWith('.ts') && !filepath.endsWith('.test.ts'))
  ) {
    const out = 'Error: Access denied. You can only read project TypeScript files.';
    if (sessionId) {
      try {
        await logToolCall(sessionId, 'read_file', { filepath }, { output: out });
      } catch {}
    }
    return out;
  }
  try {
    const contents = await fs.readFile(resolvedPath, 'utf-8');
    if (sessionId) {
      try {
        // Log full contents for transparency as requested
        await logToolCall(sessionId, 'read_file', { filepath }, { output: contents });
      } catch {}
    }
    return contents;
  } catch (e: any) {
    const out = `Error: Could not read file: ${e.message}`;
    if (sessionId) {
      try {
        await logToolCall(sessionId, 'read_file', { filepath }, { error: e.message });
      } catch {}
    }
    return out;
  }
}

async function write_file(
  sessionId: string,
  type: 'animation' | 'test',
  className: string,
  code: string,
): Promise<{ success: boolean; message: string; filePath: string }> {
  const baseDir = resolve(SESSIONS_DIR, sessionId, 'staging');
  const dir =
    type === 'animation'
      ? resolve(baseDir, 'src', 'animations')
      : resolve(baseDir, 'tests', 'animations');

  await fs.mkdir(dir, { recursive: true });
  const filePath = resolve(dir, `${className}${type === 'test' ? '.test' : ''}.ts`);

  try {
    // Delete the file first to ensure a clean write and avoid caching issues.
    try {
      await fs.unlink(filePath);
    } catch (e: any) {
      if (e.code !== 'ENOENT') {
        // Ignore "file not found" errors, but throw others.
        throw e;
      }
    }
    await fs.writeFile(filePath, code);
    // Log the tool call
    try {
      const toolName = type === 'animation' ? 'create_animation_file' : 'create_test_file';
      await logToolCall(sessionId, toolName, { className }, { success: true, filePath });
    } catch {}
    return {
      success: true,
      message: `File ${path.basename(filePath)} saved successfully.`,
      filePath,
    };
  } catch (error: any) {
    try {
      const toolName = type === 'animation' ? 'create_animation_file' : 'create_test_file';
      await logToolCall(
        sessionId,
        toolName,
        { className },
        { success: false, message: error.message },
      );
    } catch {}
    return { success: false, message: `Error saving file: ${error.message}`, filePath };
  }
}

// Helper: log a tool call (input and output) to a session-scoped JSONL file for debugging
async function logToolCall(sessionId: string, toolName: string, input: any, output: any) {
  try {
    const logDir = resolve(SESSIONS_DIR, sessionId, 'logs');
    await fs.mkdir(logDir, { recursive: true });
    const entry = {
      timestamp: new Date().toISOString(),
      tool: toolName,
      input,
      output,
    };
    const logPath = resolve(logDir, 'tool_calls.log');
    // Append as JSON line
    await fs.appendFile(logPath, JSON.stringify(entry) + '\n');
  } catch (e: any) {
    console.error(`[${sessionId}] Failed to write tool call log: ${e?.message || e}`);
  }
}

function run_tests(sessionId: string, className: string): Promise<string> {
  return new Promise((promiseResolve) => {
    const testFilePath = resolve(
      SESSIONS_DIR,
      sessionId,
      'staging',
      'tests',
      'animations',
      `${className}.test.ts`,
    );
  const command = `SESSION_TESTS=1 pnpm -w vitest run "${testFilePath}" --root "${ROOT_DIR}"`;

    console.warn(`[${sessionId}] Running tests for ${className}: ${command}`);

    exec(command, (error, stdout, stderr) => {
      const combinedOutput = stdout + stderr;

      // Build the user-facing result message (same logic as before)
      let resultMessage: string;
      // Detect unrecoverable environment errors and return SYSTEM_ERROR so the agent stops trying to fix code
      if (
  combinedOutput.includes('No test files found') ||
        combinedOutput.includes('Failed to resolve import') ||
        combinedOutput.includes('Cannot convert a Symbol value to a string') ||
        combinedOutput.includes('Cannot convert a Symbol value to string')
      ) {
  resultMessage = `SYSTEM_ERROR: Test runner failed due to an environment issue (e.g., missing file, bad import path, or incompatible native/module build). Do not attempt to fix this by modifying code. Stop and report the issue. Original error:\n\n${combinedOutput}\n\nHint: Ensure vitest.config.ts includes session globs like .sessions/**/tests/**/*.test.ts and that --root points to the repo root.`;
      } else if (error) {
        resultMessage = `Tests failed for ${className}:\n\nSTDOUT:\n${stdout}\n\nSTDERR:\n${stderr}`;
      } else if (stderr) {
        resultMessage = `Tests completed for ${className} (with warnings):\n\nSTDOUT:\n${stdout}\n\nSTDERR:\n${stderr}`;
      } else {
        resultMessage = `Tests passed successfully for ${className}!\n\n${stdout}`;
      }

      // Persist the full runner output to a session-scoped log to help debugging later.
      const logPath = resolve(SESSIONS_DIR, sessionId, 'logs', `${className}_run_tests.log`);
      // Ensure directory exists and write the log (fire-and-forget, but capture failures)
      fs.mkdir(dirname(logPath), { recursive: true })
        .then(() => fs.writeFile(logPath, combinedOutput))
        .then(async () => {
          console.warn(`[${sessionId}] Test run output written to ${logPath}`);
          // Log the tool call (input and summarized output)
          try {
            await logToolCall(
              sessionId,
              'run_tests',
              { className, command },
              { resultMessage, logPath },
            );
          } catch (e: any) {
            console.error(`[${sessionId}] Failed to log run_tests call: ${e?.message || e}`);
          }
        })
        .catch((e: any) =>
          console.error(`[${sessionId}] Failed to write test run log: ${e?.message || e}`),
        )
        .finally(() => {
          // Resolve the promise with the same message the agent originally received
          promiseResolve(resultMessage);
        });
    });
  });
}

async function publish_files(
  sessionId: string,
  className: string,
): Promise<{ success: boolean; finalPath?: string }> {
  // Helper to check file existence
  const exists = async (p: string) => {
    try {
      await fs.access(p);
      return true;
    } catch {
      return false;
    }
  };
  const stagingSrcPath = resolve(
    SESSIONS_DIR,
    sessionId,
    'staging',
    'src',
    'animations',
    `${className}.ts`,
  );
  const finalSrcPath = resolve(SESSIONS_DIR, sessionId, 'src', 'animations', `${className}.ts`);

  const stagingTestPath = resolve(
    SESSIONS_DIR,
    sessionId,
    'staging',
    'tests',
    'animations',
    `${className}.test.ts`,
  );
  const finalTestPath = resolve(
    SESSIONS_DIR,
    sessionId,
    'tests',
    'animations',
    `${className}.test.ts`,
  );

  try {
    // Ensure final directories exist
    await fs.mkdir(dirname(finalSrcPath), { recursive: true });
    await fs.mkdir(dirname(finalTestPath), { recursive: true });

    const haveStagingSrc = await exists(stagingSrcPath);
    const haveStagingTest = await exists(stagingTestPath);
    const haveFinalSrc = await exists(finalSrcPath);
    const haveFinalTest = await exists(finalTestPath);

    // Always publish/overwrite src if a staged src exists
    if (haveStagingSrc) {
      await fs.copyFile(stagingSrcPath, finalSrcPath);
      // remove staged copy to keep staging clean
      try {
        await fs.unlink(stagingSrcPath);
      } catch {}
    }

    // Publish/overwrite test if a staged test exists (tests are optional)
    if (haveStagingTest) {
      await fs.copyFile(stagingTestPath, finalTestPath);
      try {
        await fs.unlink(stagingTestPath);
      } catch {}
    }

    const srcNowExists = haveStagingSrc || haveFinalSrc || (await exists(finalSrcPath));
    const testNowExists = haveStagingTest || haveFinalTest || (await exists(finalTestPath));
    const testWasMissing = !haveStagingTest && !haveFinalTest && !testNowExists;

    if (!srcNowExists) {
      // Cannot publish without the animation source file
      const errMsg = `Source file missing for ${className} (staging and final not found)`;
      console.error(`[${sessionId}] ${errMsg}`);
      try {
        await logToolCall(
          sessionId,
          'publish_files',
          { className },
          { success: false, error: errMsg },
        );
      } catch {}
      return { success: false };
    }

    const logPayload: any = { success: true, finalPath: finalSrcPath };
    if (testWasMissing)
      logPayload.warning = 'Test file not found in staging or final; published animation only.';

    const mode =
      haveStagingSrc && haveFinalSrc ? 'overwritten' : haveStagingSrc ? 'published' : 'kept';
    console.warn(
      `[${sessionId}] Published files for ${className} (src ${mode})${testWasMissing ? ' (animation only, no test updated)' : ''}`,
    );
    try {
      await logToolCall(sessionId, 'publish_files', { className }, { ...logPayload, mode });
    } catch {}
    return { success: true, finalPath: finalSrcPath };
  } catch (e: any) {
    console.error(`[${sessionId}] Failed to publish files for ${className}: ${e.message}`);
    try {
      await logToolCall(
        sessionId,
        'publish_files',
        { className },
        { success: false, error: e.message },
      );
    } catch {}
    return { success: false };
  }
}

// --- Fastify Server ---
async function main() {
  await fs.mkdir(SESSIONS_DIR, { recursive: true });
  const server = Fastify({ logger: true });

  server.register(multipart);

  server.register(fastifyStatic as any, {
    root: ASSETS_SPRITE_DIR,
    prefix: '/sprite/',
    index: false,
    decorateReply: false,
  });

  // Register Fastify-Vite using the folder that contains vite.config.ts (apps/editor)
  await server.register(fastifyVite, {
    root: resolve(__dirname),
    dev: true,
    spa: true,
  });

  server.get('/api/assets', async (request, reply) => {
    const assetsDir = ASSETS_SPRITE_DIR;
    try {
      await fs.access(assetsDir);
      const files = await fs.readdir(assetsDir);
      const imageFiles = files.filter((file) => /\.(png|jpe?g|gif)$/i.test(file));
      reply.send(imageFiles);
    } catch (error) {
      server.log.error(error, 'Could not list assets in ' + assetsDir);
      reply.send([]);
    }
  });

  server.post('/api/upload-asset', async (request, reply) => {
    try {
      const data = await request.file();
      if (!data) {
        return reply.status(400).send({ error: 'No file uploaded.' });
      }

      const safeFilename = path.basename(data.filename);
      const assetsDir = ASSETS_SPRITE_DIR;
      await fs.mkdir(assetsDir, { recursive: true });

      const filePath = path.join(assetsDir, safeFilename);
      await pump(data.file, createWriteStream(filePath));

      server.log.info(`Uploaded file: ${filePath}`);
      reply.send({ success: true, filename: safeFilename, path: `/sprite/${safeFilename}` });
    } catch (error) {
      server.log.error(error, 'Asset upload failed');
      reply.status(500).send({ error: 'Failed to upload asset.' });
    }
  });

  server.get('/api/chat', (request, reply) => {
    // --- SSE Setup ---
    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Access-Control-Allow-Origin', '*'); // Allow CORS for dev

    const writeEvent = (data: object) => {
      reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // --- Main async logic ---
    const run = async () => {
      let sessionId: string;
      let idleTimeout: NodeJS.Timeout | undefined;

      const resetIdleTimeout = () => {
        if (idleTimeout) clearTimeout(idleTimeout);
        idleTimeout = setTimeout(() => {
          const error = new Error(
            `Timeout: No data received for ${CONTINUE_TIMEOUT_MS}ms. Closing connection.`,
          );
          server.log.warn(`[${sessionId}] ${error.message}`);
          writeEvent({ type: 'error', message: error.message });
          reply.raw.end();
        }, CONTINUE_TIMEOUT_MS);
      };

      try {
        const { prompt, sessionId: querySessionId } = request.query as {
          prompt: string;
          sessionId?: string;
        };

        if (!querySessionId) {
          sessionId = crypto.randomUUID();
          sessions.set(sessionId, []);
          writeEvent({ type: 'session_id', sessionId });
        } else {
          sessionId = querySessionId;
          if (!sessions.has(sessionId)) {
            sessions.set(sessionId, []);
          }
        }
        resetIdleTimeout(); // Start the timer as soon as the request is processed

        const chatHistory = sessions.get(sessionId)!;
        chatHistory.push({ role: 'user', parts: [{ text: prompt }] });

        const openStreamWithRetry = async () => {
          const attempts = Number.isFinite(CONTINUE_RETRIES) ? CONTINUE_RETRIES + 1 : 1;
          let lastErr: any;
          for (let attempt = 0; attempt < attempts; attempt++) {
            try {
              return await genAI.models.generateContentStream({
                model: GEMINI_MODEL,
                contents: chatHistory,
                config: {
                  ...generationConfig,
                  systemInstruction,
                  safetySettings,
                  tools,
                },
              });
            } catch (e: any) {
              lastErr = e;
              const waitMs = Math.min(1000 * Math.pow(2, attempt), 5000);
              server.log.warn(
                `[${sessionId}] generateContentStream failed (attempt ${attempt + 1}/${attempts}): ${e?.message || e}`,
              );
              if (attempt < attempts - 1) {
                await new Promise((r) => setTimeout(r, waitMs));
              }
            }
          }
          throw lastErr;
        };

        let stream = await openStreamWithRetry();

        const MAX_STEPS = 10;
        for (let i = 0; i < MAX_STEPS; i++) {
          let aggregatedResponse: any = null;
          let functionCalls: any[] = [];
          let fullText = '';

          for await (const chunk of stream) {
            resetIdleTimeout(); // Reset timer on each received chunk

            // Aggregate text from all chunks
            if (chunk.text) {
              fullText += chunk.text;
            }

            // The last chunk contains other useful details like function calls
            aggregatedResponse = chunk;

            // We also need to check for function calls in the chunks
            if (Array.isArray((chunk as any).functionCalls)) {
              functionCalls.push(...(chunk as any).functionCalls);
            }
          }
          const finalResponse = aggregatedResponse;

          if (!finalResponse) {
            throw new Error('Received no response from model stream.');
          }

          // After the stream ends, check if we have any function calls.
          if (functionCalls.length === 0) {
            // If no function calls, the agent is done. Log and send the full accumulated text.
            await logWorkflow(sessionId, 'final_response', { text: fullText });
            writeEvent({ type: 'final_response', text: fullText });
            chatHistory.push({ role: 'model', parts: [{ text: fullText }] });
            return; // End of loop
          }

          const call = functionCalls[0]; // Assuming one tool call at a time for now
          server.log.info(`[${sessionId}] Executing tool call: ${call.name}`, call.args);
          writeEvent({ type: 'tool_call', name: call.name, args: call.args });

          // --- Tool Execution Logic (remains the same) ---
          let toolResponseContent;
          // ... (Existing switch case for tool execution)
          switch (call.name) {
            case 'get_allowed_files':
              toolResponseContent = await get_allowed_files(sessionId);
              break;
            case 'read_file':
              toolResponseContent = await read_file(call.args.filepath, sessionId);
              break;
            case 'create_animation_file': {
              const res = await write_file(
                sessionId,
                'animation',
                call.args.className,
                call.args.code,
              );
              toolResponseContent = res.message;
              break;
            }
            case 'create_test_file': {
              const res = await write_file(sessionId, 'test', call.args.className, call.args.code);
              toolResponseContent = res.message;
              break;
            }
            case 'update_animation_file': {
              const res = await write_file(
                sessionId,
                'animation',
                call.args.className,
                call.args.code,
              );
              toolResponseContent = res.message;
              break;
            }
            case 'update_test_file': {
              const res = await write_file(sessionId, 'test', call.args.className, call.args.code);
              toolResponseContent = res.message;
              break;
            }
            case 'run_tests':
              toolResponseContent = await run_tests(sessionId, call.args.className);
              break;
            case 'publish_files':
              {
                const res = await publish_files(sessionId, call.args.className);
                toolResponseContent = res.success
                  ? `Published ${call.args.className} successfully.`
                  : `Failed to publish ${call.args.className}.`;
                if (!res.success) {
                  writeEvent({ type: 'error', message: `发布失败：${call.args.className}` });
                }
              }
              break;
            default:
              toolResponseContent = `Unknown tool: ${call.name}`;
          }
          // --- End Tool Execution ---

          writeEvent({ type: 'tool_response', name: call.name, response: toolResponseContent });

          // --- Publish on Success (remains the same) ---
          if (
            call.name === 'run_tests' &&
            (toolResponseContent.startsWith('Tests passed successfully') ||
              (toolResponseContent.startsWith('Tests completed for') &&
                toolResponseContent.includes('(with warnings)')))
          ) {
            const classNameToPublish = call.args.className;
            server.log.info(
              `[${sessionId}] Tests passed for ${classNameToPublish}, attempting to publish...`,
            );
            writeEvent({
              type: 'tool_call',
              name: 'publish_files',
              args: { className: classNameToPublish },
            });
            const publishResult = await publish_files(sessionId, classNameToPublish);
            writeEvent({
              type: 'tool_response',
              name: 'publish_files',
              response: publishResult.success
                ? `Published ${classNameToPublish} successfully.`
                : `Failed to publish ${classNameToPublish}.`,
            });
            if (publishResult.success && publishResult.finalPath) {
              writeEvent({
                type: 'workflow_complete',
                className: classNameToPublish,
                filePath: publishResult.finalPath,
              });
            } else {
              writeEvent({
                type: 'error',
                message: `Agent task succeeded, but failed to publish files for ${classNameToPublish}.`,
              });
            }
          }

          // The history push for the model's function call is now implicit in the SDK
          chatHistory.push({
            role: 'model',
            parts: [{ functionCall: call }],
          });
          // Send the tool response back to the model for the next turn
          chatHistory.push({
            role: 'function',
            parts: [
              { functionResponse: { name: call.name, response: { content: toolResponseContent } } },
            ],
          });

          // Before the next turn, capture a preview of the model text from this turn
          const previewForClient = fullText;

          // Get the stream for the next turn.
          const contStart = Date.now();
          await logWorkflow(sessionId, 'model_continue_start', {
            timeoutMs: CONTINUE_TIMEOUT_MS,
          });
          writeEvent({
            type: 'heartbeat',
            phase: 'model_continue_start',
            timeoutMs: CONTINUE_TIMEOUT_MS,
          });

          stream = await openStreamWithRetry();

          const contEnd = Date.now();
          await logWorkflow(sessionId, 'model_continue_end', {
            durationMs: contEnd - contStart,
            responsePreview: previewForClient,
          });
          writeEvent({
            type: 'heartbeat',
            phase: 'model_continue_end',
            durationMs: contEnd - contStart,
            responsePreview: previewForClient,
          });

          if (i === MAX_STEPS - 1) {
            writeEvent({ type: 'error', message: 'Workflow exceeded maximum steps (10).' });
            server.log.warn(`[${sessionId}] Workflow terminated due to exceeding max steps.`);
            return;
          }
        }
      } catch (error: any) {
        server.log.error(error, 'Error processing chat stream');
        writeEvent({ type: 'error', message: `An unexpected error occurred: ${error.message}` });
      } finally {
        if (idleTimeout) clearTimeout(idleTimeout);
        reply.raw.end(); // Ensure the SSE connection is closed
      }
    };
    run();
  });
  // Append workflow events to a session-scoped JSONL log
  async function logWorkflow(sessionId: string, event: string, payload: any) {
    try {
      const logDir = resolve(SESSIONS_DIR, sessionId, 'logs');
      await fs.mkdir(logDir, { recursive: true });
      const logPath = resolve(logDir, 'workflow.log');
      const entry = { timestamp: new Date().toISOString(), event, ...payload };
      await fs.appendFile(logPath, JSON.stringify(entry) + '\n');
    } catch (e: any) {
      console.error(`[${sessionId}] Failed to write workflow log: ${e?.message || e}`);
    }
  }

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
    const sessionDir = resolve(SESSIONS_DIR, sessionId, 'src', 'animations');
    const legacyDir = resolve(__dirname, 'sessions', sessionId, 'animations');
    const legacyRootDir = resolve(SESSIONS_DIR, sessionId, 'animations');
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
    try {
      await fs.access(legacyDir);
      const list = await buildList(legacyDir);
      return list;
    } catch {}
    try {
      await fs.access(legacyRootDir);
      const list = await buildList(legacyRootDir);
      if (list.length > 0) return list;
    } catch {}
    return [];
  });

  server.get('/api/animation-code/:sessionId/:animName', async (request, _reply) => {
    const { sessionId, animName } = request.params as any;
    const primaryPath = resolve(SESSIONS_DIR, sessionId, 'src', 'animations', `${animName}.ts`);
    const legacyPath = resolve(__dirname, 'sessions', sessionId, 'animations', `${animName}.ts`);
    const legacyRootPath = resolve(SESSIONS_DIR, sessionId, 'animations', `${animName}.ts`);
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
    const fromLegacyRoot = await tryRead(legacyRootPath);
    if (fromLegacyRoot) return fromLegacyRoot;
    return '';
  });

  server.get('/*', (req, reply) => {
    reply.html();
  });

  await server.vite.ready();
  await server.listen({ port: 3000 });
}

main();
