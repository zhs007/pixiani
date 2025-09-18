import { describe, it, expect } from 'vitest';

// A lightweight pure function that simulates how we assemble streamed chunks and detect truncation.
// (In server.ts the logic is intertwined with network + retries; here we just validate the core conditions.)

type StreamEvent = { text?: string; finishReason?: string | null };

interface ProcessResult {
  fullText: string;
  truncated: boolean;
}

function processChunks(chunks: StreamEvent[], maxChars: number): ProcessResult {
  let full = '';
  let sizeCapped = false;
  for (const ch of chunks) {
    if (ch.text) {
      if (!sizeCapped) {
        full += ch.text;
        if (full.length > maxChars) {
          full = full.slice(0, maxChars);
          sizeCapped = true;
        }
      }
    }
    if (ch.finishReason) {
      return { fullText: full, truncated: sizeCapped || false };
    }
  }
  // No finishReason encountered => truncated (model ended unexpectedly)
  return { fullText: full, truncated: true };
}

describe('processChunks', () => {
  it('collects text and marks complete when finishReason present', () => {
    const events: StreamEvent[] = [{ text: 'Hello ' }, { text: 'World', finishReason: 'STOP' }];
    const res = processChunks(events, 1000);
    expect(res.fullText).toBe('Hello World');
    expect(res.truncated).toBe(false);
  });

  it('caps size and marks truncated when exceeding maxChars', () => {
    const events: StreamEvent[] = [
      { text: 'A'.repeat(10) },
      { text: 'B'.repeat(10), finishReason: 'STOP' },
    ];
    const res = processChunks(events, 15);
    expect(res.fullText.length).toBe(15);
    expect(res.truncated).toBe(true);
  });

  it('marks truncated when no finishReason emitted', () => {
    const events: StreamEvent[] = [{ text: 'Partial ' }, { text: 'Response ' }, { text: 'Only' }];
    const res = processChunks(events, 1000);
    expect(res.fullText).toBe('Partial Response Only');
    expect(res.truncated).toBe(true);
  });
});
