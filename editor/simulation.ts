import puppeteer, { Browser, Page } from 'puppeteer';
import { createServer, ViteDevServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface VerificationResult {
  success: boolean;
  spyLogs: string[]; // Logs from SpySprite
  otherLogs: string[]; // General console logs for debugging
  errors: string[];
}

/**
 * Verifies a given animation by running it in a headless browser environment.
 * @param className The name of the animation class.
 * @param code The TypeScript source code of the animation.
 * @returns A promise that resolves to a VerificationResult object.
 */
export async function verifyAnimation(
  className: string,
  code: string,
): Promise<VerificationResult> {
  let server: ViteDevServer | null = null;
  let browser: Browser | null = null;
  const spyLogs: string[] = [];
  const otherLogs: string[] = [];
  const capturedErrors: string[] = [];

  try {
    // 1. Create a Vite server to serve the headless page
    server = await createServer({
      root: path.resolve(__dirname, '..'), // Project root
      logLevel: 'silent', // Keep console clean
      server: {
        port: 3001, // Use a dedicated port
        hmr: false, // Disable Hot Module Replacement
      },
    });
    await server.listen();
    const serverUrl = server.resolvedUrls?.local[0];
    if (!serverUrl) {
      throw new Error('Vite server did not start correctly.');
    }

    // 2. Transform the TypeScript code to JavaScript using Vite's engine
    // Vite's transformRequest API works best with real files to resolve imports correctly.
    // So, we write the AI-generated code to a temporary file, ask Vite to transform it,
    // and then immediately delete the temporary file.
    const tempFilePath = path.resolve(__dirname, `virtual_${className}.ts`);
    await import('fs/promises').then(fs => fs.writeFile(tempFilePath, code));

    const transformedResult = await server.transformRequest(tempFilePath);
    await import('fs/promises').then(fs => fs.unlink(tempFilePath)); // Clean up temp file

    if (!transformedResult || !transformedResult.code) {
      throw new Error(`Failed to transform animation code for "${className}" using Vite.`);
    }
    const jsCode = transformedResult.code;

    // 3. Launch Puppeteer
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'], // Required for some CI environments
    });
    const page = await browser.newPage();

    // 4. Capture console logs and errors from the page
    page.on('console', (msg) => {
      const text = msg.text();
      if (text.startsWith('[SPY]')) {
        spyLogs.push(text);
      } else {
        otherLogs.push(text);
        console.log(`[Headless Log]: ${text}`); // For debugging the verifier itself
      }
    });
    page.on('pageerror', (error) => {
      capturedErrors.push(error.message);
    });

    // 5. Navigate to the test page
    const pageUrl = `${serverUrl}editor/headless-template.html`;
    await page.goto(pageUrl);

    // 6. Inject and run the animation code
    await page.evaluate(
      (codeToRun, name) => {
        // This code runs in the browser's context
        window.runAnimation(codeToRun, name);
      },
      jsCode,
      className,
    );

    // 7. Wait for the animation to signal completion
    await page.waitForFunction('window.__animation_finished === true', {
      timeout: 10000, // 10s total timeout for the entire process
    });

    // 8. Collect any errors that were stored on the window object
    const finalErrors = await page.evaluate(() => window.__animation_errors);
    capturedErrors.push(...finalErrors);

    return {
      success: capturedErrors.length === 0,
      spyLogs,
      otherLogs,
      errors: capturedErrors,
    };
  } catch (error: any) {
    // This catches errors in the verification script itself (e.g., Puppeteer timeout)
    return {
      success: false,
      spyLogs,
      otherLogs,
      errors: [...capturedErrors, error.message],
    };
  } finally {
    // 9. Cleanup
    if (browser) await browser.close();
    if (server) await server.close();
  }
}
