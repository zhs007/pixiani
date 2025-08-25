import * as PIXI from 'pixi.js';

/**
 * Represents a game object that can host animations.
 * It's fundamentally a PIXI.Container, so sprites and other display objects
 * can be added to it. The animation will operate on the children of this container.
 */
export interface IBaseObject extends PIXI.Container {
    // Currently, no extra properties are needed on the interface.
    // The implementation in `BaseObject.ts` will contain the logic for managing animations.
}

/**
 * Interface for a single animation instance.
 * It defines the lifecycle and properties of an animation.
 */
export interface IAnimate {
    /** A unique identifier for the animation class. */
    readonly name: string;
    /** The `BaseObject` this animation is attached to. */
    readonly object: IBaseObject;
    /** Whether the animation is currently playing. */
    readonly isPlaying: boolean;

    /** An optional callback that fires when the animation completes a full cycle. */
    onComplete?: () => void;
    /** An optional callback to request a change in sprite rendering order. */
    onRenderOrderChange?: RenderOrderCallback;

    /** Starts or resumes the animation. */
    play(): void;
    /** Pauses the animation. */
    pause(): void;
    /** Stops the animation and resets its internal state. */
    stop(): void;
    /**
     * Updates the animation's state.
     * @param deltaTime - The time elapsed since the last frame, in seconds.
     */
    update(deltaTime: number): void;
}

/**
 * Defines the constructor signature for any class that implements `IAnimate`.
 * This is used by the `AnimationManager` to register and instantiate animations.
 * @param object - The `IBaseObject` the animation will be attached to.
 * @param sprites - The array of sprites the animation will manipulate.
 */
export type AnimateClass = {
    /** A static property to get the unique name of the animation class. */
    readonly animationName: string;
    /** A static method to get the number of sprites required by this animation. */
    getRequiredSpriteCount(): number;
    new (object: IBaseObject, sprites: PIXI.Sprite[]): IAnimate;
};

/**
 * Interface for the global animation manager.
 * It handles registration, creation, and global updates for all animations.
 */
export interface IAnimationManager {
    /**
     * Registers an animation class so it can be created by name.
     * @param animateClass - The animation class to register.
     */
    register(animateClass: AnimateClass): void;

    /**
     * Creates an instance of a registered animation.
     * @param name - The name of the animation to create.
     * @param object - The `IBaseObject` to attach the animation to.
     * @param sprites - The sprites to be used by the animation.
     * @returns An `IAnimate` instance, or `undefined` if the name is not registered.
     */
    create(name: string, object: IBaseObject, sprites: PIXI.Sprite[]): IAnimate | undefined;

    /** Pauses all active animations. */
    pauseAll(): void;
    /** Resumes all paused animations. */
    resumeAll(): void;
    /**
     * Sets the playback speed for all animations.
     * @param speed - The playback speed (e.g., 1.0 is normal, 0.5 is half speed).
     */
    setSpeed(speed: number): void;
    /**
     * Updates all active animations. This should be called once per frame.
     * @param deltaTime - The time elapsed since the last frame, in seconds.
     */
    update(deltaTime: number): void;
}

/**
 * A callback function signature used to request a change in the rendering order of sprites.
 * The animation system itself does not change z-indices, but it can notify the application
 * layer to do so via this callback.
 * @param sprites - The array of sprites whose order needs to be changed.
 * @param newOrder - An array of indices representing the desired new order.
 */
export type RenderOrderCallback = (sprites: PIXI.Sprite[]) => void;
