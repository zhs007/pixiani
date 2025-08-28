import * as PIXI from 'pixi.js';
import { IAnimate, IBaseObject, RenderOrderCallback, AnimateClass, AnimationState } from './types';

/**
 * @abstract
 * @class BaseAnimate
 * @implements {IAnimate}
 * @description An abstract base class for all animations. It provides the fundamental
 * structure, properties, and lifecycle methods that all concrete animations will share.
 */
export abstract class BaseAnimate implements IAnimate {
  public readonly object: IBaseObject;
  public readonly sprites: PIXI.Sprite[];

  public state: AnimationState = 'IDLE';
  public loop: boolean = true;
  public speed: number = 1.0;
  public onComplete?: () => void;
  public onRenderOrderChange?: RenderOrderCallback;

  constructor(object: IBaseObject, sprites: PIXI.Sprite[]) {
    if (sprites.length < (this.constructor as AnimateClass).getRequiredSpriteCount()) {
      throw new Error(
        `Animation "${this.name}" requires at least ${(this.constructor as AnimateClass).getRequiredSpriteCount()} sprites, but got ${sprites.length}.`,
      );
    }
    this.object = object;
    this.sprites = sprites;
  }

  public get name(): string {
    const constructor = this.constructor as AnimateClass;
    if (!constructor.animationName) {
      console.error("Animation class is missing the static 'animationName' property.");
      return 'Unnamed Animation';
    }
    return constructor.animationName;
  }

  public get isPlaying(): boolean {
    return this.state === 'PLAYING';
  }

  /**
   * Resets the animation to its initial state.
   * Must be implemented by subclasses to reset their specific properties (e.g., timers, progress).
   */
  protected abstract reset(): void;

  /**
   * Sets the state of the animation and handles the looping logic.
   * Subclasses should call this method to change their state.
   * @param {AnimationState} newState - The new state to transition to.
   */
  protected setState(newState: AnimationState): void {
    if (this.state === newState) return;

    // If the animation has ended and should loop, restart it.
    if (newState === 'ENDED' && this.loop) {
      this.play();
    } else {
      this.state = newState;
    }

    // Fire onComplete callback if the animation has truly ended (and is not looping)
    if (this.state === 'ENDED') {
      this.onComplete?.();
    }
  }

  public play(): void {
    this.reset();
    this.state = 'PLAYING';
  }

  public pause(): void {
    if (this.isPlaying) {
      this.setState('PAUSED');
    }
  }

  public resume(): void {
    if (this.state === 'PAUSED') {
      this.state = 'PLAYING';
    }
  }

  public stop(): void {
    this.reset();
    this.setState('IDLE');
  }

  public abstract update(deltaTime: number): void;
}
