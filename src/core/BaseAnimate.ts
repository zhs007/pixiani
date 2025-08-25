import * as PIXI from 'pixi.js';
import { IAnimate, IBaseObject, RenderOrderCallback, AnimateClass } from './types';

/**
 * @abstract
 * @class BaseAnimate
 * @implements {IAnimate}
 * @description An abstract base class for all animations. It provides the fundamental
 * structure, properties, and lifecycle methods that all concrete animations will share.
 */
export abstract class BaseAnimate implements IAnimate {
    /** The `BaseObject` this animation is attached to. */
    public readonly object: IBaseObject;
    /** The array of sprites this animation will manipulate. */
    public readonly sprites: PIXI.Sprite[];

    /** Whether the animation is currently playing. */
    public isPlaying: boolean = false;
    /** An optional callback that fires when the animation completes a full cycle. */
    public onComplete?: () => void;
    /** An optional callback to request a change in sprite rendering order. */
    public onRenderOrderChange?: RenderOrderCallback;

    /**
     * @constructor
     * @param {IBaseObject} object - The BaseObject this animation is attached to.
     * @param {PIXI.Sprite[]} sprites - The sprites this animation will manipulate.
     */
    constructor(object: IBaseObject, sprites: PIXI.Sprite[]) {
        if (sprites.length < (this.constructor as AnimateClass).getRequiredSpriteCount()) {
            throw new Error(`Animation "${this.name}" requires at least ${(this.constructor as AnimateClass).getRequiredSpriteCount()} sprites, but got ${sprites.length}.`);
        }
        this.object = object;
        this.sprites = sprites;
    }

    /**
     * The unique name of the animation, derived from the static property of the constructor.
     * This is used for registration and creation in the AnimationManager.
     * @readonly
     * @type {string}
     */
    public get name(): string {
        // Access the static property from the instance's constructor.
        const constructor = this.constructor as AnimateClass;
        if (!constructor.animationName) {
            console.error("Animation class is missing the static 'animationName' property.");
            return 'Unnamed Animation';
        }
        return constructor.animationName;
    }

    /**
     * Starts or resumes the animation.
     */
    public play(): void {
        this.isPlaying = true;
    }

    /**
     * Pauses the animation.
     */
    public pause(): void {
        this.isPlaying = false;
    }

    /**
     * Stops the animation and resets its internal state.
     * Concrete animation classes should override this method to reset their specific state
     * (e.g., elapsed time, progress) and call `super.stop()`.
     */
    public stop(): void {
        this.isPlaying = false;
    }

    /**
     * Updates the animation's state based on the elapsed time.
     * This method must be implemented by all concrete animation subclasses.
     * @abstract
     * @param {number} deltaTime - The time elapsed since the last frame, scaled by the global animation speed.
     */
    public abstract update(deltaTime: number): void;
}
