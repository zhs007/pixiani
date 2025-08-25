import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FadeAnimation } from '../../src/animations/FadeAnimation';
import { BaseObject } from '../../src/core/BaseObject';
import * as PIXI from 'pixi.js';

// Mock PIXI.Sprite
vi.mock('pixi.js', async () => {
    const actual = await vi.importActual('pixi.js');
    return {
        ...actual,
        Sprite: vi.fn(() => ({
            alpha: 1.0,
            anchor: { set: vi.fn() },
        })),
    };
});

describe('FadeAnimation', () => {
    let object: BaseObject;
    let sprites: PIXI.Sprite[];

    beforeEach(() => {
        object = new BaseObject();
        // Create two mocked sprites for the tests
        sprites = [new PIXI.Sprite(), new PIXI.Sprite()];
        // Set initial alpha values as they would be before the animation starts
        sprites[0].alpha = 1.0;
        sprites[1].alpha = 0.0;
        vi.clearAllMocks();
    });

    it('should have the correct animation name', () => {
        expect(FadeAnimation.animationName).toBe('Fade');
    });

    it('should require 2 sprites', () => {
        expect(FadeAnimation.getRequiredSpriteCount()).toBe(2);
    });

    it('should throw an error if not provided with 2 sprites', () => {
        const singleSprite = [new PIXI.Sprite()];
        expect(() => new FadeAnimation(object, singleSprite)).toThrow(
            'Animation "Fade" requires at least 2 sprites, but got 1.'
        );
    });

    it('should initialize with correct default alpha values', () => {
        const animation = new FadeAnimation(object, sprites);
        // The constructor doesn't alter the alpha, so they should be as we set them.
        expect(sprites[0].alpha).toBe(1.0);
        expect(sprites[1].alpha).toBe(0.0);
    });

    it('should update sprite alphas correctly at the halfway point', () => {
        const animation = new FadeAnimation(object, sprites);
        animation.play();
        animation.update(1.0); // Simulate 1 second passing (half of the 2s duration)

        // Using toBeCloseTo for floating point comparisons
        expect(sprites[0].alpha).toBeCloseTo(0.5);
        expect(sprites[1].alpha).toBeCloseTo(0.5);
    });

    it('should update sprite alphas correctly at the end of the animation', () => {
        const animation = new FadeAnimation(object, sprites);
        animation.play();
        animation.update(2.0); // Simulate 2 seconds passing

        expect(sprites[0].alpha).toBeCloseTo(0.0);
        expect(sprites[1].alpha).toBeCloseTo(1.0);
    });

    it('should loop the animation correctly', () => {
        const animation = new FadeAnimation(object, sprites);
        animation.play();
        animation.update(2.5); // Simulate 2.5 seconds passing (0.5s into the next loop)

        expect(sprites[0].alpha).toBeCloseTo(1.0 - 0.25); // 0.5s / 2.0s = 0.25 progress
        expect(sprites[1].alpha).toBeCloseTo(0.25);
    });

    it('should reset sprite alphas when stopped', () => {
        const animation = new FadeAnimation(object, sprites);
        animation.play();
        animation.update(1.5); // Animate for a bit

        // Ensure alphas have changed
        expect(sprites[0].alpha).not.toBe(1.0);
        expect(sprites[1].alpha).not.toBe(0.0);

        animation.stop();

        // Now they should be reset
        expect(sprites[0].alpha).toBe(1.0);
        expect(sprites[1].alpha).toBe(0.0);
    });

    it('should not update if not playing', () => {
        const animation = new FadeAnimation(object, sprites);
        // Do not call animation.play()
        animation.update(1.0);

        // Alphas should remain at their initial values
        expect(sprites[0].alpha).toBe(1.0);
        expect(sprites[1].alpha).toBe(0.0);
    });
});
