import { BaseAnimate } from '../core/BaseAnimate';
import * as PIXI from 'pixi.js';

/**
 * @class ParticleSpinAnimation
 * @extends BaseAnimate
 * @description Spawns 60 particles using the source sprite's texture that fall from above with
 *              a normal-distributed X around center, collide with a ground line elastically,
 *              and may bounce several times. Runs for 3 seconds.
 */
export class ParticleSpinAnimation extends BaseAnimate {
  public static readonly animationName: string = 'ParticleSpin';

  public static getRequiredSpriteCount(): number {
    return 1;
  }

  private readonly DURATION = 10.0; // seconds
  private readonly PARTICLE_COUNT = 200;
  private readonly GRAVITY = 1400; // px/s^2 (faster fall)
  private readonly REST_MIN = 0.45; // more loss on bounce
  private readonly REST_MAX = 0.7;
  private readonly GROUND_Y = 120; // local space Y of the ground (center-down region)
  private readonly SPAWN_Y = -200; // spawn height above origin
  private readonly SIGMA_X = 80; // legacy default sigma for X (unused now)
  private readonly CLAMP_X = 200; // legacy clamp (unused now)
  private readonly FRICTION_MIN = 0.7; // stronger horizontal friction per bounce
  private readonly FRICTION_MAX = 0.92;
  private readonly H_NUDGE = 80; // stronger outward push per bounce (px/s)

  private elapsed = 0;
  private sourceSprite!: PIXI.Sprite;
  private particles: PIXI.Sprite[] = [];
  private vxs: number[] = [];
  private vys: number[] = [];
  private active: boolean[] = [];
  private spawnDelays: number[] = [];
  private restitutions: number[] = [];
  private frictions: number[] = [];
  private bounceCounts: number[] = [];
  // Per-particle lifetime controls
  private readonly PARTICLE_LIFETIME = 1.0; // seconds total life per particle
  private readonly PARTICLE_FADE_START = 0.8; // start fading at 0.8s (last 0.2s)

  constructor(object: any, sprites: PIXI.Sprite[]) {
    super(object, sprites);
    this.sourceSprite = sprites[0];
    this.loop = false; // one-shot by default
  }

  protected reset(): void {
    this.cleanupParticles();
    this.elapsed = 0;

    // Hide the source sprite during the effect
    this.sourceSprite.visible = false;

    const tex = this.sourceSprite.texture;
    const cx = (this.sourceSprite as any).x ?? 0;
    const spawnY = this.SPAWN_Y;

    const normal = () => {
      // Box–Muller transform
      let u = 0,
        v = 0;
      while (u === 0) u = Math.random();
      while (v === 0) v = Math.random();
      return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    };

    for (let i = 0; i < this.PARTICLE_COUNT; i++) {
      const p = new PIXI.Sprite(tex);
      // Center 10% of screen width as spawn region
      const screenW = this.getScreenWidth();
      const halfRegion = screenW * 0.05; // 10% total width => half is 5%
      const sigma = halfRegion / 3; // ~99.7% within region by 3σ
      const nx = normal() * sigma; // N(0, sigma^2)
      const x = cx + Math.max(-halfRegion, Math.min(halfRegion, nx));
      (p as any).x = x;
      (p as any).y = spawnY;

      // scale down to avoid huge sprites if texture is large
      if ((p as any).scale?.set) (p as any).scale.set(0.2);

      // initial velocities: slight horizontal jitter, zero vertical
      this.vxs[i] = (Math.random() - 0.5) * 60; // +-30 px/s
      this.vys[i] = 0;

      // randomized restitution and friction
      this.restitutions[i] = this.REST_MIN + Math.random() * (this.REST_MAX - this.REST_MIN);
      this.frictions[i] =
        this.FRICTION_MIN + Math.random() * (this.FRICTION_MAX - this.FRICTION_MIN);
      this.bounceCounts[i] = 0;

      // evenly distributed spawn time across the whole duration
      this.spawnDelays[i] = (i * this.DURATION) / this.PARTICLE_COUNT;
      this.active[i] = false;

      // keep invisible until activation
      (p as any).visible = false;
      (p as any).alpha = 1.0;
      this.particles.push(p);
    }
  }

  public update(deltaTime: number): void {
    if (!this.isPlaying) return;

    this.elapsed += deltaTime;
    if (this.elapsed >= this.DURATION) {
      this.setState('ENDED');
      this.stop();
      return;
    }

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i] as any;

      // Activate on spawn time
      if (!this.active[i]) {
        if (this.elapsed >= this.spawnDelays[i]) {
          // add to display tree once
          try {
            this.object.addChild(p);
          } catch {}
          p.visible = true;
          this.active[i] = true;
        } else {
          continue;
        }
      }

      // Integrate velocity with gravity
      this.vys[i] += this.GRAVITY * deltaTime;
      p.x += this.vxs[i] * deltaTime;
      p.y += this.vys[i] * deltaTime;

      // Per-particle lifetime and fade (time-based)
      const sinceSpawn = Math.max(0, this.elapsed - (this.spawnDelays[i] ?? 0));
      if (sinceSpawn >= this.PARTICLE_FADE_START) {
        const t = Math.min(
          1,
          (sinceSpawn - this.PARTICLE_FADE_START) /
            Math.max(0.001, this.PARTICLE_LIFETIME - this.PARTICLE_FADE_START),
        );
        p.alpha = 1 - t;
      }
      if (sinceSpawn >= this.PARTICLE_LIFETIME) {
        // Deactivate and remove
        try {
          this.object.removeChild(p);
        } catch {}
        p.visible = false;
        this.active[i] = false;
        continue;
      }

      // Ground collision at local Y = GROUND_Y
      if (p.y >= this.GROUND_Y) {
        p.y = this.GROUND_Y;
        // Reflect vertical velocity with restitution (per particle) and extra slowdown after bounce
        this.vys[i] = -this.vys[i] * (this.restitutions[i] ?? 0.7);
        const postSlow = this.bounceCounts[i] === 0 ? 0.9 : 0.85; // slower after each bounce
        this.vys[i] *= postSlow;
        this.bounceCounts[i]++;
        // Apply horizontal friction and small outward nudge
        this.vxs[i] *= this.frictions[i] ?? 0.9;
        const centerX = (this.sourceSprite as any).x ?? 0;
        let outwardSign = Math.sign((p as any).x - centerX);
        if (outwardSign === 0) outwardSign = Math.random() < 0.5 ? -1 : 1;
        this.vxs[i] += outwardSign * this.H_NUDGE; // stronger outward push

        // Small threshold to stop jittering
        if (Math.abs(this.vys[i]) < 30) {
          this.vys[i] = 0;
        }
      }
    }
  }

  private getScreenWidth(): number {
    try {
      if (typeof window !== 'undefined' && (window as any).innerWidth) {
        return Math.max(1, (window as any).innerWidth);
      }
    } catch {}
    return 800; // fallback
  }

  public stop(): void {
    this.cleanupParticles();
    this.sourceSprite.visible = true;
    this.setState('IDLE');
  }

  private cleanupParticles(): void {
    if (this.particles.length === 0) return;
    for (const p of this.particles) {
      try {
        this.object.removeChild(p);
      } catch {}
      if ((p as any).destroy) {
        try {
          (p as any).destroy({ children: true, texture: false, baseTexture: false });
        } catch {}
      }
    }
    this.particles = [];
    this.vxs = [];
    this.vys = [];
    this.active = [];
    this.spawnDelays = [];
    this.restitutions = [];
    this.frictions = [];
    this.bounceCounts = [];
  }
}
