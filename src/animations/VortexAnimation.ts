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
    private readonly originalVertices: Float32Array;
    private readonly sourceSprite: PIXI.Sprite;

    // Animation parameters
    private readonly DURATION: number = 3.0; // Total duration in seconds
    private readonly segments = { width: 10, height: 10 }; // Results in an 11x11 grid of points
    private readonly spirals: number = 2; // How many times the image will spiral
    private elapsedTime: number = 0;

    constructor(object: any, sprites: PIXI.Sprite[]) {
        super(object, sprites);
        this.sourceSprite = sprites[0];

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
        if (!this.isPlaying || !this.mesh) {
            return;
        }

        this.elapsedTime += deltaTime;
        const progress = Math.min(this.elapsedTime / this.DURATION, 1.0);

        const positionBuffer = this.mesh.geometry.getBuffer('aPosition');
        const vertices = positionBuffer.data;
        const totalVertices = (this.segments.width + 1) * (this.segments.height + 1);

        const centerX = this.mesh.width / 2;
        const centerY = this.mesh.height / 2;

        // Maximum possible radius (distance from center to corner) used to normalize radii
        const maxRadius = Math.sqrt(centerX * centerX + centerY * centerY);
        // Controls how much faster inner vertices move. Range [0,1). Larger -> inner vertices accelerate more.
        const innerAcceleration = 0.8;

        for (let i = 0; i < totalVertices; i++) {
            const ox = this.originalVertices[i * 2];
            const oy = this.originalVertices[i * 2 + 1];

            const dx = ox - centerX;
            const dy = oy - centerY;

            const originalRadius = Math.sqrt(dx * dx + dy * dy);
            const originalAngle = Math.atan2(dy, dx);

            // Normalized radius in [0,1] (0 at center, 1 at far corner)
            const rNorm = maxRadius > 0 ? originalRadius / maxRadius : 0;

            // Make inner vertices move faster by using a progress exponent < 1 for inner points.
            // Exponent varies from (1 - innerAcceleration) for rNorm=0 up to 1 for rNorm=1.
            const exponent = Math.max(0.05, 1 - innerAcceleration * (1 - rNorm));
            const radialProgress = Math.pow(progress, exponent);

            // Radius shrinks to 0 at progress = 1. inner vertices (small rNorm) get larger radialProgress => move faster.
            const newRadius = originalRadius * (1 - radialProgress);

            // Rotation amount scales with normalized radius so outer-most vertices complete `spirals` turns,
            // while inner vertices rotate less. Subtract for clockwise rotation.
            const rotationAmount = progress * this.spirals * Math.PI * 2 * rNorm;
            const newAngle = originalAngle - rotationAmount;

            vertices[i * 2] = centerX + newRadius * Math.cos(newAngle);
            vertices[i * 2 + 1] = centerY + newRadius * Math.sin(newAngle);
        }

        positionBuffer.update();

        if (this.elapsedTime >= this.DURATION) {
            this.elapsedTime = this.elapsedTime % this.DURATION;
            if (this.onComplete) this.onComplete();
        }
    }

    public stop(): void {
        super.stop();
        this.elapsedTime = 0;

        if (this.mesh) {
            this.object.removeChild(this.mesh);
            this.mesh.destroy();
            this.mesh = null;
        }

        this.sourceSprite.visible = true;
    }
}
