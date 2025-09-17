import { describe, it, expect, beforeAll } from 'vitest';
import { mkdir, writeFile, rm } from 'fs/promises';
import { resolve, dirname } from 'path';
import { publish_files } from '../server';
import crypto from 'crypto';

// Helper to create a fake session staging environment
async function setupSession(sessionId: string, className: string, code: string, testCode?: string) {
  const base = resolve(__dirname, '../../.sessions', sessionId, 'staging');
  const animDir = resolve(base, 'src', 'animations');
  const testDir = resolve(base, 'tests', 'animations');
  await mkdir(animDir, { recursive: true });
  await writeFile(resolve(animDir, `${className}.ts`), code, 'utf-8');
  if (testCode) {
    await mkdir(testDir, { recursive: true });
    await writeFile(resolve(testDir, `${className}.test.ts`), testCode, 'utf-8');
  }
}

describe('publish_files duplicate detection', () => {
  const sessionId = `sess_${crypto.randomUUID()}`;
  const className = 'HashDuplicateAnim';
  const code = 'export class HashDuplicateAnim {}';
  const testCode = "import { describe,it,expect } from 'vitest'; describe('HashDuplicateAnim', ()=> it('exists', ()=> expect(1).toBe(1)));";

  it('skips second publish when content unchanged', async () => {
    await setupSession(sessionId, className, code, testCode);
    const first = await publish_files(sessionId, className);
    expect(first.success).toBe(true);
    expect(first.mode === 'published' || first.mode === 'overwritten' || first.mode === 'kept').toBe(true);

    // Recreate identical staging files
    await setupSession(sessionId, className, code, testCode);
    const second = await publish_files(sessionId, className);
    expect(second.mode).toBe('skipped_duplicate');
    expect(second.skippedReason).toBe('duplicate_hash_match');
  });
});
