import { BaseAnimate } from '../core/BaseAnimate';

/**
 * @class ScaleAnimation
 * @extends BaseAnimate
 * @description A simple animation that scales a sprite down to 50% and back up to 100%
 * over a 2-second duration.
 */
export class ScaleAnimation extends BaseAnimate {
    public static readonly animationName: string = 'Scale';

    public static getRequiredSpriteCount(): number {
        return 1;
    }

    private readonly DURATION: number = 2.0;
    private readonly HALF_DURATION: number = this.DURATION / 2.0;
    private elapsedTime: number = 0;

    protected reset(): void {
        this.elapsedTime = 0;
        if (this.sprites[0]) {
            this.sprites[0].scale.set(1.0);
        }
    }

    public update(deltaTime: number): void {
        if (!this.isPlaying) return;

        this.elapsedTime += deltaTime;

        if (this.elapsedTime >= this.DURATION) {
            this.setState('ENDED');
            this.sprites[0].scale.set(1.0);
            return;
        }

        const sprite = this.sprites[0];
        let scale: number;

        if (this.elapsedTime <= this.HALF_DURATION) {
            const progress = this.elapsedTime / this.HALF_DURATION;
            scale = 1.0 + (0.5 - 1.0) * progress;
        } else {
            const progress = (this.elapsedTime - this.HALF_DURATION) / this.HALF_DURATION;
            scale = 0.5 + (1.0 - 0.5) * progress;
        }

        sprite.scale.set(scale);
    }
}
