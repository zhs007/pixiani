/* global process */
// Conditionally mock pixi.js only for agent session tests to avoid heavy mocking for repository tests.
// Triggered when run_tests sets SESSION_TESTS=1 in the environment.

import { vi } from 'vitest';

const isSession = process.env.SESSION_TESTS === '1';

if (isSession) {
  try {
    // Soft-mock: import actual pixi if available, but override minimal parts that cause issues.
    // If importing actual pixi fails in this environment, fall back to a light stub sufficient for tests.
    // @ts-ignore
    vi.mock('pixi.js', async () => {
      try {
        const actual = await vi.importActual<any>('pixi.js');
        // Patch objects that typically cause environment crashes; leave others intact.
        const SafeSprite = class {
          x = 0;
          y = 0;
          alpha = 1;
          rotation = 0;
          width = 0;
          height = 0;
          scale = {
            x: 1,
            y: 1,
            set: (v: number, yy?: number) => {
              if (typeof yy === 'number') {
                this.scale.x = v;
                this.scale.y = yy;
              } else {
                this.scale.x = v;
                this.scale.y = v;
              }
            },
          };
          anchor = { set: () => {} };
          visible = true;
        } as unknown as typeof actual.Sprite;

        const SafeContainer = class {} as unknown as typeof actual.Container;

        return {
          ...actual,
          Sprite: SafeSprite,
          Container: actual?.Container ?? SafeContainer,
        };
      } catch {
        // Fallback stub
        const Sprite = class {
          x = 0;
          y = 0;
          alpha = 1;
          rotation = 0;
          width = 0;
          height = 0;
          scale = {
            x: 1,
            y: 1,
            set: (v: number, yy?: number) => {
              if (typeof yy === 'number') {
                this.scale.x = v;
                this.scale.y = yy;
              } else {
                this.scale.x = v;
                this.scale.y = v;
              }
            },
          };
          anchor = { set: () => {} };
          visible = true;
        };
        const Container = class {};
        return { Sprite, Container };
      }
    });
  } catch {
    // If vi.mock fails for any reason, we leave it unmocked; tests might still fail but logging will capture it.
    // This block is intentionally empty.
  }
}
