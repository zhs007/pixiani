import { BaseAnimate } from '../core/BaseAnimate';
import * as PIXI from 'pixi.js';

/**
 * @class VortexAnimation
 * @extends BaseAnimate
 * @description Creates a "black hole" vortex effect on a sprite's texture using a MeshPlane.
 * The image is rotated and pulled into the center over the duration.
 */
export class VortexAnimation extends BaseAnimate {
  public static readonly animationName: string = 'Vortex';

  public static getRequiredSpriteCount(): number {
    return 1;
  }

  private mesh: PIXI.MeshPlane | null = null;
  private originalVertices: Float32Array | null = null;
  private readonly sourceSprite: PIXI.Sprite;

  private readonly DURATION: number = 3.0;
  private readonly segments = { width: 10, height: 10 };
  private readonly spirals: number = 2;
  private elapsedTime: number = 0;

  constructor(object: any, sprites: PIXI.Sprite[]) {
    super(object, sprites);
    this.sourceSprite = sprites[0];
  }

  protected reset(): void {
    this.elapsedTime = 0;

    if (this.mesh) {
      this.object.removeChild(this.mesh);
      this.mesh.destroy();
    }

    this.mesh = new PIXI.MeshPlane({
      texture: this.sourceSprite.texture,
      verticesX: this.segments.width,
      verticesY: this.segments.height,
    });

    this.mesh.width = this.sourceSprite.width;
    this.mesh.height = this.sourceSprite.height;
    this.originalVertices = new Float32Array(this.mesh.geometry.getBuffer('aPosition').data);

    this.object.addChild(this.mesh);
    this.sourceSprite.visible = false;
  }

  public update(deltaTime: number): void {
    if (!this.isPlaying || !this.mesh || !this.originalVertices) return;

    this.elapsedTime += deltaTime;

    if (this.elapsedTime >= this.DURATION) {
      this.setState('ENDED');
      const positionBuffer = this.mesh.geometry.getBuffer('aPosition');
      const vertices = positionBuffer.data as Float32Array;
      const centerX = this.mesh.width / 2;
      const centerY = this.mesh.height / 2;
      for (let i = 0; i < vertices.length / 2; i++) {
        vertices[i * 2] = centerX;
        vertices[i * 2 + 1] = centerY;
      }
      positionBuffer.update();
      return;
    }

    const progress = this.elapsedTime / this.DURATION;
    const positionBuffer = this.mesh.geometry.getBuffer('aPosition');
    const vertices = positionBuffer.data as Float32Array;
    const centerX = this.mesh.width / 2;
    const centerY = this.mesh.height / 2;
    const maxRadius = Math.sqrt(centerX * centerX + centerY * centerY);
    const innerAcceleration = 0.8;

    for (let i = 0; i < vertices.length / 2; i++) {
      const ox = this.originalVertices[i * 2];
      const oy = this.originalVertices[i * 2 + 1];
      const dx = ox - centerX;
      const dy = oy - centerY;
      const originalRadius = Math.sqrt(dx * dx + dy * dy);
      const originalAngle = Math.atan2(dy, dx);
      const rNorm = maxRadius > 0 ? originalRadius / maxRadius : 0;
      const exponent = Math.max(0.05, 1 - innerAcceleration * (1 - rNorm));
      const radialProgress = Math.pow(progress, exponent);
      const newRadius = originalRadius * (1 - radialProgress);
      const rotationAmount = progress * this.spirals * Math.PI * 2 * rNorm;
      const newAngle = originalAngle - rotationAmount;

      vertices[i * 2] = centerX + newRadius * Math.cos(newAngle);
      vertices[i * 2 + 1] = centerY + newRadius * Math.sin(newAngle);
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
