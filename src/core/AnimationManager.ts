import { IAnimationManager, AnimateClass, IAnimate, IBaseObject } from './types';
import { BaseObject } from './BaseObject';
import * as PIXI from 'pixi.js';

/**
 * @class AnimationManager
 * @implements {IAnimationManager}
 * @description Manages the registration, creation, and lifecycle of all animations in the application.
 * This class is intended to be used as a singleton.
 */
export class AnimationManager implements IAnimationManager {
    /**
     * @private
     * @type {Map<string, AnimateClass>}
     * @description A map to store registered animation classes, with the animation name as the key.
     */
    private readonly registeredAnimations: Map<string, AnimateClass> = new Map();

    /**
     * @private
     * @type {IAnimate[]}
     * @description A list of all currently active (instantiated) animation instances.
     */
    private readonly activeAnimations: IAnimate[] = [];

    /**
     * @private
     * @type {number}
     * @description The global speed multiplier for all animations.
     */
    private speed: number = 1.0;

    /**
     * Registers an animation class, making it available to be created by name.
     * @param {AnimateClass} animateClass - The animation class to register. It must have a static `animationName` property.
     */
    public register(animateClass: AnimateClass): void {
        const name = animateClass.animationName;
        if (this.registeredAnimations.has(name)) {
            console.warn(`AnimationManager: An animation with the name "${name}" is already registered. It will be overwritten.`);
        }
        this.registeredAnimations.set(name, animateClass);
    }

    /**
     * Creates a new instance of a registered animation and adds it to the update loop.
     * @param {string} name - The name of the animation to create.
     * @param {IBaseObject} object - The object to attach the animation to.
     * @param {PIXI.Sprite[]} sprites - The sprites to be used by the animation.
     * @returns {IAnimate | undefined} The created animation instance, or undefined if creation fails.
     */
    public create(name: string, object: IBaseObject, sprites: PIXI.Sprite[]): IAnimate | undefined {
        const AnimateCtor = this.registeredAnimations.get(name);
        if (!AnimateCtor) {
            console.error(`AnimationManager: No animation registered with the name "${name}".`);
            return undefined;
        }

        // The sprite count check is now handled in the BaseAnimate constructor.
        const animateInstance = new AnimateCtor(object, sprites);
        this.activeAnimations.push(animateInstance);

        // If the object is a BaseObject instance, let it track its new animation.
        if (object instanceof BaseObject) {
            object.addAnimate(animateInstance);
        }

        // Augment the animation's stop method to also remove it from the manager.
        const originalStop = animateInstance.stop.bind(animateInstance);
        animateInstance.stop = () => {
            originalStop();
            this.removeInstance(animateInstance);
        };

        return animateInstance;
    }

    /**
     * Removes an animation instance from the active list.
     * @private
     * @param {IAnimate} animate - The animation to remove.
     */
    private removeInstance(animate: IAnimate): void {
        const index = this.activeAnimations.indexOf(animate);
        if (index > -1) {
            this.activeAnimations.splice(index, 1);
        }
        // Also tell the BaseObject to untrack it.
        if (animate.object instanceof BaseObject) {
            animate.object.removeAnimate(animate);
        }
    }

    /**
     * Pauses all active animations.
     */
    public pauseAll(): void {
        this.activeAnimations.forEach(anim => anim.pause());
    }

    /**
     * Resumes all paused animations.
     */
    public resumeAll(): void {
        this.activeAnimations.forEach(anim => anim.resume());
    }

    /**
     * Sets the global playback speed for all animations.
     * @param {number} speed - The playback speed (1.0 is normal). Must be non-negative.
     */
    public setSpeed(speed: number): void {
        this.speed = Math.max(0, speed);
    }

    /**
     * Updates all active animations. This should be called once per frame from the main game loop.
     * @param {number} deltaTime - The time elapsed since the last frame, in seconds.
     */
    public update(deltaTime: number): void {
        const globalDeltaTime = deltaTime * this.speed;
        // Iterate backwards to allow animations to be safely removed during the update loop.
        for (let i = this.activeAnimations.length - 1; i >= 0; i--) {
            const anim = this.activeAnimations[i];
            if (anim.isPlaying) {
                // Apply per-animation speed on top of global speed
                anim.update(globalDeltaTime * anim.speed);
            }
        }
    }
}
