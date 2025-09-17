import { BaseAnimate } from '@pixi-animation-library/pixiani-engine';

enum AnimationPhase {
  SCALE_DOWN,
  ROTATE,
  SCALE_UP,
  ENDED,
}

export class ScaleRotateScale extends BaseAnimate {
  public static readonly animationName = 'ScaleRotateScale';
  public static getRequiredSpriteCount(): number {
    return 1;
  }

  private _currentPhase: AnimationPhase = AnimationPhase.ENDED;
  private _timeInPhase: number = 0;

  private readonly SCALE_DOWN_DURATION = 0.2;
  private readonly ROTATE_DURATION = 1.2;
  private readonly SCALE_UP_DURATION = 0.6; // Assuming 0.6s for scale up

  protected reset(): void {
    const sprite = this.sprites[0];
    if (!sprite) {
      // No sprite, skip setup until valid
      this._currentPhase = AnimationPhase.ENDED;
      return;
    }

    // Reset sprite properties to initial state for a clean restart
    sprite.scale.set(1.0);
    sprite.rotation = 0;

    this._currentPhase = AnimationPhase.SCALE_DOWN;
    this._timeInPhase = 0;
  }

  public update(deltaTime: number): void {
    if (!this.isPlaying || this._currentPhase === AnimationPhase.ENDED) {
      return;
    }

    const sprite = this.sprites[0];
    // if (!sprite || !sprite.texture?.valid) {
    //     return; // Skip if sprite or texture is not ready
    // }

    this._timeInPhase += deltaTime * this.speed;

    switch (this._currentPhase) {
      case AnimationPhase.SCALE_DOWN:
        if (this._timeInPhase >= this.SCALE_DOWN_DURATION) {
          sprite.scale.set(0.1); // Ensure final value
          this._currentPhase = AnimationPhase.ROTATE;
          this._timeInPhase = 0;
        } else {
          const progress = this._timeInPhase / this.SCALE_DOWN_DURATION;
          const currentScale = 1.0 - progress * (1.0 - 0.1); // From 1.0 to 0.1
          sprite.scale.set(currentScale);
        }
        break;

      case AnimationPhase.ROTATE:
        if (this._timeInPhase >= this.ROTATE_DURATION) {
          sprite.rotation = 2 * Math.PI; // Ensure final rotation (one full turn)
          this._currentPhase = AnimationPhase.SCALE_UP;
          this._timeInPhase = 0;
        } else {
          const progress = this._timeInPhase / this.ROTATE_DURATION;
          sprite.rotation = progress * 2 * Math.PI; // Full turn clockwise
        }
        break;

      case AnimationPhase.SCALE_UP:
        if (this._timeInPhase >= this.SCALE_UP_DURATION) {
          sprite.scale.set(2.0); // Ensure final value
          this._currentPhase = AnimationPhase.ENDED;
          // Animation complete, inform BaseAnimate
          this.setState('ENDED');
        } else {
          const progress = this._timeInPhase / this.SCALE_UP_DURATION;
          const currentScale = 0.1 + progress * (2.0 - 0.1); // From 0.1 to 2.0
          sprite.scale.set(currentScale);
        }
        break;
    }
  }
}
