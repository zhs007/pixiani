import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComplexPopAnimation } from '../../src/animations/ComplexPopAnimation';
import { BaseObject } from '../../src/core/BaseObject';
import * as PIXI from 'pixi.js';

// Mock PIXI.Sprite
vi.mock('pixi.js', async () => {
    const actual = await vi.importActual('pixi.js');
    return {
        ...actual,
        Sprite: vi.fn(() => ({
            alpha: 1.0,
            scale: {
                x: 1.0,
                y: 1.0,
                set: vi.fn(function(this: any, val: number) {
                    this.x = val;
                    this.y = val;
                }),
            },
            anchor: { set: vi.fn() },
        })),
    };
});

describe('ComplexPopAnimation', () => {
    let object: BaseObject;
    let sprite: PIXI.Sprite;
    let animation: ComplexPopAnimation;

    beforeEach(() => {
        object = new BaseObject();
        sprite = new PIXI.Sprite();
        animation = new ComplexPopAnimation(object, [sprite]);
        vi.clearAllMocks();
    });

    it('should have the correct animation name and sprite count', () => {
        expect(ComplexPopAnimation.animationName).toBe('ComplexPop');
        expect(ComplexPopAnimation.getRequiredSpriteCount()).toBe(1);
    });

    it('should handle Phase 1 (0.3s): scale up to 120%', () => {
        animation.play();
        animation.update(0.3);
        expect(sprite.scale.x).toBeCloseTo(1.2);
        expect(sprite.scale.y).toBeCloseTo(1.2);
    });

    it('should handle Phase 2 (0.5s): scale up to 130%', () => {
        animation.play();
        animation.update(0.5);
        expect(sprite.scale.x).toBeCloseTo(1.3);
        expect(sprite.scale.y).toBeCloseTo(1.3);
    });

    it('should handle Phase 3 (0.6s): scale down to 120%', () => {
        animation.play();
        animation.update(0.6);
        expect(sprite.scale.x).toBeCloseTo(1.2);
        expect(sprite.scale.y).toBeCloseTo(1.2);
    });

    it('should handle Phase 4 (1.1s): hold scale at 120%', () => {
        animation.play();
        animation.update(1.1);
        expect(sprite.scale.x).toBeCloseTo(1.2);
        expect(sprite.scale.y).toBeCloseTo(1.2);
    });

    it('should handle Phase 5 (1.25s): Y-rotation midpoint', () => {
        animation.play();
        animation.update(1.25); // Halfway through the 0.3s rotation
        expect(sprite.scale.y).toBeCloseTo(1.2);
        // At halfway (PI), cos is -1. So scale.x should be -1.2
        expect(sprite.scale.x).toBeCloseTo(-1.2);
    });

    it('should handle Phase 5 (1.4s): Y-rotation end', () => {
        animation.play();
        animation.update(1.4);
        expect(sprite.scale.y).toBeCloseTo(1.2);
        // At the end (2*PI), cos is 1. So scale.x should be 1.2
        expect(sprite.scale.x).toBeCloseTo(1.2);
    });

    it('should handle Phase 6 (1.5s): scale to 150% and fade out', () => {
        animation.play();
        animation.update(1.5);
        expect(sprite.scale.x).toBeCloseTo(1.5);
        expect(sprite.scale.y).toBeCloseTo(1.5);
        expect(sprite.alpha).toBeCloseTo(0);
    });

    it('should reset the sprite on stop', () => {
        animation.play();
        animation.update(1.2); // some random point
        animation.stop();

        // The mock for scale.set needs to be checked
        expect(sprite.scale.set).toHaveBeenCalledWith(1.0);
        expect(sprite.alpha).toBe(1.0);
    });
});
