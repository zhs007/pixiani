import { BaseAnimate } from '../core/BaseAnimate';

/**
 * @class FadeAnimation
 * @extends BaseAnimate
 * @description An animation that cross-fades two sprites over a 2-second duration.
 * Sprite 0 fades from 100% to 0% opacity.
 * Sprite 1 fades from 0% to 100% opacity.
 */
export class FadeAnimation extends BaseAnimate {
    /**
     * The unique name for this animation class, used for registration.
     * @static
     * @type {string}
     */
    public static readonly animationName: string = 'Fade';

    /**
     * Specifies that this animation requires exactly two sprites.
     * @static
     * @returns {number}
     */
    public static getRequiredSpriteCount(): number {
        return 2;
    }

    private readonly DURATION: number = 2.0; // Total duration of the animation in seconds
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

        // Handle looping
        if (this.elapsedTime >= this.DURATION) {
            const loops = Math.floor(this.elapsedTime / this.DURATION);

            if (this.elapsedTime % this.DURATION === 0) {
                // When we land exactly on a multiple of DURATION, for this frame, we should
                // show the state *at* the end of the animation, not the beginning of the next.
                this.elapsedTime = this.DURATION;
            } else {
                // Otherwise, wrap the time around for the next loop cycle.
                this.elapsedTime = this.elapsedTime % this.DURATION;
            }

            if (this.onComplete) {
                for (let i = 0; i < loops; i++) {
                    this.onComplete();
                }
            }
        }

        const sprite0 = this.sprites[0];
        const sprite1 = this.sprites[1];

        // Calculate progress as a value from 0.0 to 1.0
        const progress = this.elapsedTime / this.DURATION;

        // Sprite 0 fades out (alpha from 1.0 to 0.0)
        sprite0.alpha = 1.0 - progress;

        // Sprite 1 fades in (alpha from 0.0 to 1.0)
        sprite1.alpha = progress;
    }

    /**
     * Stops the animation and resets its internal state to the beginning.
     * This includes resetting the elapsed time and the sprites' opacity (alpha).
     */
    public stop(): void {
        super.stop(); // This sets isPlaying to false
        this.elapsedTime = 0;

        // Reset sprites to their initial alpha values.
        if (this.sprites && this.sprites.length === 2) {
            this.sprites[0].alpha = 1.0;
            this.sprites[1].alpha = 0.0;
        }
    }
}
