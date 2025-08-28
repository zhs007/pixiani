import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FlagWaveAnimation } from '../../src/animations/FlagWaveAnimation';
import { BaseObject } from '../../src/core/BaseObject';
import * as PIXI from 'pixi.js';

// Mock PIXI classes
vi.mock('pixi.js', async () => {
  const actual = await vi.importActual('pixi.js');

  const buffer = {
    data: new Float32Array(
      Array.from({ length: 21 * 11 * 2 }, (_, i) =>
        i % 2 === 0 ? ((i / 2) % 21) * 10 : Math.floor(i / 42) * 10,
      ),
    ),
    update: vi.fn(),
  };

  const MeshPlane = vi.fn().mockImplementation(() => ({
    geometry: {
      getBuffer: vi.fn((id) => {
        if (id === 'aPosition') return buffer;
        return null;
      }),
    },
    width: 100,
    height: 100,
    destroy: vi.fn(),
    visible: true,
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
    vi.spyOn(object, 'addChild').mockImplementation((child) => child);
    vi.spyOn(object, 'removeChild').mockImplementation((child) => child);
    sprite = new PIXI.Sprite();
  });

  it('should create a MeshPlane and hide the source sprite on play()', () => {
    const animation = new FlagWaveAnimation(object, [sprite]);
    animation.play();

    expect(PIXI.MeshPlane).toHaveBeenCalledOnce();
    expect(object.addChild).toHaveBeenCalledOnce();
    expect(sprite.visible).toBe(false);
  });

  it('should update mesh vertices when update is called', () => {
    const animation = new FlagWaveAnimation(object, [sprite]);
    animation.play();
    const mesh = (animation as any).mesh;
    const buffer = mesh.geometry.getBuffer('aPosition');
    const originalVertices = new Float32Array(buffer.data);

    animation.update(0.1);

    expect(buffer.data).not.toEqual(originalVertices);
    expect(buffer.update).toHaveBeenCalledOnce();
  });

  it('should not update mesh vertices if not playing', () => {
    const animation = new FlagWaveAnimation(object, [sprite]);
    animation.play(); // Play to create the mesh
    const mesh = (animation as any).mesh;
    const buffer = mesh.geometry.getBuffer('aPosition');

    animation.pause(); // Then pause it
    const verticesBefore = new Float32Array(buffer.data);
    animation.update(0.1);
    const verticesAfter = new Float32Array(buffer.data);

    expect(verticesAfter).toEqual(verticesBefore);
    expect(buffer.update).not.toHaveBeenCalled();
  });

  it('should destroy the mesh and restore the sprite on stop', () => {
    const animation = new FlagWaveAnimation(object, [sprite]);
    animation.play();
    const mesh = (animation as any).mesh;

    expect(sprite.visible).toBe(false);

    animation.stop();

    expect(object.removeChild).toHaveBeenCalledWith(mesh);
    expect(mesh.destroy).toHaveBeenCalledOnce();
    expect(sprite.visible).toBe(true);
    expect((animation as any).mesh.visible).toBe(false);
  });
});
