import * as PIXI from 'pixi.js';
import { IAnimate, IBaseObject } from './types';

/**
 * @class BaseObject
 * @extends PIXI.Container
 * @implements {IBaseObject}
 * @description A fundamental game object that acts as a container for sprites and animations.
 * It can be added directly to the PIXI stage. It also manages the lifecycle of animations
 * associated with it.
 */
export class BaseObject extends PIXI.Container implements IBaseObject {
    /**
     * @protected
     * @type {IAnimate[]}
     * @description The list of animations currently attached to this object.
     */
    protected readonly animations: IAnimate[] = [];

    /**
     * Adds an animation to this object's tracking list.
     * This method is intended to be used by the animation system, not directly by the user.
     * @param {IAnimate} animate - The animation instance to add.
     */
    public addAnimate(animate: IAnimate): void {
        if (animate.object !== this) {
            console.warn('BaseObject: Cannot add an animation that belongs to another object.');
            return;
        }
        if (!this.animations.includes(animate)) {
            this.animations.push(animate);
        }
    }

    /**
     * Removes an animation from this object's tracking list.
     * @param {IAnimate} animate - The animation instance to remove.
     */
    public removeAnimate(animate: IAnimate): void {
        const index = this.animations.indexOf(animate);
        if (index > -1) {
            this.animations.splice(index, 1);
        }
    }

    /**
     * Destroys the BaseObject and all its children, and also stops all associated animations.
     * This ensures a clean teardown and prevents memory leaks from orphaned animations.
     * @param {boolean | PIXI.DestroyOptions} [options] - Options for destruction, passed to PIXI.Container.destroy.
     */
    public destroy(options?: boolean | PIXI.DestroyOptions): void {
        // Stop all animations associated with this object before destroying it.
        // We iterate backwards because the `stop()` method of an animation might
        // trigger its removal from the `animations` array via `removeAnimate`.
        for (let i = this.animations.length - 1; i >= 0; i--) {
            this.animations[i].stop();
        }
        // Ensure the array is cleared.
        this.animations.length = 0;

        super.destroy(options);
    }
}
