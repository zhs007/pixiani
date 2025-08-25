import { BaseAnimate } from '../core/BaseAnimate';
import * as PIXI from 'pixi.js';

/**
 * @class FlagWaveAnimation
 * @extends BaseAnimate
 * @description Creates a flag-waving effect on a sprite's texture using a PlaneMesh.
 */
export class FlagWaveAnimation extends BaseAnimate {
    public static readonly animationName: string = 'FlagWave';

    public static getRequiredSpriteCount(): number {
        return 1;
    }

    private mesh: PIXI.MeshPlane | null = null;
    private readonly originalVertices: Float32Array;
    private readonly sourceSprite: PIXI.Sprite;
    private time: number = 0;

    // Animation parameters
    private readonly segments = { width: 20, height: 10 };
    private readonly waveAmplitude: number = 10; // The height of the waves
    private readonly waveFrequency: number = 0.5; // How many waves are on screen
    private readonly waveSpeed: number = 5; // How fast the waves move

    constructor(object: any, sprites: PIXI.Sprite[]) {
        super(object, sprites);
        this.sourceSprite = sprites[0];

        // In Pixi.js v8, asset loading is asynchronous. We assume the texture is
        // already loaded by the time the animation is created, so a 'valid' check is not needed.
        this.mesh = new PIXI.MeshPlane({
            texture: this.sourceSprite.texture,
            verticesX: this.segments.width,
            verticesY: this.segments.height,
        });

        // Match the mesh size to the sprite size
        this.mesh.width = this.sourceSprite.width;
        this.mesh.height = this.sourceSprite.height;

        this.originalVertices = new Float32Array(this.mesh.geometry.getBuffer('aPosition').data);

        // Add the mesh to the scene and hide the original sprite
        this.object.addChild(this.mesh);
        this.sourceSprite.visible = false;
    }

    public update(deltaTime: number): void {
        if (!this.isPlaying || !this.mesh) {
            return;
        }

        this.time += deltaTime;
        const positionBuffer = this.mesh.geometry.getBuffer('aPosition');
        const vertices = positionBuffer.data;
        const totalVertices = (this.segments.width + 1) * (this.segments.height + 1);

        for (let i = 0; i < totalVertices; i++) {
            // The vertices array is flat [x0, y0, x1, y1, ...]
            const x = this.originalVertices[i * 2];
            const y = this.originalVertices[i * 2 + 1];

            // Calculate the wave offset for the y position
            // Normalize x to a 0-1 range, then multiply by 2*PI to get a full sine wave cycle.
            const normalizedX = x / this.mesh.width;
            const waveOffset = Math.sin(normalizedX * Math.PI * 2 * this.waveFrequency + this.time * this.waveSpeed) * this.waveAmplitude;
            vertices[i * 2 + 1] = y + waveOffset;
        }

        positionBuffer.update();
    }

    public stop(): void {
        super.stop();
        this.time = 0;

        // Restore original vertices
        if (this.mesh) {
            // Remove the mesh from the scene
            this.object.removeChild(this.mesh);
            this.mesh.destroy();
            this.mesh = null;
        }

        // Make the original sprite visible again
        this.sourceSprite.visible = true;
    }
}
