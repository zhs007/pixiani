import { BaseAnimate } from '../core/BaseAnimate';
import * as PIXI from 'pixi.js';

/**
 * @class ComplexPopAnimation
 * @extends BaseAnimate
 * @description A complex, multi-stage animation involving scaling, rotation, and fading.
 */
export class ComplexPopAnimation extends BaseAnimate {
    /**
     * The unique name for this animation class.
     * @static
     */
    public static readonly animationName: string = 'ComplexPop';

    /**
     * This animation requires exactly one sprite.
     * @static
     */
    public static getRequiredSpriteCount(): number {
        return 1;
    }

    private readonly DURATION: number = 1.5; // Total duration in seconds
    private elapsedTime: number = 0;

    /**
     * Updates the animation state for the current frame.
     * @param {number} deltaTime - The time elapsed since the last frame.
     */
    public update(deltaTime: number): void {
        if (!this.isPlaying) {
            return;
        }

        this.elapsedTime += deltaTime;

        if (this.elapsedTime >= this.DURATION) {
            if (this.elapsedTime % this.DURATION === 0) {
                this.elapsedTime = this.DURATION;
            } else {
                this.elapsedTime = this.elapsedTime % this.DURATION;
            }
        }

        const sprite = this.sprites[0];
        let scale: number;

        // Reset alpha at the start of each frame, as it's only modified in the last phase.
        sprite.alpha = 1.0;

        if (this.elapsedTime < 0.3) {
            // Phase 1: 0.0s -> 0.3s (Scale from 100% to 120%)
            const progress = this.elapsedTime / 0.3;
            scale = 1.0 + 0.2 * progress;
            sprite.scale.set(scale);
        } else if (this.elapsedTime < 0.5) {
            // Phase 2: 0.3s -> 0.5s (Scale from 120% to 130%)
            const progress = (this.elapsedTime - 0.3) / 0.2;
            scale = 1.2 + 0.1 * progress;
            sprite.scale.set(scale);
        } else if (this.elapsedTime < 0.6) {
            // Phase 3: 0.5s -> 0.6s (Scale from 130% to 120%)
            const progress = (this.elapsedTime - 0.5) / 0.1;
            scale = 1.3 - 0.1 * progress;
            sprite.scale.set(scale);
        } else if (this.elapsedTime < 1.1) {
            // Phase 4: 0.6s -> 1.1s (Hold scale at 120%)
            sprite.scale.set(1.2);
        } else if (this.elapsedTime < 1.4) {
            // Phase 5: 1.1s -> 1.4s (Y-axis rotation)
            const phaseProgress = (this.elapsedTime - 1.1) / 0.3;
            // Full rotation is 2 * PI. We map progress (0-1) to a cosine wave (-1 to 1)
            sprite.scale.x = 1.2 * Math.cos(phaseProgress * Math.PI * 2);
            sprite.scale.y = 1.2;
        } else {
            // Phase 6: 1.4s -> 1.5s (Scale to 150% and fade out)
            const progress = (this.elapsedTime - 1.4) / 0.1;
            scale = 1.2 + 0.3 * progress;
            sprite.scale.set(scale);
            sprite.alpha = 1.0 - progress;
        }
    }

    /**
     * Stops the animation and resets the sprite to its initial state.
     */
    public stop(): void {
        super.stop();
        this.elapsedTime = 0;
        if (this.sprites && this.sprites[0]) {
            this.sprites[0].scale.set(1.0);
            this.sprites[0].alpha = 1.0;
        }
    }
}
