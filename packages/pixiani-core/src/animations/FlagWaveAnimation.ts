import { BaseAnimate } from '../core/BaseAnimate';
import * as PIXI from 'pixi.js';

/**
 * @class FlagWaveAnimation
 * @extends BaseAnimate
 * @description Creates a flag-waving effect on a sprite's texture using a PlaneMesh.
 * This is a continuous animation that does not have an end state.
 */
export class FlagWaveAnimation extends BaseAnimate {
  public static readonly animationName: string = 'FlagWave';

  public static getRequiredSpriteCount(): number {
    return 1;
  }

  private mesh: PIXI.MeshPlane | null = null;
  private originalVertices: Float32Array | null = null;
  // Geometry-space bounds used for normalization and pivot calculation
  private geomMinX: number = 0;
  private geomMaxX: number = 0;
  private geomMinY: number = 0;
  private geomMaxY: number = 0;
  private readonly sourceSprite: PIXI.Sprite;
  private time: number = 0;

  private readonly segments = { width: 20, height: 10 };
  private readonly waveAmplitude: number = 10;
  private readonly waveFrequency: number = 0.5;
  private readonly waveSpeed: number = 5;

  constructor(object: any, sprites: PIXI.Sprite[]) {
    super(object, sprites);
    this.sourceSprite = sprites[0];
  }

  protected reset(): void {
    this.time = 0;

    if (this.mesh) {
      this.object.removeChild(this.mesh);
      this.mesh.destroy();
    }

    this.mesh = new PIXI.MeshPlane({
      texture: this.sourceSprite.texture,
      verticesX: this.segments.width,
      verticesY: this.segments.height,
    });

    // Clone original vertex positions (geometry/local space)
    const posBuffer = this.mesh.geometry.getBuffer('aPosition');
    this.originalVertices = new Float32Array(posBuffer.data as Float32Array);

    // Compute geometry bounds for normalization and pivot
    let minX = Number.POSITIVE_INFINITY,
      maxX = Number.NEGATIVE_INFINITY,
      minY = Number.POSITIVE_INFINITY,
      maxY = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < this.originalVertices.length; i += 2) {
      const x = this.originalVertices[i];
      const y = this.originalVertices[i + 1];
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    this.geomMinX = isFinite(minX) ? minX : 0;
    this.geomMaxX = isFinite(maxX) ? maxX : 0;
    this.geomMinY = isFinite(minY) ? minY : 0;
    this.geomMaxY = isFinite(maxY) ? maxY : 0;

    // Emulate sprite anchor using mesh pivot (mesh has no anchor)
    const geomW = this.geomMaxX - this.geomMinX;
    const geomH = this.geomMaxY - this.geomMinY;
    const anchorX = (this as any).sourceSprite?.anchor?.x ?? 0;
    const anchorY = (this as any).sourceSprite?.anchor?.y ?? 0;
    if ((this.mesh as any).pivot?.set) {
      this.mesh.pivot.set(this.geomMinX + geomW * anchorX, this.geomMinY + geomH * anchorY);
    }

    // Match sprite transform so visual position stays consistent
    if ((this.sourceSprite as any).position && (this.mesh as any).position) {
      this.mesh.position.copyFrom((this.sourceSprite as any).position);
    }
    if ((this.sourceSprite as any).scale && (this.mesh as any).scale) {
      this.mesh.scale.copyFrom((this.sourceSprite as any).scale);
    }
    if (typeof (this.sourceSprite as any).rotation === 'number') {
      this.mesh.rotation = (this.sourceSprite as any).rotation;
    }

    this.object.addChild(this.mesh);
    this.sourceSprite.visible = false;
  }

  public update(deltaTime: number): void {
    if (!this.isPlaying || !this.mesh || !this.originalVertices) return;

    this.time += deltaTime;
    const positionBuffer = this.mesh.geometry.getBuffer('aPosition');
    const vertices = positionBuffer.data as Float32Array;

    for (let i = 0; i < vertices.length / 2; i++) {
      const x = this.originalVertices[i * 2];
      const y = this.originalVertices[i * 2 + 1];
      // Normalize using geometry bounds to avoid discrepancies with transform width
      const normalizedX = (x - this.geomMinX) / Math.max(1e-6, this.geomMaxX - this.geomMinX);
      const waveOffset =
        Math.sin(normalizedX * Math.PI * 2 * this.waveFrequency + this.time * this.waveSpeed) *
        this.waveAmplitude;
      vertices[i * 2 + 1] = y + waveOffset;
    }

    positionBuffer.update();
  }

  public stop(): void {
    super.stop();
    this.sourceSprite.visible = true;
    if (this.mesh) {
      this.mesh.visible = false;
    }
  }
}
