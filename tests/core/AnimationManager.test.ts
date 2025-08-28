import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnimationManager } from '../../src/core/AnimationManager';
import { BaseObject } from '../../src/core/BaseObject';
import { IAnimate, AnimateClass, IBaseObject } from '../../src/core/types';
import * as PIXI from 'pixi.js';

// A mock animation class for testing registration and creation.
import { AnimationState } from '../../src/core/types';
class MockAnimation implements IAnimate {
  public static readonly animationName = 'MockAnimation';
  public static getRequiredSpriteCount = () => 1;

  public name = MockAnimation.animationName;
  public object: IBaseObject;
  public sprites: PIXI.Sprite[];
  public state: AnimationState = 'IDLE';
  public loop: boolean = true;
  public speed: number = 1.0;

  public onComplete?: () => void;
  public onRenderOrderChange?: (sprites: PIXI.Sprite[], newOrder: number[]) => void;

  constructor(object: IBaseObject, sprites: PIXI.Sprite[]) {
    this.object = object;
    this.sprites = sprites;
  }

  get isPlaying() {
    return this.state === 'PLAYING';
  }

  play = vi.fn(() => {
    this.state = 'PLAYING';
  });
  pause = vi.fn(() => {
    this.state = 'PAUSED';
  });
  resume = vi.fn(() => {
    this.state = 'PLAYING';
  });
  stop = vi.fn(() => {
    this.state = 'IDLE';
  }); // The manager will augment this
  update = vi.fn();
  reset = vi.fn(); // Add reset mock
}

describe('AnimationManager', () => {
  let manager: AnimationManager;
  let baseObject: BaseObject;
  let sprites: PIXI.Sprite[];

  beforeEach(() => {
    manager = new AnimationManager();
    baseObject = new BaseObject();
    sprites = [new PIXI.Sprite()];
    // Vitest clears mocks between tests, so this is safe.
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('should register a new animation class', () => {
    manager.register(MockAnimation as unknown as AnimateClass);
    const instance = manager.create(MockAnimation.animationName, baseObject, sprites);
    expect(instance).toBeInstanceOf(MockAnimation);
  });

  it('should warn when registering an animation with a name that already exists', () => {
    manager.register(MockAnimation as unknown as AnimateClass);
    manager.register(MockAnimation as unknown as AnimateClass);
    expect(console.warn).toHaveBeenCalledWith(
      `AnimationManager: An animation with the name "${MockAnimation.animationName}" is already registered. It will be overwritten.`,
    );
  });

  it('should create an animation instance and add it to the active list', () => {
    manager.register(MockAnimation as unknown as AnimateClass);
    const instance = manager.create(
      MockAnimation.animationName,
      baseObject,
      sprites,
    ) as MockAnimation;
    expect(instance).toBeDefined();
    expect(instance).toBeInstanceOf(MockAnimation);
    expect(instance.object).toBe(baseObject);

    // Check if it's in the active list by trying to update it
    instance.play();
    manager.update(0.016);
    expect(instance.update).toHaveBeenCalledOnce();
  });

  it('should return undefined and log an error for an unregistered animation', () => {
    const instance = manager.create('NonExistent', baseObject, sprites);
    expect(instance).toBeUndefined();
    expect(console.error).toHaveBeenCalledWith(
      'AnimationManager: No animation registered with the name "NonExistent".',
    );
  });

  it('should call update on active, playing animations', () => {
    manager.register(MockAnimation as unknown as AnimateClass);
    const instance = manager.create(
      MockAnimation.animationName,
      baseObject,
      sprites,
    ) as MockAnimation;
    instance.play();

    manager.update(0.016);
    expect(instance.update).toHaveBeenCalledWith(0.016);
  });

  it('should not call update on paused animations', () => {
    manager.register(MockAnimation as unknown as AnimateClass);
    const instance = manager.create(
      MockAnimation.animationName,
      baseObject,
      sprites,
    ) as MockAnimation;
    instance.play();
    instance.pause();

    manager.update(0.016);
    expect(instance.update).not.toHaveBeenCalled();
  });

  it('should apply the speed multiplier during update', () => {
    manager.register(MockAnimation as unknown as AnimateClass);
    const instance = manager.create(
      MockAnimation.animationName,
      baseObject,
      sprites,
    ) as MockAnimation;
    instance.play();
    manager.setSpeed(2.5);

    manager.update(0.01);
    expect(instance.update).toHaveBeenCalledWith(0.01 * 2.5);
  });

  it('should not allow negative speed', () => {
    manager.register(MockAnimation as unknown as AnimateClass);
    const instance = manager.create(
      MockAnimation.animationName,
      baseObject,
      sprites,
    ) as MockAnimation;
    instance.play();
    manager.setSpeed(-2.0);

    manager.update(0.016);
    expect(instance.update).toHaveBeenCalledWith(0);
  });

  it('should pause all active animations', () => {
    manager.register(MockAnimation as unknown as AnimateClass);
    const instance1 = manager.create(
      MockAnimation.animationName,
      baseObject,
      sprites,
    ) as MockAnimation;
    const instance2 = manager.create(
      MockAnimation.animationName,
      baseObject,
      sprites,
    ) as MockAnimation;
    instance1.play();
    instance2.play();

    manager.pauseAll();
    expect(instance1.pause).toHaveBeenCalledOnce();
    expect(instance2.pause).toHaveBeenCalledOnce();
  });

  it('should resume all active animations', () => {
    manager.register(MockAnimation as unknown as AnimateClass);
    const instance1 = manager.create(
      MockAnimation.animationName,
      baseObject,
      sprites,
    ) as MockAnimation;
    const instance2 = manager.create(
      MockAnimation.animationName,
      baseObject,
      sprites,
    ) as MockAnimation;
    instance1.play();
    instance2.play();
    manager.pauseAll();

    manager.resumeAll();
    expect(instance1.resume).toHaveBeenCalledOnce();
    expect(instance2.resume).toHaveBeenCalledOnce();
  });

  it('should remove an animation from the active list when its stop() method is called', () => {
    manager.register(MockAnimation as unknown as AnimateClass);
    const instance = manager.create(
      MockAnimation.animationName,
      baseObject,
      sprites,
    ) as MockAnimation;
    instance.play();

    manager.update(0.016);
    expect(instance.update).toHaveBeenCalledTimes(1);

    // Calling stop() should trigger the augmented logic in the manager
    instance.stop();

    // It should no longer be updated because it's removed from the active list
    manager.update(0.016);
    expect(instance.update).toHaveBeenCalledTimes(1); // Not called again
  });

  it('should tell the BaseObject to remove the animation when it is stopped', () => {
    manager.register(MockAnimation as unknown as AnimateClass);
    const instance = manager.create(
      MockAnimation.animationName,
      baseObject,
      sprites,
    ) as MockAnimation;
    const removeSpy = vi.spyOn(baseObject, 'removeAnimate');

    instance.stop();

    expect(removeSpy).toHaveBeenCalledWith(instance);
  });
});
