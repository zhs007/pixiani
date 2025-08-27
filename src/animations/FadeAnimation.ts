import { BaseAnimate } from '../core/BaseAnimate';

/**
 * @class FadeAnimation
 * @extends BaseAnimate
 * @description An animation that cross-fades two sprites over a 2-second duration.
 * Sprite 0 fades from 100% to 0% opacity.
 * Sprite 1 fades from 0% to 100% opacity.
 */
export class FadeAnimation extends BaseAnimate {
    public static readonly animationName: string = 'Fade';

    public static getRequiredSpriteCount(): number {
        return 2;
    }

    private readonly DURATION: number = 2.0;
    private elapsedTime: number = 0;

    protected reset(): void {
        this.elapsedTime = 0;
        if (this.sprites[0]) this.sprites[0].alpha = 1.0;
        if (this.sprites[1]) this.sprites[1].alpha = 0.0;
    }

    public update(deltaTime: number): void {
        if (!this.isPlaying) return;

        this.elapsedTime += deltaTime;

        if (this.elapsedTime >= this.DURATION) {
            // Set final state first
            this.sprites[0].alpha = 0.0;
            this.sprites[1].alpha = 1.0;
            // Then change state, which will trigger the loop and call reset if needed
            this.setState('ENDED');
            return;
        }

        const sprite0 = this.sprites[0];
        const sprite1 = this.sprites[1];

        const progress = this.elapsedTime / this.DURATION;

        sprite0.alpha = 1.0 - progress;
        sprite1.alpha = progress;
    }
}
