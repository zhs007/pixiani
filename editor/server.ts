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
import { glob } from 'glob';
import { exec } from 'child_process';

const pump = util.promisify(pipeline);

// --- Setup ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SESSIONS_DIR = resolve(__dirname, '../.sessions');
const ASSETS_SPRITE_DIR = resolve(__dirname, '../assets/sprite');
const ROOT_DIR = resolve(__dirname, '..');

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
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({
  model: GEMINI_MODEL,
  systemInstruction: `You are an expert TypeScript developer specializing in Pixi.js animations. Your primary task is to implement new animation classes based on user descriptions. You must follow a strict Test-Driven Development (TDD) process.

**Your Workflow:**

1.  **Understand the Requirements:** Read the user's request for a new animation.
2.  **Explore Existing Code:** Use the \`get_allowed_files()\` tool to see existing animations and tests. Use the \`read_file(filepath)\` tool to understand how they are implemented. This is crucial for consistency. Do not generate a class name that already exists.
3.  **Write the Animation Code:** Write the TypeScript code for the new animation class. The class name must be in PascalCase. Call \`create_animation_file(className, code)\` to save it.
4.  **Write a Test:** Create a comprehensive test file for your new animation using Vitest. The test should cover the animation's lifecycle, state changes, and visual properties. Call \`create_test_file(className, code)\` to save it.
5.  **Run Tests:** Execute \`run_tests(className)\` to validate your implementation.
6.  **Debug and Refine:**
    *   If the tests fail, the tool will return the error output.
    *   Analyze the errors and use \`update_animation_file()\` or \`update_test_file()\` to fix the code.
    *   Repeat the \`run_tests()\` and update cycle until all tests pass.
7.  **Completion:** Once \`run_tests()\` returns a success message, the task is complete. Inform the user that the animation has been created and tested successfully.

**Strict Rules for Animation Code:**

1.  **Imports:**
    *   Use: \`import * as PIXI from 'pixi.js'\`.
    *   Use: \`import { BaseAnimate } from 'pixi-animation-library'\`.
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

**Strict Rules for Test Code:**

1.  **Imports:**
    *   Use \`import { describe, it, expect, vi, beforeEach } from 'vitest';\`
    *   Import the animation class you are testing: \`import { YourClassName } from '../../src/animations/YourClassName';\` (Note the relative path).
    *   Import \`BaseObject\`: \`import { BaseObject } from '../../src/core/BaseObject';\`
    *   Mock Pixi.js sprites for testing. Refer to existing test files for examples.
2.  **Structure:**
    *   Use a \`describe\` block for the animation class.
    *   Use \`beforeEach\` to set up a clean instance of your animation before each test.
    *   Write multiple \`it\` blocks to test different aspects: initial state, play(), update() logic, looping, and completion.`,
});

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
    ],
  },
];

// --- Tool Implementations ---

async function get_allowed_files(): Promise<string> {
  const animationFiles = await glob('src/animations/*.ts');
  const testFiles = await glob('tests/animations/*.test.ts');
  const coreFiles = await glob('src/core/*.ts');
  const allFiles = [...animationFiles, ...testFiles, ...coreFiles];
  return `Allowed files:\n${allFiles.join('\n')}`;
}

async function read_file(filepath: string): Promise<string> {
  const resolvedPath = resolve(ROOT_DIR, filepath);
  if (
    !resolvedPath.startsWith(ROOT_DIR) ||
    (!filepath.endsWith('.ts') && !filepath.endsWith('.test.ts'))
  ) {
    return 'Error: Access denied. You can only read project TypeScript files.';
  }
  try {
    return await fs.readFile(resolvedPath, 'utf-8');
  } catch (e: any) {
    return `Error: Could not read file: ${e.message}`;
  }
}

async function write_file(
  sessionId: string,
  type: 'animation' | 'test',
  className: string,
  code: string,
): Promise<{ success: boolean; message: string; filePath: string }> {
  const dir =
    type === 'animation'
      ? resolve(SESSIONS_DIR, sessionId, 'src', 'animations')
      : resolve(SESSIONS_DIR, sessionId, 'tests', 'animations');

  await fs.mkdir(dir, { recursive: true });
  const filePath = resolve(dir, `${className}${type === 'test' ? '.test' : ''}.ts`);

  try {
    await fs.writeFile(filePath, code);
    return {
      success: true,
      message: `File ${path.basename(filePath)} saved successfully.`,
      filePath,
    };
  } catch (error: any) {
    return { success: false, message: `Error saving file: ${error.message}`, filePath };
  }
}

function run_tests(sessionId: string, className: string): Promise<string> {
  return new Promise((promiseResolve) => {
    const testFilePath = resolve(
      SESSIONS_DIR,
      sessionId,
      'tests',
      'animations',
      `${className}.test.ts`,
    );
    // The test file imports from 'pixi-animation-library/...'
    // The vitest.config.ts in the root of the project defines this alias.
    // We need to run vitest from the root for it to pick up the config.
    const command = `npx vitest run "${testFilePath}" --root "${ROOT_DIR}"`;

    exec(command, (error, stdout, stderr) => {
      if (error) {
        promiseResolve(
          `Tests failed for ${className}:\n\nSTDOUT:\n${stdout}\n\nSTDERR:\n${stderr}`,
        );
        return;
      }
      if (stderr) {
        promiseResolve(
          `Tests completed for ${className} (with warnings):\n\nSTDOUT:\n${stdout}\n\nSTDERR:\n${stderr}`,
        );
        return;
      }
      promiseResolve(`Tests passed successfully for ${className}!\n\n${stdout}`);
    });
  });
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

  server.post('/api/chat', async (request, reply) => {
    try {
      const body = request.body as any;
      const { prompt } = body as { prompt: string };
      let { sessionId } = body as { sessionId?: string };

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

      const processFunctionCalls = async (response: any, sessionId: string) => {
        const functionCalls = response.functionCalls?.();

        if (functionCalls && functionCalls.length > 0) {
          const call = functionCalls[0];
          let toolResponse;

          server.log.info(`Executing tool call: ${call.name}`);

          switch (call.name) {
            case 'get_allowed_files': {
              toolResponse = await get_allowed_files();
              break;
            }
            case 'read_file': {
              toolResponse = await read_file(call.args.filepath);
              break;
            }
            case 'create_animation_file': {
              const createAnimResult = await write_file(
                sessionId,
                'animation',
                call.args.className,
                call.args.code,
              );
              toolResponse = createAnimResult.message;
              break;
            }
            case 'create_test_file': {
              const createTestResult = await write_file(
                sessionId,
                'test',
                call.args.className,
                call.args.code,
              );
              toolResponse = createTestResult.message;
              break;
            }
            case 'update_animation_file': {
              const updateAnimResult = await write_file(
                sessionId,
                'animation',
                call.args.className,
                call.args.code,
              );
              toolResponse = updateAnimResult.message;
              break;
            }
            case 'update_test_file': {
              const updateTestResult = await write_file(
                sessionId,
                'test',
                call.args.className,
                call.args.code,
              );
              toolResponse = updateTestResult.message;
              break;
            }
            case 'run_tests': {
              toolResponse = await run_tests(sessionId, call.args.className);
              break;
            }
            default: {
              toolResponse = `Unknown tool: ${call.name}`;
            }
          }

          const result = await chat.sendMessage(
            JSON.stringify({
              functionResponse: {
                name: call.name,
                response: {
                  content: toolResponse,
                },
              },
            }),
          );

          return result.response.text();
        }
        return response.text();
      };

      const firstResult = await chat.sendMessage(prompt);
      const firstResponse = firstResult.response;

      const responseText = await processFunctionCalls(firstResponse, sessionId);

      chatHistory.push({ role: 'user', parts: [{ text: prompt }] });
      chatHistory.push({ role: 'model', parts: [{ text: responseText }] });

      reply.send({ response: responseText, sessionId });
    } catch (error: any) {
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

  server.get('/*', (req, reply) => {
    reply.html();
  });

  await server.vite.ready();
  await server.listen({ port: 3000 });
}

main();
