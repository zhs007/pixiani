import { BaseAnimate } from '@pixi-animation-library/pixiani-engine';

/**
 * @class ComplexPopAnimation
 * @extends BaseAnimate
 * @description A complex, multi-stage animation involving scaling, rotation, and fading.
 */
export class ComplexPopAnimation extends BaseAnimate {
  public static readonly animationName: string = 'ComplexPop';

  public static getRequiredSpriteCount(): number {
    return 1;
  }

  private readonly DURATION: number = 1.5; // Total duration in seconds
  private elapsedTime: number = 0;

  protected reset(): void {
    this.elapsedTime = 0;
    if (this.sprites[0]) {
      this.sprites[0].scale.set(1.0);
      this.sprites[0].alpha = 1.0;
    }
  }

  public update(deltaTime: number): void {
    if (!this.isPlaying) return;

    this.elapsedTime += deltaTime;

    if (this.elapsedTime >= this.DURATION) {
      this.sprites[0].alpha = 0.0;
      this.setState('ENDED');
      return;
    }

    const sprite = this.sprites[0];
    let scale: number;

    sprite.alpha = 1.0;
    if (sprite.scale.x < 0) {
      sprite.scale.x *= -1;
    }

    if (this.elapsedTime < 0.3) {
      const progress = this.elapsedTime / 0.3;
      scale = 1.0 + 0.2 * progress;
      sprite.scale.set(scale);
    } else if (this.elapsedTime < 0.5) {
      const progress = (this.elapsedTime - 0.3) / 0.2;
      scale = 1.2 + 0.1 * progress;
      sprite.scale.set(scale);
    } else if (this.elapsedTime < 0.6) {
      const progress = (this.elapsedTime - 0.5) / 0.1;
      scale = 1.3 - 0.1 * progress;
      sprite.scale.set(scale);
    } else if (this.elapsedTime < 1.1) {
      sprite.scale.set(1.2);
    } else if (this.elapsedTime < 1.4) {
      const phaseProgress = (this.elapsedTime - 1.1) / 0.3;
      sprite.scale.x = 1.2 * Math.cos(phaseProgress * Math.PI * 2);
      sprite.scale.y = 1.2;
    } else {
      const progress = (this.elapsedTime - 1.4) / 0.1;
      scale = 1.2 + 0.3 * progress;
      sprite.scale.x = scale;
      sprite.scale.y = scale;
      sprite.alpha = 1.0 - progress;
    }
  }
}
