import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScaleAnimation } from '../../src/animations/ScaleAnimation';
import { BaseObject } from '@pixi-animation-library/pixiani-engine';
import * as PIXI from 'pixi.js';

const createMockSprite = () => ({
  scale: {
    x: 1.0,
    y: 1.0,
    set: function (x: number, y?: number) {
      this.x = x;
      this.y = y ?? x;
    },
  },
});

vi.mock('pixi.js', async () => {
  const actual = await vi.importActual('pixi.js');
  return {
    ...actual,
    Sprite: vi.fn().mockImplementation(() => createMockSprite()),
  };
});

describe('ScaleAnimation', () => {
  let baseObject: BaseObject;
  let sprite: PIXI.Sprite;
  let animation: ScaleAnimation;

  beforeEach(() => {
    vi.clearAllMocks();
    baseObject = new BaseObject();
    sprite = new PIXI.Sprite();
    animation = new ScaleAnimation(baseObject, [sprite]);
  });

  it('should have correct static properties', () => {
    expect(ScaleAnimation.animationName).toBe('Scale');
    expect(ScaleAnimation.getRequiredSpriteCount()).toBe(1);
  });

  it('should throw an error if not provided with enough sprites', () => {
    expect(() => new ScaleAnimation(baseObject, [])).toThrow();
  });

  it('should be in IDLE state initially', () => {
    expect(animation.state).toBe('IDLE');
  });

  it('should transition to PLAYING state and reset on play()', () => {
    (animation as any).elapsedTime = 1.0; // dirty the state
    animation.play();
    expect(animation.state).toBe('PLAYING');
    expect((animation as any).elapsedTime).toBe(0);
  });

  it('should correctly calculate scale during the animation', () => {
    animation.play();
    animation.update(0.5); // Progress = 0.5 / 1.0 = 0.5 -> Scale = 1.0 - 0.5 * 0.5 = 0.75
    expect(sprite.scale.x).toBeCloseTo(0.75);

    animation.update(0.5); // Elapsed = 1.0, Progress = 1.0 / 1.0 = 1.0 -> Scale = 0.5
    expect(sprite.scale.x).toBeCloseTo(0.5);

    animation.update(0.5); // Elapsed = 1.5, Progress = (1.5 - 1.0) / 1.0 = 0.5 -> Scale = 0.5 + 0.5 * 0.5 = 0.75
    expect(sprite.scale.x).toBeCloseTo(0.75);
  });

  it('should loop by default', () => {
    animation.play();
    animation.update(2.0);
    // Should have looped. State is back to PLAYING, time is reset.
    expect(animation.state).toBe('PLAYING');
    expect((animation as any).elapsedTime).toBe(0);
    // Scale is reset to 1.0 by the reset() call.
    expect(sprite.scale.x).toBe(1.0);
  });

  it('should not loop if loop is set to false', () => {
    animation.loop = false;
    animation.play();
    animation.update(2.0);
    // Should have ended.
    expect(animation.state).toBe('ENDED');
    // Final scale should be 1.0
    expect(sprite.scale.x).toBe(1.0);
  });

  it('should call onComplete callback when not looping', () => {
    const onCompleteSpy = vi.fn();
    animation.onComplete = onCompleteSpy;
    animation.loop = false;
    animation.play();

    animation.update(2.0);
    expect(onCompleteSpy).toHaveBeenCalledOnce();
    expect(animation.state).toBe('ENDED');
  });

  it('should not call onComplete callback when looping', () => {
    const onCompleteSpy = vi.fn();
    animation.onComplete = onCompleteSpy;
    animation.loop = true;
    animation.play();

    animation.update(2.0);
    expect(onCompleteSpy).not.toHaveBeenCalled();
    expect(animation.state).toBe('PLAYING');
  });

  it('should stop playing, reset, and set state to IDLE', () => {
    animation.play();
    animation.update(0.5);
    expect(sprite.scale.x).not.toBe(1.0);

    animation.stop();

    expect(animation.state).toBe('IDLE');
    expect((animation as any).elapsedTime).toBe(0);
    expect(sprite.scale.x).toBe(1.0);
  });

  it('should not update if not in PLAYING state', () => {
    animation.play();
    animation.update(0.5);
    expect(sprite.scale.x).toBeCloseTo(0.75);

    animation.pause();
    expect(animation.state).toBe('PAUSED');
    animation.update(0.5); // This should do nothing
    expect(sprite.scale.x).toBeCloseTo(0.75); // Should remain unchanged

    animation.stop();
    expect(animation.state).toBe('IDLE');
    animation.update(0.5); // This should also do nothing
    expect(sprite.scale.x).toBe(1.0); // stop() resets the scale
  });
});
