import 'dotenv/config';
import Fastify from 'fastify';
import fastifyVite from '@fastify/vite';
import fastifyStatic from '@fastify/static';
import { ProxyAgent, setGlobalDispatcher } from 'undici';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, HarmCategory, HarmBlockThreshold, type SafetySetting } from '@google/genai';
import { readFileSync, promises as fs, createWriteStream } from 'fs';
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
// Track the last failed (non-transient) tool call per session for manual retry
const lastFailedTool: Map<string, { name: string; args: any; error: string }> = new Map();

// --- Gemini AI Configuration ---
const API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

if (!API_KEY) {
  console.error('FATAL: GEMINI_API_KEY environment variable is not set.');
  process.exit(1);
}

const genAI = new GoogleGenAI({ apiKey: API_KEY });

const SYSTEM_INSTRUCTION_PATH =
  process.env.SYSTEM_INSTRUCTION_PATH || resolve(__dirname, 'prompts', 'system.md');

let systemInstruction: string;
try {
  systemInstruction = readFileSync(SYSTEM_INSTRUCTION_PATH, 'utf-8');
  console.log(`[editor] Loaded system instruction from: ${SYSTEM_INSTRUCTION_PATH}`);
} catch (e: any) {
  console.error(
    `FATAL: Could not load system instruction from ${SYSTEM_INSTRUCTION_PATH}: ${e.message}`,
  );
  process.exit(1);
}

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

// --- Agent continuation & network retry controls ---
// CONTINUE_TIMEOUT_MS: inactivity timeout for a single streaming turn (ms)
// CONTINUE_RETRIES: how many continuation turns (auto 'Continue') for truncated responses
// GENAI_NETWORK_RETRIES: how many times to retry the initial network call to Gemini on network-level failures
// GENAI_NETWORK_BACKOFF_MS: base backoff in ms (exponential  * 2^attempt, capped)
const CONTINUE_TIMEOUT_MS = Number(process.env.AGENT_CONTINUE_TIMEOUT_MS ?? 30000);
const CONTINUE_RETRIES = Number(process.env.AGENT_CONTINUE_RETRIES ?? 1);
const GENAI_NETWORK_RETRIES = Number(process.env.GENAI_NETWORK_RETRIES ?? 2); // default a bit higher than continuation
const GENAI_NETWORK_BACKOFF_MS = Number(process.env.GENAI_NETWORK_BACKOFF_MS ?? 800);
// --- Streaming enhancement environment variables ---
// Environment feature flags / tuning knobs for streaming robustness:
// ENABLE_STREAM_DELTA: when '1', emit incremental { type: 'delta', text } events for partial model output.
// HEARTBEAT_INTERVAL_MS: interval for sending { type: 'heartbeat', phase: 'streaming' } while a stream is active (0 disables).
// MAX_RESPONSE_CHARS: safety cap to prevent runaway responses; once exceeded we stop appending and mark sizeCapped.
// INCOMPLETE_RETRY_LIMIT: if the final turn ends truncated (no finishReason or size cap) and no tool call, auto-inject a CONTINUE turn up to this many times.
const ENABLE_STREAM_DELTA = (process.env.ENABLE_STREAM_DELTA ?? '1') === '1';
const HEARTBEAT_INTERVAL_MS = Number(process.env.HEARTBEAT_INTERVAL_MS ?? 10000);
const MAX_RESPONSE_CHARS = Number(process.env.MAX_RESPONSE_CHARS ?? 200000);
const INCOMPLETE_RETRY_LIMIT = Number(process.env.INCOMPLETE_RETRY_LIMIT ?? 1);
// Keep the SSE connection alive even when there's no active model stream (e.g., during long tool runs)
const KEEPALIVE_INTERVAL_MS = Number(process.env.KEEPALIVE_INTERVAL_MS ?? 15000);
// Whether to expose model internal reasoning/thought parts over SSE (debug only)
const EXPOSE_MODEL_THOUGHTS = process.env.EXPOSE_MODEL_THOUGHTS === '1';
// GENAI_NETWORK_RETRIES / GENAI_NETWORK_BACKOFF_MS are defined below with continuation controls but referenced here for clarity:
//   GENAI_NETWORK_RETRIES: how many additional attempts (besides the first) for initial model stream connection on transient network failures.
//   GENAI_NETWORK_BACKOFF_MS: base delay for exponential backoff (capped at 6000ms).

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
  try {
    const allowedFilesPath = resolve(__dirname, 'allowed_files.json');
    const fileContent = await fs.readFile(allowedFilesPath, 'utf-8');
    if (sessionId) {
      try {
        // We log the whole object so the agent can see descriptions
        await logToolCall(sessionId, 'get_allowed_files', {}, { result: JSON.parse(fileContent) });
      } catch {}
    }
    return fileContent;
  } catch (e: any) {
    const errorMessage = `Error reading allowed files list: ${e.message}`;
    console.error(`[${sessionId}] ${errorMessage}`);
    if (sessionId) {
      try {
        await logToolCall(sessionId, 'get_allowed_files', {}, { error: e.message });
      } catch {}
    }
    // Return a structured error in JSON format
    return JSON.stringify({
      error: 'Could not retrieve the list of allowed files.',
      details: e.message,
    });
  }
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
): Promise<{ success: boolean; finalPath?: string; mode?: string; skippedReason?: string }> {
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

    // Duplicate detection: if final exists AND staging exists, compare hashes and skip if identical
    let duplicate = false;
    let combinedHashStaging: string | null = null;
    let combinedHashFinal: string | null = null;
    if (haveStagingSrc && haveFinalSrc) {
      try {
        const stagingSrc = await fs.readFile(stagingSrcPath, 'utf-8');
        const finalSrc = await fs.readFile(finalSrcPath, 'utf-8');
        const stagingTest = haveStagingTest
          ? await fs.readFile(stagingTestPath, 'utf-8')
          : '';
        const finalTest = haveFinalTest ? await fs.readFile(finalTestPath, 'utf-8') : '';
        const hash = (data: string) =>
          crypto.createHash('sha256').update(data, 'utf8').digest('hex');
        combinedHashStaging = hash(stagingSrc + '||' + stagingTest);
        combinedHashFinal = hash(finalSrc + '||' + finalTest);
        if (combinedHashStaging === combinedHashFinal) {
          duplicate = true;
          console.warn(
            `[${sessionId}] Skipping publish for ${className}: identical content hash ${combinedHashStaging}`,
          );
        }
      } catch (e: any) {
        console.warn(
          `[${sessionId}] Hash comparison failed for ${className}, proceeding with publish: ${e.message}`,
        );
      }
    }

    if (!duplicate) {
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

    const mode = duplicate
      ? 'skipped_duplicate'
      : haveStagingSrc && haveFinalSrc
        ? 'overwritten'
        : haveStagingSrc
          ? 'published'
          : 'kept';
    if (duplicate) {
      logPayload.skippedReason = 'duplicate_hash_match';
    }
    console.warn(
      `[${sessionId}] ${duplicate ? 'Skip publish (duplicate)' : 'Published files'} for ${className} (src ${mode})${testWasMissing ? ' (animation only, no test updated)' : ''}`,
    );
    try {
      await logToolCall(sessionId, 'publish_files', { className }, { ...logPayload, mode });
    } catch {}
    return { success: !duplicate || duplicate, finalPath: finalSrcPath, mode, skippedReason: logPayload.skippedReason };
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

  // JSON endpoint for retry_last_tool moved outside /api/chat (kept for compatibility)

    // --- Main async logic ---
    const run = async () => {
      let sessionId: string;
      let idleTimeout: NodeJS.Timeout | undefined;
      let shouldCloseSse = false; // whether to end SSE in finally
      let keepaliveTimer: NodeJS.Timeout | null = null;

      const writeEvent = (data: object) => {
        try {
          reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
          resetIdleTimeout();
        } catch (e: any) {
          // If client disconnected, end quietly
          request.log.warn({ err: e }, 'SSE write failed; closing connection');
          try { reply.raw.end(); } catch {}
        }
      };

      const resetIdleTimeout = () => {
        if (idleTimeout) clearTimeout(idleTimeout);
        idleTimeout = setTimeout(() => {
          const error = new Error(
            `Timeout: No data received for ${CONTINUE_TIMEOUT_MS}ms. Closing connection.`,
          );
          server.log.warn(`[${sessionId}] ${error.message}`);
          writeEvent({ type: 'error', message: error.message, terminal: true });
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
        // Start connection-level keepalive so proxies/browsers don't drop idle SSE
        if (KEEPALIVE_INTERVAL_MS > 0) {
          if (keepaliveTimer) clearInterval(keepaliveTimer);
          keepaliveTimer = setInterval(() => {
            writeEvent({ type: 'keepalive', ts: Date.now() });
          }, KEEPALIVE_INTERVAL_MS);
        }

        const chatHistory = sessions.get(sessionId)!;
        chatHistory.push({ role: 'user', parts: [{ text: prompt }] });

        const openStreamWithRetry = async () => {
          const attempts = Number.isFinite(GENAI_NETWORK_RETRIES)
            ? Math.max(1, GENAI_NETWORK_RETRIES + 1)
            : 1;
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
                // Only retry on network/system transient errors. Heuristic: message contains 'fetch failed' or is a TypeError.
                const msg = e?.message || String(e);
                const transient = /fetch failed|ENOTFOUND|ECONNRESET|ETIMEDOUT|EAI_AGAIN/i.test(msg) ||
                  e?.name === 'TypeError';
                server.log.warn(
                  `[${sessionId}] generateContentStream failed (attempt ${attempt + 1}/${attempts}): ${msg} (transient=${transient})`,
                );
                if (!transient) break; // don't keep retrying on non-network errors
                if (attempt < attempts - 1) {
                  const waitMs = Math.min(
                    GENAI_NETWORK_BACKOFF_MS * Math.pow(2, attempt),
                    6000,
                  );
                  await new Promise((r) => setTimeout(r, waitMs));
                }
              }
            }
          throw lastErr;
        };

        let stream;
        try {
          stream = await openStreamWithRetry();
        } catch (netErr: any) {
          const msg = `Network error: ${netErr?.message || netErr}`;
          server.log.error(`[${sessionId}] ${msg}`);
          writeEvent({ type: 'error', message: msg, terminal: true });
          shouldCloseSse = true;
          // Cannot start streaming; exit and let finally close SSE
          return;
        }

  const MAX_STEPS = Number(process.env.AGENT_MAX_STEPS ?? 10);
        let incompleteRetries = 0; // count of auto retries for truncated final responses
        for (let i = 0; i < MAX_STEPS; i++) {
          let aggregatedResponse: any = null;
          let functionCalls: any[] = [];
          let fullText = '';
          let chunkIndex = 0;
          let sawFinish = false;
          let sizeCapped = false;
          let heartbeatTimer: NodeJS.Timeout | null = null;

          const startHeartbeat = () => {
            if (HEARTBEAT_INTERVAL_MS > 0) {
              if (heartbeatTimer) clearInterval(heartbeatTimer);
              heartbeatTimer = setInterval(() => {
                writeEvent({ type: 'heartbeat', phase: 'streaming', ts: Date.now() });
              }, HEARTBEAT_INTERVAL_MS);
            }
          };
          const stopHeartbeat = () => {
            if (heartbeatTimer) {
              clearInterval(heartbeatTimer);
              heartbeatTimer = null;
            }
          };
          startHeartbeat();

          try {
            for await (const chunk of stream) {
              chunkIndex++;
              resetIdleTimeout(); // Reset timer on each received chunk

              // Aggregate text from all chunks
              if ((chunk as any).text && !sizeCapped) {
                const delta = (chunk as any).text as string;
                if (fullText.length + delta.length > MAX_RESPONSE_CHARS) {
                  const allowed = MAX_RESPONSE_CHARS - fullText.length;
                  if (allowed > 0) {
                    const partial = delta.slice(0, allowed);
                    fullText += partial;
                    if (ENABLE_STREAM_DELTA) writeEvent({ type: 'delta', text: partial });
                  }
                  sizeCapped = true;
                  writeEvent({ type: 'warning', reason: 'size_cap', maxChars: MAX_RESPONSE_CHARS });
                } else {
                  fullText += delta;
                  if (ENABLE_STREAM_DELTA) writeEvent({ type: 'delta', text: delta });
                }
              }

              // Track finishReason if exposed by the SDK (defensive)
              const candidates: any[] | undefined = (chunk as any).candidates;
              if (candidates && candidates.some((c) => c?.finishReason)) {
                sawFinish = true;
              }

              // Optional: parse candidate content parts for thought / reasoning structures
              if (EXPOSE_MODEL_THOUGHTS && candidates) {
                try {
                  for (const cand of candidates) {
                    const parts = cand?.content?.parts;
                    if (Array.isArray(parts)) {
                      for (const p of parts) {
                        // Different SDK versions may name these differently
                        const thoughtText = p?.thought || p?.thoughtSignature || p?.reasoning;
                        if (typeof thoughtText === 'string' && thoughtText.trim()) {
                          writeEvent({ type: 'model_thought', text: thoughtText });
                          try {
                            await logWorkflow(sessionId, 'model_thought', { text: thoughtText });
                          } catch {}
                        }
                      }
                    }
                  }
                } catch (e: any) {
                  server.log.debug(`[${sessionId}] Failed to parse model thoughts: ${e?.message || e}`);
                }
              }

              // The last chunk contains other useful details like function calls
              aggregatedResponse = chunk;

              // Collect function calls
              if (Array.isArray((chunk as any).functionCalls)) {
                functionCalls.push(...(chunk as any).functionCalls);
              }
            }
          } catch (streamErr: any) {
            // Stream broke mid-way; log partial info and decide whether to retry
            server.log.error(
              {
                err: streamErr,
                sessionId,
                chunkIndex,
                partialTail: fullText.slice(-300),
              },
              'Stream error while reading model response',
            );
            await logWorkflow(sessionId, 'stream_error', {
              message: streamErr?.message || String(streamErr),
              chunkIndex,
              partialTail: fullText.slice(-300),
            });
            // If we have no aggregatedResponse at all, escalate as fatal for this turn
            if (!aggregatedResponse) {
              throw new Error(
                `Model stream aborted before any complete chunk (chunks=${chunkIndex}): ${streamErr?.message || streamErr}`,
              );
            }
          }
          stopHeartbeat();

          const finalResponse = aggregatedResponse;

          if (!finalResponse) {
            throw new Error('Received no response from model stream (empty aggregatedResponse).');
          }

          if (!sawFinish) {
            await logWorkflow(sessionId, 'stream_incomplete_warning', {
              note: 'No finishReason detected; response may be truncated.',
              textLen: fullText.length,
            });
            server.log.warn(
              `[${sessionId}] Stream ended without explicit finishReason (possible truncation).`,
            );
          }

          // After the stream ends, check if we have any function calls.
          if (functionCalls.length === 0) {
            const truncated = !sawFinish || sizeCapped;
            await logWorkflow(sessionId, 'final_response', {
              text: fullText,
              truncated: truncated || undefined,
              sizeCapped: sizeCapped || undefined,
            });
            writeEvent({
              type: 'final_response',
              text: fullText,
              truncated: truncated || undefined,
              sizeCapped: sizeCapped || undefined,
            });
            chatHistory.push({ role: 'model', parts: [{ text: fullText }] });
            // Auto retry logic if truncated and we still have budget
            if (truncated && incompleteRetries < INCOMPLETE_RETRY_LIMIT) {
              incompleteRetries++;
              server.log.warn(
                `[${sessionId}] Auto-retrying truncated final response (retry ${incompleteRetries}/${INCOMPLETE_RETRY_LIMIT}).`,
              );
              await logWorkflow(sessionId, 'auto_retry_truncated', {
                attempt: incompleteRetries,
                max: INCOMPLETE_RETRY_LIMIT,
              });
              // Add a synthetic user turn prompting continuation
              chatHistory.push({ role: 'user', parts: [{ text: 'CONTINUE' }] });
              stream = await openStreamWithRetry();
              continue; // proceed to next loop iteration
            }
            // NEW: If we received absolutely no text on first loop (i === 0) and no tool calls,
            // treat this as an abnormal empty response and attempt one forced continuation.
            if (!fullText.trim() && i === 0 && incompleteRetries < INCOMPLETE_RETRY_LIMIT) {
              incompleteRetries++;
              server.log.warn(
                `[${sessionId}] Empty initial response with no tool calls; forcing one auto-continue (attempt ${incompleteRetries}/${INCOMPLETE_RETRY_LIMIT}).`,
              );
              await logWorkflow(sessionId, 'auto_retry_empty_initial', {
                attempt: incompleteRetries,
                max: INCOMPLETE_RETRY_LIMIT,
              });
              chatHistory.push({
                role: 'user',
                parts: [
                  {
                    text:
                      'SYSTEM_HINT: Provide at least one tool call (get_allowed_files + read_file of BaseAnimate) then proceed with TDD steps.',
                  },
                ],
              });
              stream = await openStreamWithRetry();
              continue;
            }
            return; // End of loop (done)
          }

          // If there are function calls but no plain text produced, send a model_note
          if (!fullText.trim()) {
            writeEvent({
              type: 'model_note',
              note: 'Model produced no direct text this turn; proceeding directly with tool call.',
            });
          }

          const call = functionCalls[0]; // Assuming one tool call at a time for now
          server.log.info(`[${sessionId}] Executing tool call: ${call.name}`, call.args);
          writeEvent({ type: 'tool_call', name: call.name, args: call.args });

          const transientPattern = /ENOENT|EACCES|EBUSY|ECONNRESET|ETIMEDOUT|EAI_AGAIN|fetch failed|timeout|Too many open files/i;
          const MAX_TOOL_RETRIES = 2;

          const executeToolOnce = async (toolName: string, args: any): Promise<string> => {
            switch (toolName) {
              case 'get_allowed_files':
                return await get_allowed_files(sessionId);
              case 'read_file':
                return await read_file(args.filepath, sessionId);
              case 'create_animation_file': {
                const res = await write_file(sessionId, 'animation', args.className, args.code);
                return res.message;
              }
              case 'create_test_file': {
                const res = await write_file(sessionId, 'test', args.className, args.code);
                return res.message;
              }
              case 'update_animation_file': {
                const res = await write_file(sessionId, 'animation', args.className, args.code);
                return res.message;
              }
              case 'update_test_file': {
                const res = await write_file(sessionId, 'test', args.className, args.code);
                return res.message;
              }
              case 'run_tests':
                return await run_tests(sessionId, args.className);
              case 'publish_files': {
                const res = await publish_files(sessionId, args.className);
                if (!res.success) {
                  writeEvent({ type: 'error', message: `发布失败：${args.className}` });
                }
                return res.success
                  ? `Published ${args.className} successfully.`
                  : `Failed to publish ${args.className}.`;
              }
              default:
                return `Unknown tool: ${toolName}`;
            }
          };

          const executeToolWithRetry = async (toolName: string, args: any): Promise<string> => {
            let lastErr: any;
            for (let attempt = 0; attempt <= MAX_TOOL_RETRIES; attempt++) {
              try {
                const out = await executeToolOnce(toolName, args);
                if (attempt > 0) {
                  writeEvent({
                    type: 'tool_response',
                    name: toolName,
                    response: `Retry attempt ${attempt}: success.\n${out}`,
                  });
                }
                return out;
              } catch (e: any) {
                lastErr = e;
                const msg = e?.message || String(e);
                const transient = transientPattern.test(msg);
                if (transient && attempt < MAX_TOOL_RETRIES) {
                  writeEvent({
                    type: 'tool_retry',
                    name: toolName,
                    attempt: attempt + 1,
                    max: MAX_TOOL_RETRIES + 1,
                    message: msg,
                  });
                  const waitMs = Math.min(500 * Math.pow(2, attempt), 4000);
                  await new Promise((r) => setTimeout(r, waitMs));
                  continue;
                }
                // Non-transient or exhausted retries
                // Build heuristic suggestions for user / model assistance
                const suggestions: string[] = [];
                if (/ENOENT/i.test(msg)) {
                  suggestions.push('File not found: verify the filepath passed to the tool matches an allowed file path.');
                }
                if (/EACCES|permission denied/i.test(msg)) {
                  suggestions.push('Permission issue: ensure the file is writable and not locked by another process.');
                }
                if (/ECONNRESET|fetch failed|network|ETIMEDOUT/i.test(msg)) {
                  suggestions.push('Transient network issue: retry the tool or wait a moment before re-running.');
                }
                if (/TypeError/i.test(msg)) {
                  suggestions.push('TypeError: check that the generated code compiles and all imports resolve correctly.');
                }
                if (/SyntaxError|Unexpected token/i.test(msg)) {
                  suggestions.push('Syntax error: re-run read_file on the affected source to inspect and correct malformed code.');
                }
                if (toolName === 'run_tests' && /fail/i.test(msg)) {
                  suggestions.push('Tests failed: read failing assertion messages and update the animation or test file accordingly before retrying.');
                }
                if (toolName === 'publish_files' && /missing/i.test(msg)) {
                  suggestions.push('Publish failed due to missing source: ensure create/update_animation_file was called successfully first.');
                }
                if (toolName === 'publish_files' && /duplicate/i.test(msg)) {
                  suggestions.push('Publish skipped (duplicate): no code changes detected; proceed or modify code before re-publishing.');
                }
                writeEvent({
                  type: 'tool_error',
                  name: toolName,
                  attempt: attempt + 1,
                  max: MAX_TOOL_RETRIES + 1,
                  transient,
                  message: msg,
                  suggestions: suggestions.length ? suggestions : undefined,
                });
                if (!transient) {
                  lastFailedTool.set(sessionId, { name: toolName, args, error: msg });
                }
                throw e;
              }
            }
            throw lastErr;
          };

          let toolResponseContent: string;
          try {
            toolResponseContent = await executeToolWithRetry(call.name, call.args);
          } catch (toolErr: any) {
            // Abort this turn: push a minimal function response so model can react
            const errMsg = toolErr?.message || String(toolErr);
            chatHistory.push({
              role: 'function',
              parts: [
                {
                  functionResponse: {
                    name: call.name,
                    response: { error: errMsg },
                  },
                },
              ],
            });
            await logWorkflow(sessionId, 'tool_error', { tool: call.name, message: errMsg });
            // Continue loop to let model decide (it may attempt fix)
            const contStart = Date.now();
            await logWorkflow(sessionId, 'model_continue_start', { reason: 'tool_error' });
            writeEvent({ type: 'heartbeat', phase: 'model_continue_start' });
            stream = await openStreamWithRetry();
            continue;
          }

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
                terminal: false,
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
            // Inform client that the workflow halted due to max steps and allow explicit continuation
            writeEvent({ type: 'workflow_halt', reason: 'max_steps', maxSteps: MAX_STEPS, terminal: false });
            server.log.warn(`[${sessionId}] Workflow terminated due to exceeding max steps.`);
            // Keep SSE open for the client to decide next action (e.g., send CONTINUE via new turn)
            continue;
          }
        }
      } catch (error: any) {
        server.log.error(error, 'Error processing chat stream');
        writeEvent({ type: 'error', message: `An unexpected error occurred: ${error.message}`, terminal: true });
        shouldCloseSse = true;
      } finally {
        if (idleTimeout) clearTimeout(idleTimeout);
        // Clear connection keepalive if set
        try { if (keepaliveTimer) clearInterval(keepaliveTimer); } catch {}
        if (shouldCloseSse) reply.raw.end();
      }
    };
    run();
  });
  // --- Outside of /api/chat route: endpoints for retrying last tool ---
  // JSON variant (backwards compatibility)
  server.post('/api/retry_last_tool', async (request, reply) => {
    try {
      const body = (request as any).body || {};
      const { sessionId } = body;
      if (!sessionId) return reply.code(400).send({ error: 'sessionId required' });
      const failed = lastFailedTool.get(sessionId);
      if (!failed) return reply.code(404).send({ error: 'No failed tool to retry' });
      const chatHistory = sessions.get(sessionId);
      if (!chatHistory) return reply.code(404).send({ error: 'Unknown session' });
      const output = await (async () => {
        switch (failed.name) {
          case 'get_allowed_files':
            return await get_allowed_files(sessionId);
          case 'read_file':
            return await read_file(failed.args.filepath, sessionId);
          case 'create_animation_file': {
            const res = await write_file(
              sessionId,
              'animation',
              failed.args.className,
              failed.args.code,
            );
            return res.message;
          }
          case 'create_test_file': {
            const res = await write_file(sessionId, 'test', failed.args.className, failed.args.code);
            return res.message;
          }
          case 'update_animation_file': {
            const res = await write_file(
              sessionId,
              'animation',
              failed.args.className,
              failed.args.code,
            );
            return res.message;
          }
          case 'update_test_file': {
            const res = await write_file(sessionId, 'test', failed.args.className, failed.args.code);
            return res.message;
          }
          case 'run_tests':
            return await run_tests(sessionId, failed.args.className);
          case 'publish_files': {
            const res = await publish_files(sessionId, failed.args.className);
            return res.success
              ? `Published ${failed.args.className} successfully.`
              : `Failed to publish ${failed.args.className}.`;
          }
          default:
            return `Unknown tool: ${failed.name}`;
        }
      })();
      chatHistory.push({
        role: 'model',
        parts: [{ functionCall: { name: failed.name, args: failed.args } }],
      });
      chatHistory.push({
        role: 'function',
        parts: [
          { functionResponse: { name: failed.name, response: { content: output } } },
        ],
      });
      lastFailedTool.delete(sessionId);
      return reply.send({ success: true, output });
    } catch (e: any) {
      return reply.code(500).send({ success: false, error: e?.message || String(e) });
    }
  });

  // SSE streaming variant
  server.get('/api/retry_last_tool_stream', async (request, reply) => {
    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    const writeEvent = (data: object) => reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
    try {
      const { sessionId } = request.query as any;
      if (!sessionId) {
        writeEvent({ type: 'error', message: 'sessionId required', terminal: true });
        return reply.raw.end();
      }
      const failed = lastFailedTool.get(sessionId);
      if (!failed) {
        writeEvent({ type: 'error', message: 'No failed tool to retry', terminal: true });
        return reply.raw.end();
      }
      const chatHistory = sessions.get(sessionId);
      if (!chatHistory) {
        writeEvent({ type: 'error', message: 'Unknown session', terminal: true });
        return reply.raw.end();
      }
      writeEvent({ type: 'tool_call', name: failed.name, args: failed.args });
      try {
        const output = await (async () => {
          switch (failed.name) {
            case 'get_allowed_files':
              return await get_allowed_files(sessionId);
            case 'read_file':
              return await read_file(failed.args.filepath, sessionId);
            case 'create_animation_file': {
              const res = await write_file(
                sessionId,
                'animation',
                failed.args.className,
                failed.args.code,
              );
              return res.message;
            }
            case 'create_test_file': {
              const res = await write_file(
                sessionId,
                'test',
                failed.args.className,
                failed.args.code,
              );
              return res.message;
            }
            case 'update_animation_file': {
              const res = await write_file(
                sessionId,
                'animation',
                failed.args.className,
                failed.args.code,
              );
              return res.message;
            }
            case 'update_test_file': {
              const res = await write_file(
                sessionId,
                'test',
                failed.args.className,
                failed.args.code,
              );
              return res.message;
            }
            case 'run_tests':
              return await run_tests(sessionId, failed.args.className);
            case 'publish_files': {
              const res = await publish_files(sessionId, failed.args.className);
              return res.success
                ? `Published ${failed.args.className} successfully.`
                : `Failed to publish ${failed.args.className}.`;
            }
            default:
              return `Unknown tool: ${failed.name}`;
          }
        })();
        writeEvent({ type: 'tool_response', name: failed.name, response: output });
        chatHistory.push({
          role: 'model',
          parts: [{ functionCall: { name: failed.name, args: failed.args } }],
        });
        chatHistory.push({
          role: 'function',
          parts: [
            { functionResponse: { name: failed.name, response: { content: output } } },
          ],
        });
        lastFailedTool.delete(sessionId);
        writeEvent({ type: 'retry_complete' });
      } catch (e: any) {
        writeEvent({ type: 'tool_error', name: failed.name, message: e?.message || String(e) });
      } finally {
        reply.raw.end();
      }
    } catch (e: any) {
      writeEvent({ type: 'error', message: e?.message || String(e), terminal: true });
      reply.raw.end();
    }
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

  // Read host and port from environment variables so the server can be configured
  // by the deployment or dev environment. Priority:
  // 1. EDITOR_HOST / EDITOR_PORT (explicit for this app)
  // 2. HOST / PORT (generic)
  // 3. fallback defaults: 0.0.0.0:3000
  const HOST = process.env.EDITOR_HOST || process.env.HOST || '0.0.0.0';
  const PORT = Number(process.env.EDITOR_PORT || process.env.PORT || 3000);

  if (Number.isNaN(PORT) || PORT <= 0 || PORT > 65535) {
    server.log.error(
      `Invalid port number provided: ${process.env.EDITOR_PORT || process.env.PORT}`,
    );
    process.exit(1);
  }

  server.log.info(`[editor] Listening on ${HOST}:${PORT}`);
  await server.listen({ port: PORT, host: HOST });
}

// Export functions for testing (publish_files duplicate detection)
export { publish_files };

if (import.meta.url === `file://${__filename}`) {
  // Only auto-run main when executed directly, not when imported for tests
  main();
}
