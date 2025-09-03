import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ParticleSpinAnimation } from '../../src/animations/ParticleSpinAnimation';
import { BaseObject } from '../../src/core/BaseObject';
import * as PIXI from 'pixi.js';

// Basic PIXI mocks
vi.mock('pixi.js', async () => {
  const actual = await vi.importActual('pixi.js');

  const Sprite = vi.fn().mockImplementation((texture?: any) => ({
    texture: texture ?? {},
    visible: true,
    x: 0,
    y: 0,
    destroy: vi.fn(),
  }));

  return {
    ...actual,
    Sprite,
  };
});

describe('ParticleSpinAnimation', () => {
  let object: BaseObject;
  let source: PIXI.Sprite;

  beforeEach(() => {
    vi.clearAllMocks();
    object = new BaseObject();
    vi.spyOn(object, 'addChild').mockImplementation((child) => child);
    vi.spyOn(object, 'removeChild').mockImplementation((child) => child);
    source = new PIXI.Sprite();
    (source as any).x = 100;
    (source as any).y = 100;
  });

  it('spawns particles and hides source on play', () => {
    const anim = new ParticleSpinAnimation(object, [source]);
    anim.play();

    // Source hidden
    expect(source.visible).toBe(false);
  });

  it('particles fall under gravity and bounce on the ground', () => {
    const anim: any = new ParticleSpinAnimation(object, [source]);
    anim.play();

    const p0 = anim.particles[0];
    const groundY = anim.GROUND_Y;
    // Force immediate spawn for determinism and enough remaining time
    anim.spawnDelays = anim.spawnDelays.map(() => 0);
    anim.active = anim.active.map(() => false);
    anim.elapsed = 0;

    // Activate and take one step; it should start falling
    anim.update(0.1);
    const yAfterFirstStep = p0.y;
    anim.update(0.1);
    expect(p0.y).toBeGreaterThan(yAfterFirstStep);

    // Advance until it reaches the ground (with a safety cap)
    let reached = false;
    for (let i = 0; i < 50; i++) {
      anim.update(0.1);
      if (p0.y >= groundY) {
        reached = true;
        break;
      }
    }
    expect(reached).toBe(true);
    expect(p0.y).toBeCloseTo(groundY, 0);

    // Next small step should bounce upward (y decreases)
    const yBefore = p0.y;
    anim.update(0.05);
    expect(p0.y).toBeLessThan(yBefore);
  });

  it('ends after duration and restores source on stop()', () => {
    const anim = new ParticleSpinAnimation(object, [source]);
    anim.play();

    anim.update(10.1); // beyond duration (now 10s)

    expect(anim.state).toBe('IDLE'); // stop() sets IDLE
    expect(source.visible).toBe(true);
  });
});
