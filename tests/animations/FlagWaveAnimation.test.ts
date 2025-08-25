import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FlagWaveAnimation } from '../../src/animations/FlagWaveAnimation';
import { BaseObject } from '../../src/core/BaseObject';
import * as PIXI from 'pixi.js';

// Mock PIXI classes
vi.mock('pixi.js', async () => {
    const actual = await vi.importActual('pixi.js');

    const buffer = {
        data: new Float32Array([0, 0, 10, 0, 0, 10, 10, 10]),
        update: vi.fn(),
    };

    const MeshPlane = vi.fn(() => ({
        geometry: {
            getBuffer: vi.fn((id) => {
                if (id === 'aPosition') return buffer;
                return null;
            }),
        },
        width: 100,
        height: 100,
        destroy: vi.fn(),
    }));

    const Sprite = vi.fn(() => ({
        texture: {},
        visible: true,
        width: 100,
        height: 100,
    }));

    return {
        ...actual,
        MeshPlane,
        Sprite,
    };
});

describe('FlagWaveAnimation', () => {
    let object: BaseObject;
    let sprite: PIXI.Sprite;

    beforeEach(() => {
        vi.clearAllMocks();
        object = new BaseObject();
        // Provide a mock implementation for addChild/removeChild to avoid errors
        // with the incomplete PlaneMesh mock not having an 'emit' method.
        vi.spyOn(object, 'addChild').mockImplementation((child) => child);
        vi.spyOn(object, 'removeChild').mockImplementation((child) => child);
        sprite = new PIXI.Sprite();
    });

    it('should create a MeshPlane and hide the source sprite on construction', () => {
        const animation = new FlagWaveAnimation(object, [sprite]);

        expect(PIXI.MeshPlane).toHaveBeenCalledOnce();
        expect(object.addChild).toHaveBeenCalledOnce();
        expect(sprite.visible).toBe(false);
    });

    it('should update mesh vertices when update is called', () => {
        const animation = new FlagWaveAnimation(object, [sprite]);
        const mesh = (object.addChild as any).mock.calls[0][0];
        const buffer = mesh.geometry.getBuffer('aPosition');
        const originalVertices = new Float32Array(buffer.data);

        animation.play();
        animation.update(0.1);

        expect(buffer.data).not.toEqual(originalVertices);
        expect(buffer.update).toHaveBeenCalledOnce();
    });

    it('should not update mesh vertices if not playing', () => {
        const animation = new FlagWaveAnimation(object, [sprite]);
        const mesh = (object.addChild as any).mock.calls[0][0];
        const buffer = mesh.geometry.getBuffer('aPosition');
        const originalVertices = new Float32Array(buffer.data);

        // animation.play() is NOT called
        animation.update(0.1);

        expect(buffer.data).toEqual(originalVertices);
        expect(buffer.update).not.toHaveBeenCalled();
    });

    it('should destroy the mesh and restore the sprite on stop', () => {
        const animation = new FlagWaveAnimation(object, [sprite]);
        const mesh = (object.addChild as any).mock.calls[0][0];

        // Ensure initial state
        expect(sprite.visible).toBe(false);

        animation.stop();

        expect(object.removeChild).toHaveBeenCalledWith(mesh);
        expect(mesh.destroy).toHaveBeenCalledOnce();
        expect(sprite.visible).toBe(true);
    });
});
