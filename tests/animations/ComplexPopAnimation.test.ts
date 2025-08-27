import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComplexPopAnimation } from '../../src/animations/ComplexPopAnimation';
import { BaseObject } from '../../src/core/BaseObject';
import * as PIXI from 'pixi.js';

function createMockSprite() {
    return {
        alpha: 1.0,
        scale: {
            x: 1.0,
            y: 1.0,
            set: function(val: number) {
                this.x = val;
                this.y = val;
            }
        },
        anchor: { set: vi.fn() },
    };
}

vi.mock('pixi.js', async () => {
    const actual = await vi.importActual('pixi.js');
    return {
        ...actual,
        Sprite: vi.fn().mockImplementation(createMockSprite),
    };
});

describe('ComplexPopAnimation', () => {
    let object: BaseObject;
    let sprite: PIXI.Sprite;
    let animation: ComplexPopAnimation;

    beforeEach(() => {
        vi.clearAllMocks();
        object = new BaseObject();
        sprite = new PIXI.Sprite();
        animation = new ComplexPopAnimation(object, [sprite]);
    });

    it('should have the correct animation name and sprite count', () => {
        expect(ComplexPopAnimation.animationName).toBe('ComplexPop');
        expect(ComplexPopAnimation.getRequiredSpriteCount()).toBe(1);
    });

    it('should handle Phase 1 (0.3s): scale up to 120%', () => {
        animation.play();
        animation.update(0.3);
        expect(sprite.scale.x).toBeCloseTo(1.2);
    });

    it('should handle Phase 2 (0.5s): scale up to 130%', () => {
        animation.play();
        animation.update(0.5);
        expect(sprite.scale.x).toBeCloseTo(1.3);
    });

    it('should handle Phase 3 (0.6s): scale down to 120%', () => {
        animation.play();
        animation.update(0.6);
        expect(sprite.scale.x).toBeCloseTo(1.2);
    });

    it('should handle Phase 4 (1.1s): hold scale at 120%', () => {
        animation.play();
        animation.update(1.1);
        expect(sprite.scale.x).toBeCloseTo(1.2);
    });

    it('should handle Phase 5 (1.25s): Y-rotation midpoint', () => {
        animation.play();
        animation.update(1.25);
        expect(sprite.scale.y).toBeCloseTo(1.2);
        expect(sprite.scale.x).toBeCloseTo(-1.2);
    });

    it('should handle Phase 5 (1.4s): Y-rotation end', () => {
        animation.play();
        animation.update(1.4);
        expect(sprite.scale.y).toBeCloseTo(1.2);
        expect(sprite.scale.x).toBeCloseTo(1.2);
    });

    it('should be at its final state just before the end', () => {
        animation.play();
        animation.update(1.499); // Just before the end
        expect(sprite.scale.x).toBeCloseTo(1.5, 1);
        expect(sprite.alpha).toBeCloseTo(0, 1);
    });

    it('should loop correctly at the end of the duration', () => {
        animation.play();
        animation.update(1.5);
        // Should have looped and reset
        expect(animation.state).toBe('PLAYING');
        expect(sprite.scale.x).toBe(1.0);
        expect(sprite.alpha).toBe(1.0);
    });

    it('should reset the sprite on stop', () => {
        animation.play();
        animation.update(1.2);
        animation.stop();

        expect(animation.state).toBe('IDLE');
        expect(sprite.scale.x).toBe(1.0);
        expect(sprite.alpha).toBe(1.0);
    });
});
