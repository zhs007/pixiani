import { BaseAnimate } from '../core/BaseAnimate';
import * as PIXI from 'pixi.js';

/**
 * @class BlackHoleSpiralAnimation
 * @extends BaseAnimate
 * @description Mesh vertices spiral clockwise into the sprite center over a fixed duration.
 */
export class BlackHoleSpiralAnimation extends BaseAnimate {
    public static readonly animationName: string = 'BlackHoleSpiral';

    public static getRequiredSpriteCount(): number {
        return 1;
    }

    private mesh: PIXI.MeshPlane | null = null;
    private originalVertices: Float32Array | null = null;
    private geomMinX = 0;
    private geomMaxX = 0;
    private geomMinY = 0;
    private geomMaxY = 0;
    private centerX = 0;
    private centerY = 0;

    private r0: Float32Array | null = null; // initial radii (for reference only)

    private readonly sourceSprite: PIXI.Sprite;
    private elapsed = 0;

    private readonly segments = { width: 128, height: 128 }; // very dense grid for ultra-smooth whirl
    private readonly duration = 3.0; // seconds
    private readonly revolutions = 1.5; // base clockwise turns while spiraling in

    // Global radius-only speed model parameters
    private rEps = 0.5;                // finish radius threshold (pixels)
    private radialCoeff = 1;          // A in dr/dt = -A/(r+eps)
    private angularPerRadius = 0;     // k in dθ = k * dr (to reach ~1.5 turns)

    constructor(object: any, sprites: PIXI.Sprite[]) {
        super(object, sprites);
        this.sourceSprite = sprites[0];
        this.loop = false; // default not loop for this effect
    }

    protected reset(): void {
        this.elapsed = 0;

        if (this.mesh) {
            this.object.removeChild(this.mesh);
            this.mesh.destroy();
        }

        this.mesh = new PIXI.MeshPlane({
            texture: this.sourceSprite.texture,
            verticesX: this.segments.width,
            verticesY: this.segments.height,
        });

        // Clone vertex buffer and compute geometry bounds
        const posBuffer = this.mesh.geometry.getBuffer('aPosition');
        const verts = posBuffer.data as Float32Array;
        this.originalVertices = new Float32Array(verts);

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
        this.centerX = (this.geomMinX + this.geomMaxX) * 0.5;
        this.centerY = (this.geomMinY + this.geomMaxY) * 0.5;

        // Precompute initial radii for statistics
        const count = this.originalVertices.length / 2;
        this.r0 = new Float32Array(count);
        let rSum = 0;
        let rMax = 0;
        for (let i = 0; i < count; i++) {
            const x = this.originalVertices[i * 2] - this.centerX;
            const y = this.originalVertices[i * 2 + 1] - this.centerY;
            const r = Math.hypot(x, y);
            this.r0[i] = r;
            rSum += r;
            if (r > rMax) rMax = r;
        }
        const rAvg = count > 0 ? rSum / count : 0;

        // Geometry-based finish epsilon ~1% of min dimension (>=0.5px)
        const minDim = Math.max(1e-6, Math.min(this.geomMaxX - this.geomMinX, this.geomMaxY - this.geomMinY));
        this.rEps = Math.max(0.5, minDim * 0.01);

        // Choose radialCoeff so that the farthest point (~rMax) finishes around duration for p=1
        // dr/dt = -A/(r+eps) => t = ((r0+eps)^2 - (rEps+eps)^2)/(2A)
        const eps = 1e-3;
        const denom = Math.max(1e-6, ((rMax + eps) * (rMax + eps) - (this.rEps + eps) * (this.rEps + eps)) / (2 * this.duration));
        this.radialCoeff = denom; // A

        // Set angularPerRadius so that average point rotates ~revolutions turns while shrinking from rAvg->rEps
        // dθ = k * dr => Δθ ≈ k * (rAvg - rEps)
        const targetAngle = this.revolutions * Math.PI * 2;
        this.angularPerRadius = targetAngle / Math.max(1e-6, (rAvg - this.rEps));

        // Align mesh transform with source sprite (emulate anchor via pivot)
        const geomW = this.geomMaxX - this.geomMinX;
        const geomH = this.geomMaxY - this.geomMinY;
        const anchorX = (this as any).sourceSprite?.anchor?.x ?? 0;
        const anchorY = (this as any).sourceSprite?.anchor?.y ?? 0;
        if ((this.mesh as any).pivot?.set) {
            this.mesh.pivot.set(
                this.geomMinX + geomW * anchorX,
                this.geomMinY + geomH * anchorY,
            );
        }
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
        if (!this.isPlaying || !this.mesh) return;

        this.elapsed += deltaTime;
        const posBuffer = this.mesh.geometry.getBuffer('aPosition');
        const verts = posBuffer.data as Float32Array;

        // Global time fraction
        const tGlobal = Math.min(1, this.elapsed / this.duration);
        const smoothstep = (e0: number, e1: number, x: number) => {
            const t = Math.max(0, Math.min(1, (x - e0) / Math.max(1e-6, e1 - e0)));
            return t * t * (3 - 2 * t);
        };
        // Tail boost: significantly faster after halfway point
        const tail = smoothstep(0.5, 0.9, tGlobal);
        const tail2 = smoothstep(0.9, 0.98, tGlobal);
        const tailBoost = 1 + 4 * tail + 3 * tail2; // up to ~8x near the end

        let finished = 0;
        for (let i = 0; i < verts.length; i += 2) {
            const x0 = verts[i] - this.centerX;
            const y0 = verts[i + 1] - this.centerY;
            let r = Math.hypot(x0, y0);
            let theta = Math.atan2(y0, x0);

            if (r <= this.rEps) {
                finished++;
                continue;
            }

            // Radius-only speeds (same for all vertices at same r)
            const radialSpeed = (this.radialCoeff / (r + 1e-3)) * tailBoost; // pixels/sec with late boost
            const dr = radialSpeed * deltaTime;
            const newR = Math.max(this.rEps, r - dr);

            // Angle change proportional to radius change to target ~revolutions total
            const dtheta = this.angularPerRadius * (r - newR);
            theta -= dtheta; // clockwise

            const nx = this.centerX + Math.cos(theta) * newR;
            const ny = this.centerY + Math.sin(theta) * newR;
            verts[i] = nx;
            verts[i + 1] = ny;

            if (newR <= this.rEps) finished++;
        }

        posBuffer.update();

        // End when all vertices finished
        if (finished * 2 >= verts.length) {
            this.setState('ENDED');
        }
    }

    public stop(): void {
        super.stop();
        this.sourceSprite.visible = true;
        if (this.mesh) {
            this.mesh.visible = false;
        }
    }
}
