import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VortexAnimation } from '../../src/animations/VortexAnimation';
import { BaseObject } from '../../src/core/BaseObject';
import * as PIXI from 'pixi.js';

// Mock PIXI classes
vi.mock('pixi.js', async () => {
    const actual = await vi.importActual('pixi.js');

    const buffer = {
        data: new Float32Array(Array.from({ length: 121 * 2 }, (_, i) => (i % 2 === 0 ? (i / 2) % 11 * 10 : Math.floor(i / 22) * 10))),
        update: vi.fn(),
    };

    const MeshPlane = vi.fn().mockImplementation(() => ({
        geometry: {
            getBuffer: vi.fn((id) => {
                if (id === 'aPosition') return buffer;
                return null;
            }),
        },
        width: 200,
        height: 200,
        destroy: vi.fn(),
        visible: true,
    }));

    const Sprite = vi.fn(() => ({
        texture: {},
        visible: true,
        width: 200,
        height: 200,
    }));

    return {
        ...actual,
        MeshPlane,
        Sprite,
    };
});

describe('VortexAnimation', () => {
    let object: BaseObject;
    let sprite: PIXI.Sprite;

    beforeEach(() => {
        vi.clearAllMocks();
        object = new BaseObject();
        vi.spyOn(object, 'addChild').mockImplementation((child) => child);
        vi.spyOn(object, 'removeChild').mockImplementation((child) => child);
        sprite = new PIXI.Sprite();
    });

    it('should create a MeshPlane and hide the source sprite on play()', () => {
        const animation = new VortexAnimation(object, [sprite]);
        animation.play(); // This now creates the mesh

        expect(PIXI.MeshPlane).toHaveBeenCalledOnce();
        expect(object.addChild).toHaveBeenCalledOnce();
        expect(sprite.visible).toBe(false);
    });

    it('should update mesh vertices when update is called', () => {
        const animation = new VortexAnimation(object, [sprite]);
        animation.play();

        const mesh = (animation as any).mesh;
        const buffer = mesh.geometry.getBuffer('aPosition');
        const originalVertices = new Float32Array(buffer.data);

        animation.update(0.1);

        expect(buffer.data).not.toEqual(originalVertices);
        expect(buffer.update).toHaveBeenCalledOnce();
    });

    it('should pull vertices to the center at the end of the animation', () => {
        const animation = new VortexAnimation(object, [sprite]);
        animation.play();
        const mesh = (animation as any).mesh;
        const buffer = mesh.geometry.getBuffer('aPosition');

        animation.update(3.0); // End of animation

        // All vertices should be at the center (100, 100)
        for (let i = 0; i < buffer.data.length; i += 2) {
            expect(buffer.data[i]).toBeCloseTo(100);
            expect(buffer.data[i + 1]).toBeCloseTo(100);
        }
    });

    it('should destroy the mesh and restore the sprite on stop', () => {
        const animation = new VortexAnimation(object, [sprite]);
        animation.play();

        const mesh = (animation as any).mesh;
        expect(sprite.visible).toBe(false);
        expect(mesh.visible).toBe(true);

        animation.stop();

        expect(object.removeChild).toHaveBeenCalledWith(mesh);
        expect(mesh.destroy).toHaveBeenCalledOnce();
        expect(sprite.visible).toBe(true);
        // The mesh itself might still exist but should be made invisible by stop()
        expect((animation as any).mesh.visible).toBe(false);
    });
});
