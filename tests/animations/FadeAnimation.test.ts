import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FadeAnimation } from '../../src/animations/FadeAnimation';
import { BaseObject } from '../../src/core/BaseObject';
import * as PIXI from 'pixi.js';

// --- More robust mocking for stateful objects ---
// This will hold the instances of our mocks
let mockSpriteInstances: any[] = [];

// A factory for creating sprite mocks to ensure tests are isolated
function createMockSprite() {
    const sprite = {
        alpha: 1.0,
        anchor: { set: vi.fn() },
    };
    mockSpriteInstances.push(sprite);
    return sprite;
}

vi.mock('pixi.js', async () => {
    const actual = await vi.importActual('pixi.js');
    return {
        ...actual,
        Sprite: vi.fn().mockImplementation(createMockSprite),
    };
});
// --- End Mocking ---


describe('FadeAnimation', () => {
    let object: BaseObject;
    let sprites: PIXI.Sprite[];
    let animation: FadeAnimation;

    beforeEach(() => {
        vi.clearAllMocks();
        // Clear the instances array before each test
        mockSpriteInstances = [];
        object = new BaseObject();
        // new PIXI.Sprite() will now use our factory and populate mockSpriteInstances
        sprites = [new PIXI.Sprite(), new PIXI.Sprite()];
        sprites[0].alpha = 1.0;
        sprites[1].alpha = 0.0;
        animation = new FadeAnimation(object, sprites);
    });

    it('should correctly update sprite alphas during animation', () => {
        animation.play();
        animation.update(1.0); // Halfway
        expect(sprites[0].alpha).toBeCloseTo(0.5);
        expect(sprites[1].alpha).toBeCloseTo(0.5);
    });

    it('should set final alpha values and state to ENDED when not looping', () => {
        animation.loop = false;
        animation.play();
        animation.update(2.0); // End
        expect(sprites[0].alpha).toBe(0.0);
        expect(sprites[1].alpha).toBe(1.0);
        expect(animation.state).toBe('ENDED');
    });

    it('should loop the animation correctly', () => {
        animation.play();
        animation.update(2.0);

        expect(animation.state).toBe('PLAYING');
        // The reset method should have been called, restoring the original alpha values
        expect(sprites[0].alpha).toBe(1.0);
        expect(sprites[1].alpha).toBe(0.0);

        animation.update(0.5);
        expect(sprites[0].alpha).toBeCloseTo(0.75);
        expect(sprites[1].alpha).toBeCloseTo(0.25);
    });

    it('should reset sprite alphas when stopped', () => {
        animation.play();
        animation.update(1.5);
        expect(sprites[0].alpha).not.toBe(1.0);

        animation.stop();

        expect(animation.state).toBe('IDLE');
        expect(sprites[0].alpha).toBe(1.0);
        expect(sprites[1].alpha).toBe(0.0);
    });

    it('should not update if not in PLAYING state', () => {
        animation.play();
        animation.update(1.0);
        expect(sprites[0].alpha).toBeCloseTo(0.5);

        animation.pause();
        animation.update(0.5);
        expect(sprites[0].alpha).toBeCloseTo(0.5);
    });
});
