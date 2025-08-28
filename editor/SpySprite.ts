import * as PIXI from 'pixi.js';

let nextId = 0;

/**
 * A wrapper for PIXI.Sprite that spies on its property changes and logs them
 * to the console. This is used in the headless verification environment to
 * capture the exact behavior of an animation.
 */
export class SpySprite extends PIXI.Sprite {
  private readonly _spyId: number;

  constructor(texture: PIXI.Texture) {
    super(texture);
    this._spyId = nextId++;
    console.log(`[SPY] id=${this._spyId} event=created`);

    // Hook into the callback for observable points. This is the most efficient
    // way to spy on properties like position, scale, etc., as it also
    // captures changes to sub-properties like `position.x`.
    (this.position as PIXI.ObservablePoint).cb = () => this.logPoint('position', this.position);
    (this.scale as PIXI.ObservablePoint).cb = () => this.logPoint('scale', this.scale);
    (this.pivot as PIXI.ObservablePoint).cb = () => this.logPoint('pivot', this.pivot);
    (this.skew as PIXI.ObservablePoint).cb = () => this.logPoint('skew', this.skew);
  }

  /**
   * Logs the state of a PIXI.Point or PIXI.ObservablePoint.
   * @param propName The name of the property (e.g., 'position').
   * @param point The point object to log.
   */
  private logPoint(propName: string, point: PIXI.Point | PIXI.ObservablePoint) {
    // Log as a consistent key-value format for easier parsing.
    console.log(`[SPY] id=${this._spyId} prop=${propName} value=${point.x},${point.y}`);
  }

  // --- Override simple numeric/boolean properties ---

  override get rotation(): number {
    return super.rotation;
  }
  override set rotation(value: number) {
    if (super.rotation !== value) {
      super.rotation = value;
      console.log(`[SPY] id=${this._spyId} prop=rotation value=${value}`);
    }
  }

  override get alpha(): number {
    return super.alpha;
  }
  override set alpha(value: number) {
    if (super.alpha !== value) {
      super.alpha = value;
      console.log(`[SPY] id=${this._spyId} prop=alpha value=${value}`);
    }
  }

  override get visible(): boolean {
    return super.visible;
  }
  override set visible(value: boolean) {
    if (super.visible !== value) {
      super.visible = value;
      console.log(`[SPY] id=${this._spyId} prop=visible value=${value}`);
    }
  }

  // Note: We don't need to override `x` and `y` because they are just
  // getters/setters for `position.x` and `position.y`. Since we are
  // already spying on the `position` object via its callback, any changes
  // to `x` or `y` will be captured automatically.
}
