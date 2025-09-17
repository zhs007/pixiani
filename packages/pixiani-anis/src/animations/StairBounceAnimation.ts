import { BaseAnimate } from '@pixi-animation-library/pixiani-engine';
import * as PIXI from 'pixi.js';

type Particle = {
  sprite: PIXI.Sprite;
  startAt: number; // time when this particle starts
  dir: 1 | -1; // horizontal direction
  spawnX: number; // emitter x (x0 ± 50)
  dropDepth: number; // y0 + depth for first ground
  bounceCount: number;
  bounceTs: number[]; // per-bounce duration
  upAmps: number[]; // up amplitudes
  stepDowns: number[]; // ground drop per bounce
  dxUp: number[]; // horizontal dx during up half per bounce
  dxDown: number[]; // horizontal dx during down half per bounce
  totalT: number; // total lifetime (drop + sum(bounceTs))
  jitterX: number;
  jitterY: number;
};

/**
 * StairBounceAnimation
 * 300 particles fall from the top, then bounce along a descending staircase.
 * - Spawn x around screen center ±50px
 * - Direction left/right random per particle
 * - Bounce distances and heights randomized
 * - All particles finish within 10s total
 */
export class StairBounceAnimation extends BaseAnimate {
  public static readonly animationName: string = 'StairBounce';
  public static getRequiredSpriteCount(): number {
    return 1;
  }

  // Global timing
  private readonly TOTAL_TIME = 10.0; // seconds
  private readonly TARGET_COUNT = 300;

  // Per-particle timing
  private readonly DROP_T = 0.28; // drop from top to first ground
  private readonly BASE_BOUNCE_T = 0.17; // per bounce base duration

  private elapsed = 0;
  private spawned = 0;
  private spawnAccum = 0;
  private spawnInterval = 0.03; // will recompute on reset based on lifetime & TOTAL_TIME

  private particles: Particle[] = [];
  private source!: PIXI.Sprite;

  constructor(object: any, sprites: PIXI.Sprite[]) {
    super(object, sprites);
    this.source = sprites[0];
    this.loop = false; // finish after TOTAL_TIME
  }

  protected reset(): void {
    // Cleanup existing
    for (const p of this.particles) {
      try {
        this.object.removeChild(p.sprite);
      } catch {}
      try {
        (p.sprite as any).destroy?.({ children: true, texture: false, baseTexture: false });
      } catch {}
    }
    this.particles = [];
    this.elapsed = 0;
    this.spawned = 0;
    this.spawnAccum = 0;
    this.source.visible = false;

    // Estimate worst-case lifetime to ensure all finish by TOTAL_TIME
    const worstBounceCount = 7;
    const worstBounceT = this.BASE_BOUNCE_T * 1.25; // allow some variance
    const worstLifetime = this.DROP_T + worstBounceCount * worstBounceT; // ~1.45s
    const spawnWindow = Math.max(0.1, this.TOTAL_TIME - worstLifetime);
    this.spawnInterval = spawnWindow / this.TARGET_COUNT; // spread 300 spawns across spawnWindow
  }

  public update(dt: number): void {
    if (!this.isPlaying) return;
    this.elapsed += dt * this.speed;
    this.spawnAccum += dt * this.speed;

    // Spawn until reached target or out of spawn window
    const spawnWindowEnd = this.TOTAL_TIME - 0; // stop spawning when elapsed >= TOTAL_TIME - small epsilon
    while (
      this.spawned < this.TARGET_COUNT &&
      this.elapsed < spawnWindowEnd &&
      this.spawnAccum >= this.spawnInterval
    ) {
      this.spawnAccum -= this.spawnInterval;
      this.spawnOne();
      this.spawned++;
    }

    const _x0 = (this.source as any).x ?? 0;
    const y0 = (this.source as any).y ?? 0;

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      const t = this.elapsed - pt.startAt;
      if (t < 0) continue;

      if (t >= pt.totalT) {
        try {
          this.object.removeChild(pt.sprite);
        } catch {}
        this.particles.splice(i, 1);
        continue;
      }

      const s = pt.sprite as any;

      // Compute motion
      let xx = pt.spawnX;
      let yy = y0;

      if (t <= this.DROP_T) {
        // From top to first ground
        const u = Math.min(1, t / this.DROP_T);
        const pos = u * u; // ease-in
        const topY = -this.getScreenHeight() * 0.5;
        const endY = y0 + pt.dropDepth;
        yy = topY + (endY - topY) * pos;
        xx = pt.spawnX;
        s.alpha = 1;
      } else {
        // Bounces
        let tb = t - this.DROP_T;
        let sumDx = 0;
        let groundY = y0 + pt.dropDepth;
        let bi = 0;
        for (; bi < pt.bounceCount; bi++) {
          const T = pt.bounceTs[bi];
          if (tb <= T) break;
          tb -= T;
          groundY += pt.stepDowns[bi];
          sumDx += pt.dxUp[bi] + pt.dxDown[bi];
        }

        if (bi < pt.bounceCount) {
          const T = pt.bounceTs[bi];
          const half = T * 0.5;
          const up = pt.upAmps[bi];
          const step = pt.stepDowns[bi];
          const dxU = pt.dxUp[bi];
          const dxD = pt.dxDown[bi];

          // Fade on last bounce
          if (bi === pt.bounceCount - 1) {
            const k = Math.min(1, tb / T);
            s.alpha = 1 - k;
          } else {
            s.alpha = 1;
          }

          if (tb <= half) {
            const u = tb / half; // 0..1
            const h = up * (1 - (1 - u) * (1 - u)); // ease-out up
            yy = groundY - h;
            xx = pt.spawnX + sumDx + dxU * u;
          } else {
            const u = (tb - half) / half; // 0..1
            const down = (up + step) * (u * u); // ease-in down
            yy = groundY - up + down;
            xx = pt.spawnX + sumDx + dxU + dxD * u;
          }
        } else {
          // Clamp to last ground
          const finalGround = y0 + pt.dropDepth + pt.stepDowns.reduce((a, b) => a + b, 0);
          yy = finalGround;
          xx =
            pt.spawnX + pt.dxUp.reduce((a, b) => a + b, 0) + pt.dxDown.reduce((a, b) => a + b, 0);
          s.alpha = 0;
        }
      }

      // small jitter
      s.x = xx + pt.jitterX;
      s.y = yy + pt.jitterY;
    }

    // End condition
    if (this.elapsed >= this.TOTAL_TIME && this.particles.length === 0) {
      this.source.visible = true;
      this.setState('ENDED');
    }
  }

  private spawnOne(): void {
    const tex = this.source.texture;
    const s = new PIXI.Sprite(tex);
    const x0 = (this.source as any).x ?? 0;
    const _spawnX = x0 + (Math.random() * 100 - 50); // ±50px around center
    (s as any).x = _spawnX;
    (s as any).y = -this.getScreenHeight() * 0.5;
    (s as any).alpha = 1;
    if ((s as any).anchor?.set) (s as any).anchor.set(0.5);
    if ((s as any).scale?.set) (s as any).scale.set(1, 1);

    const dir: 1 | -1 = Math.random() < 0.5 ? -1 : 1;
    const rnd = (base: number, amp: number) => base + (Math.random() * 2 - 1) * amp;

    // Randomized staircase plan
    const dropDepth = rnd(210, 60); // ~150..270
    const bounceCount = 3 + Math.floor(Math.random() * 4); // 3..6
    const bounceTs: number[] = [];
    const upAmps: number[] = [];
    const stepDowns: number[] = [];
    const dxUp: number[] = [];
    const dxDown: number[] = [];

    let up = rnd(46, 18) * 2; // initial up amplitude doubled
    let hU = rnd(18, 10); // horizontal up per bounce
    let hD = rnd(26, 12); // horizontal down per bounce
    const baseStep = rnd(24, 10); // step height ~14..34

    for (let i = 0; i < bounceCount; i++) {
      const T = this.BASE_BOUNCE_T * rnd(1.0, 0.3); // ±15%
      bounceTs.push(T);
      const step = Math.max(8, rnd(baseStep, 6));
      stepDowns.push(step);
      upAmps.push(Math.max(6, up));
      dxUp.push(Math.max(6, hU) * dir);
      dxDown.push(Math.max(10, hD) * dir);
      // decay
      up *= rnd(0.78, 0.12);
      hU *= rnd(0.9, 0.1);
      hD *= rnd(0.9, 0.1);
    }

    const totalT = this.DROP_T + bounceTs.reduce((a, b) => a + b, 0);

    const particle: Particle = {
      sprite: s,
      startAt: this.elapsed,
      dir,
      spawnX: _spawnX,
      dropDepth,
      bounceCount,
      bounceTs,
      upAmps,
      stepDowns,
      dxUp,
      dxDown,
      totalT,
      jitterX: rnd(0, 2),
      jitterY: rnd(0, 2),
    };

    this.particles.push(particle);
    this.object.addChild(s);
  }

  public stop(): void {
    for (const p of this.particles) {
      try {
        this.object.removeChild(p.sprite);
      } catch {}
      try {
        (p.sprite as any).destroy?.({ children: true, texture: false, baseTexture: false });
      } catch {}
    }
    this.particles = [];
    this.source.visible = true;
    this.setState('IDLE');
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
