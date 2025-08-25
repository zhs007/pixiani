import { BaseAnimate } from '../core/BaseAnimate';

/**
 * @class ScaleAnimation
 * @extends BaseAnimate
 * @description A simple animation that scales a sprite down to 50% and back up to 100%
 * over a 2-second duration, playing in a loop.
 */
export class ScaleAnimation extends BaseAnimate {
    /**
     * The unique name for this animation class, used for registration.
     * @static
     * @type {string}
     */
    public static readonly animationName: string = 'Scale';

    /**
     * Specifies that this animation requires exactly one sprite.
     * @static
     * @returns {number}
     */
    public static getRequiredSpriteCount(): number {
        return 1;
    }

    private readonly DURATION: number = 2.0; // Total duration of one cycle in seconds
    private readonly HALF_DURATION: number = this.DURATION / 2.0;
    private elapsedTime: number = 0;

    /**
     * Updates the animation state for the current frame.
     * @param {number} deltaTime - The time elapsed since the last frame, in seconds.
     */
    public update(deltaTime: number): void {
        if (!this.isPlaying) {
            return;
        }

        this.elapsedTime += deltaTime;

        // Check if the animation cycle has completed and handle looping
        if (this.elapsedTime >= this.DURATION) {
            const loops = Math.floor(this.elapsedTime / this.DURATION);
            this.elapsedTime = this.elapsedTime % this.DURATION;

            if (this.onComplete) {
                for (let i = 0; i < loops; i++) {
                    this.onComplete();
                }
            }
        }

        const sprite = this.sprites[0];
        let scale: number;

        // Calculate scale based on the new, adjusted elapsed time
        if (this.elapsedTime <= this.HALF_DURATION) {
            // First half of the animation: scale from 1.0 down to 0.5
            const progress = this.elapsedTime / this.HALF_DURATION;
            // Linear interpolation: start + (end - start) * progress
            scale = 1.0 + (0.5 - 1.0) * progress;
        } else {
            // Second half of the animation: scale from 0.5 up to 1.0
            const progress = (this.elapsedTime - this.HALF_DURATION) / this.HALF_DURATION;
            scale = 0.5 + (1.0 - 0.5) * progress;
        }

        sprite.scale.set(scale);
    }

    /**
     * Stops the animation and resets its internal state to the beginning.
     * This includes resetting the elapsed time and the sprite's scale.
     */
    public stop(): void {
        super.stop(); // This sets isPlaying to false
        this.elapsedTime = 0;
        // Reset the sprite to its original scale when the animation is stopped.
        if (this.sprites && this.sprites[0]) {
            this.sprites[0].scale.set(1.0);
        }
    }
}
