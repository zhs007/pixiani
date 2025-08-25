import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScaleAnimation } from '../../src/animations/ScaleAnimation';
import { BaseObject } from '../../src/core/BaseObject';
import * as PIXI from 'pixi.js';

describe('ScaleAnimation', () => {
    let baseObject: BaseObject;
    let sprite: PIXI.Sprite;
    let animation: ScaleAnimation;

    beforeEach(() => {
        baseObject = new BaseObject();
        // Mock sprite has a scale property just like a real PIXI.Sprite
        sprite = {
            scale: {
                x: 1.0,
                y: 1.0,
                set: function(x: number, y?: number) {
                    this.x = x;
                    this.y = y ?? x;
                }
            }
        } as PIXI.Sprite;

        animation = new ScaleAnimation(baseObject, [sprite]);
        animation.play();
    });

    it('should have correct static properties', () => {
        expect(ScaleAnimation.animationName).toBe('Scale');
        expect(ScaleAnimation.getRequiredSpriteCount()).toBe(1);
    });

    it('should throw an error if not provided with enough sprites', () => {
        // The check is in the BaseAnimate constructor, so we test it here.
        expect(() => new ScaleAnimation(baseObject, [])).toThrow('Animation "Scale" requires at least 1 sprites, but got 0.');
    });

    it('should correctly calculate scale at 0.5 seconds', () => {
        animation.update(0.5);
        // Progress = 0.5 / 1.0 = 0.5. Scale = 1.0 - 0.5 * 0.5 = 0.75
        expect(sprite.scale.x).toBeCloseTo(0.75);
    });

    it('should correctly calculate scale at 1.0 second (midpoint)', () => {
        animation.update(1.0);
        // Progress = 1.0 / 1.0 = 1.0. Scale = 1.0 - 0.5 * 1.0 = 0.5
        expect(sprite.scale.x).toBeCloseTo(0.5);
    });

    it('should correctly calculate scale at 1.5 seconds', () => {
        animation.update(1.5);
        // Progress = (1.5 - 1.0) / 1.0 = 0.5. Scale = 0.5 + 0.5 * 0.5 = 0.75
        expect(sprite.scale.x).toBeCloseTo(0.75);
    });

    it('should loop and reset scale to 1.0 at 2.0 seconds', () => {
        animation.update(2.0);
        // The loop logic should set the scale directly to 1.0
        expect(sprite.scale.x).toBe(1.0);
        // The elapsed time should be reset by the loop
        expect((animation as any).elapsedTime).toBeCloseTo(0);
    });

    it('should handle deltaTime values larger than the duration', () => {
        animation.update(2.5); // e.g., a long frame delta
        // The animation should complete one loop and be 0.5s into the next one.
        // Scale should be the same as if we just updated by 0.5s.
        expect(sprite.scale.x).toBeCloseTo(0.75);
    });

    it('should call onComplete callback after each full loop', () => {
        const onCompleteSpy = vi.fn();
        animation.onComplete = onCompleteSpy;

        animation.update(2.0);
        expect(onCompleteSpy).toHaveBeenCalledOnce();

        animation.update(2.0);
        expect(onCompleteSpy).toHaveBeenCalledTimes(2);
    });

    it('should stop playing and reset the sprite scale and time', () => {
        animation.update(0.5); // Change the scale
        expect(sprite.scale.x).not.toBe(1.0);

        animation.stop();

        expect(animation.isPlaying).toBe(false);
        expect((animation as any).elapsedTime).toBe(0);
        expect(sprite.scale.x).toBe(1.0); // Scale should be reset
    });

    it('should not update if it is not playing', () => {
        animation.pause(); // or stop()
        animation.update(0.5);
        // Scale should remain at its initial value
        expect(sprite.scale.x).toBe(1.0);
    });
});
