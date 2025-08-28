import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BaseObject } from '../../src/core/BaseObject';
import { IAnimate } from '../../src/core/types';
import * as PIXI from 'pixi.js';

// Mock IAnimate for testing purposes.
// We need a factory because each test should have a fresh mock.
const createMockAnimate = (object: BaseObject): IAnimate => ({
  name: 'MockAnimate',
  object: object,
  isPlaying: false,
  play: vi.fn(),
  pause: vi.fn(),
  stop: vi.fn(),
  update: vi.fn(),
  onComplete: undefined,
  onRenderOrderChange: undefined,
});

describe('BaseObject', () => {
  let baseObject: BaseObject;

  beforeEach(() => {
    baseObject = new BaseObject();
  });

  it('should be an instance of PIXI.Container', () => {
    expect(baseObject).toBeInstanceOf(PIXI.Container);
  });

  it('should be created successfully with no animations', () => {
    // Accessing the protected 'animations' property for testing purposes.
    expect((baseObject as any).animations).toBeDefined();
    expect((baseObject as any).animations.length).toBe(0);
  });

  it('should add an animation to its tracking list', () => {
    const animate = createMockAnimate(baseObject);
    baseObject.addAnimate(animate);
    expect((baseObject as any).animations).toContain(animate);
  });

  it('should not add the same animation instance twice', () => {
    const animate = createMockAnimate(baseObject);
    baseObject.addAnimate(animate);
    baseObject.addAnimate(animate);
    expect((baseObject as any).animations.length).toBe(1);
  });

  it('should not add an animation that belongs to another object', () => {
    const anotherObject = new BaseObject();
    const animate = createMockAnimate(anotherObject); // Belongs to `anotherObject`

    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    baseObject.addAnimate(animate);
    expect((baseObject as any).animations).not.toContain(animate);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'BaseObject: Cannot add an animation that belongs to another object.',
    );

    consoleWarnSpy.mockRestore();
  });

  it('should remove an animation from its tracking list', () => {
    const animate = createMockAnimate(baseObject);
    baseObject.addAnimate(animate);
    expect((baseObject as any).animations).toContain(animate);

    baseObject.removeAnimate(animate);
    expect((baseObject as any).animations).not.toContain(animate);
  });

  it('should do nothing when trying to remove an animation that is not in the list', () => {
    const animate1 = createMockAnimate(baseObject);
    const animate2 = createMockAnimate(baseObject);
    baseObject.addAnimate(animate1);

    baseObject.removeAnimate(animate2);
    expect((baseObject as any).animations.length).toBe(1);
  });

  it('should call stop() on all its animations when destroyed', () => {
    const animate1 = createMockAnimate(baseObject);
    const animate2 = createMockAnimate(baseObject);

    baseObject.addAnimate(animate1);
    baseObject.addAnimate(animate2);

    const stopSpy1 = vi.spyOn(animate1, 'stop');
    const stopSpy2 = vi.spyOn(animate2, 'stop');

    baseObject.destroy();

    expect(stopSpy1).toHaveBeenCalledOnce();
    expect(stopSpy2).toHaveBeenCalledOnce();
  });

  it('should clear its animations list when destroyed', () => {
    const animate = createMockAnimate(baseObject);
    baseObject.addAnimate(animate);

    baseObject.destroy();

    expect((baseObject as any).animations.length).toBe(0);
  });
});
