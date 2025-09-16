import { BaseAnimate } from '../core/BaseAnimate';
import * as PIXI from 'pixi.js';

/**
 * ArcBounce3sAnimation
 * A single-sprite animation that follows the sketch:
 * 1) Vertical drop from top
 * 2) First arc bounce to the right
 * 3) Second smaller arc bounce to the right
 * 4) Final short drop off the screen
 *
 * Total duration: 3s (at speed = 1)
 * Path scales with the current render area. Will scale the sprite down if it's too large
 * to keep the full motion visible inside the editor preview.
 */
export class ArcBounce3sAnimation extends BaseAnimate {
  public static readonly animationName: string = 'ArcBounce3s';
  public static getRequiredSpriteCount(): number {
    return 9;
  }

  private readonly DURATION = 3.0; // seconds at speed=1
  private elapsed = 0;

  // Frame animation: 9 frames looped every 0.3s
  private readonly FRAME_LOOP = 0.3;
  private readonly FRAME_COUNT = 9;
  private readonly FRAME_DT = 0.3 / 9; // computed statically to avoid TS ordering issues
  private currentFrame = 0;

  // Cached motion plan computed on reset using current screen size
  private x0 = 0; // start/drop x
  private yTop = -300; // dynamic top start
  private g1 = -60; // ground 1 y
  private g2 = 60; // ground 2 y
  private g3 = 180; // ground 3 y
  private x1 = 0; // bounce 1 land x
  private x2 = 0; // bounce 2 land x
  private xOut = 0; // final drop x
  private a1 = 120; // arc1 amplitude (upwards)
  private a2 = 70; // arc2 amplitude (upwards)

  // Segment durations (sum = 3)
  private readonly T0 = 0.7; // top -> g1 (vertical)
  private readonly T1 = 1.1; // g1 -> g2 (arc)
  private readonly T2 = 0.8; // g2 -> g3 (arc)
  private readonly T3 = 0.4; // g3 -> off-screen (drop)

  private getFrameSprite(idx: number): PIXI.Sprite {
    return this.sprites[idx];
  }

  protected reset(): void {
    this.elapsed = 0;
    this.currentFrame = 0;

    // Prepare all frame sprites: center anchors and normalize scale
    for (let i = 0; i < this.FRAME_COUNT; i++) {
      const sp = this.getFrameSprite(i) as any;
      try {
        sp.anchor?.set?.(0.5);
      } catch {}
      sp.alpha = 1;
      sp.visible = i === 0; // only first frame visible initially
      try {
        sp.scale.set(1, 1);
      } catch {}
    }

    const W = this.getScreenWidth();
    const H = this.getScreenHeight();
    const minSide = Math.max(1, Math.min(W, H));
    // Use first frame as representative for sizing
    const rep = this.getFrameSprite(0);
    const maxSprite = Math.max(1, Math.max(rep.width, rep.height));
    const targetSize = minSide * 0.12; // keep sprite about 12% of the shorter side
    if (maxSprite > 0) {
      const k = Math.min(1, targetSize / maxSprite);
      // apply same scale to all frames to keep them aligned
      for (let i = 0; i < this.FRAME_COUNT; i++) {
        try {
          this.getFrameSprite(i).scale.set(k, k);
        } catch {}
      }
    }

    // Re-evaluate after scaling
    const margin = Math.max(16, minSide * 0.02);
    const halfW = W * 0.5;
    const halfH = H * 0.5;
    const spH = Math.max(1, rep.height);

    // Start near left side, a little inwards
    this.x0 = -halfW * 0.25;
    this.yTop = -halfH - spH * 0.6; // start above the visible top

    // Ground levels step down
    this.g1 = -halfH * 0.15; // slightly above center
    this.g2 = halfH * 0.1; // below center
    this.g3 = halfH * 0.3; // further down

    // Landings move to the right
    this.x1 = Math.min(halfW - margin, this.x0 + W * 0.28);
    this.x2 = Math.min(halfW - margin, this.x1 + W * 0.26);
    this.xOut = Math.min(halfW - margin, this.x2 + W * 0.18);

    // Arc amplitudes scale with height
    this.a1 = Math.max(20, H * 0.22);
    this.a2 = Math.max(12, H * 0.12);
  }

  public update(deltaTime: number): void {
    if (!this.isPlaying) return;
    this.elapsed += deltaTime * this.speed;

    const t = this.elapsed;
    // frame selection (looped every FRAME_LOOP)
    const frameTime = ((t % this.FRAME_LOOP) + this.FRAME_LOOP) % this.FRAME_LOOP; // safe modulo
    const nextFrame = Math.floor(frameTime / this.FRAME_DT) % this.FRAME_COUNT;
    if (nextFrame !== this.currentFrame) {
      try {
        this.getFrameSprite(this.currentFrame).visible = false;
      } catch {}
      try {
        this.getFrameSprite(nextFrame).visible = true;
      } catch {}
      this.currentFrame = nextFrame;
    }

    const S = this.getFrameSprite(this.currentFrame) as any;

    // Piecewise segments
    if (t <= this.T0) {
      // Vertical drop from yTop -> g1 at x0
      const u = Math.max(0, Math.min(1, t / this.T0));
      // ease-in with quadratic
      const y = this.yTop + (this.g1 - this.yTop) * (u * u);
      S.x = this.x0;
      S.y = y;
      S.rotation = 0;
      S.alpha = 1;
      return;
    }

    if (t <= this.T0 + this.T1) {
      // First arc: (x0,g1) -> (x1,g2)
      const tb = t - this.T0;
      const u = Math.max(0, Math.min(1, tb / this.T1));
      const x = this.lerp(this.x0, this.x1, u);
      const base = this.lerp(this.g1, this.g2, u);
      const arc = -this.a1 * 4 * u * (1 - u); // parabola peak at u=0.5
      S.x = x;
      S.y = base + arc;
      S.rotation = 0.15 * Math.sin(u * Math.PI); // subtle tilt
      S.alpha = 1;
      return;
    }

    if (t <= this.T0 + this.T1 + this.T2) {
      // Second arc: (x1,g2) -> (x2,g3)
      const tb = t - (this.T0 + this.T1);
      const u = Math.max(0, Math.min(1, tb / this.T2));
      const x = this.lerp(this.x1, this.x2, u);
      const base = this.lerp(this.g2, this.g3, u);
      const arc = -this.a2 * 4 * u * (1 - u);
      S.x = x;
      S.y = base + arc;
      S.rotation = 0.1 * Math.sin(u * Math.PI * 1.5);
      S.alpha = 1;
      return;
    }

    if (t <= this.DURATION) {
      // Final drop from (x2,g3) -> off-screen bottom
      const tb = t - (this.T0 + this.T1 + this.T2);
      const u = Math.max(0, Math.min(1, tb / this.T3));
      const H = this.getScreenHeight();
      const yEnd = H * 0.5 + this.getFrameSprite(0).height * 0.8;
      const y = this.g3 + (yEnd - this.g3) * (u * u); // ease-in
      const x = this.lerp(this.x2, this.xOut, u);
      S.x = x;
      S.y = y;
      S.rotation = 0;
      S.alpha = 1 - 0.25 * u; // slight fade at the end
      return;
    }

    // Done
    this.setState('ENDED');
  }

  public stop(): void {
    super.stop();
    // Ensure visible in original place if reused
    try {
      this.getFrameSprite(0).alpha = 1;
    } catch {}
  }

  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  private getScreenWidth(): number {
    try {
      if (typeof window !== 'undefined' && (window as any).innerWidth) {
        return Math.max(1, (window as any).innerWidth);
      }
    } catch {}
    return 800;
  }

  private getScreenHeight(): number {
    try {
      if (typeof window !== 'undefined' && (window as any).innerHeight) {
        return Math.max(1, (window as any).innerHeight);
      }
    } catch {}
    return 600;
  }
}
