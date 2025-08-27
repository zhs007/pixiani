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

        this.mesh.width = this.sourceSprite.width;
        this.mesh.height = this.sourceSprite.height;
        this.originalVertices = new Float32Array(this.mesh.geometry.getBuffer('aPosition').data);

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

            const normalizedX = x / this.mesh.width;
            const waveOffset = Math.sin(normalizedX * Math.PI * 2 * this.waveFrequency + this.time * this.waveSpeed) * this.waveAmplitude;
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
