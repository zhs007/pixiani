import { BaseAnimate } from '@pixi-animation-library/pixiani-engine';
import * as PIXI from 'pixi.js';

type Coin = {
  sprite: PIXI.Sprite;
  startAt: number; // animation-local time when this coin starts
  dir: 1 | -1; // horizontal direction
  spawnX: number; // initial x position (x0 ± 30)
  // staircase timeline
  dropDepth: number; // initial drop to first ground (e.g., 200)
  bounceCount: number;
  bounceTs: number[]; // durations per bounce
  upAmps: number[]; // up amplitude for each bounce
  stepDowns: number[]; // per-bounce ground drop (step height)
  dxUp: number[]; // per-bounce horizontal during up half
  dxDown: number[]; // per-bounce horizontal during down half
  coinT: number; // total duration (drop + sum(bounceTs))
  jitterX: number; // small fixed jitter
  jitterY: number; // small fixed jitter
  wiggleAmp: number; // low amplitude wiggle
  wiggleFreq: number; // Hz
};

/**
 * @class CoinV2Animation
 * @description 1 coin sprite texture, spawns 50 coins in sequence (every 0.05s), each coin plays a 0.7s
 * timeline: 0.3s accelerate fall from (x0, y0+100) to (x0, y0) with X-axis-like flip (simulated by scaleY),
 * then two bounces (0.2s each) with specified offsets; on second bounce alpha fades 1->0.
 * Looping spawn; per-coin randomness applied.
 */
export class CoinV2Animation extends BaseAnimate {
  public static readonly animationName: string = 'CoinV2';
  public static getRequiredSpriteCount(): number {
    return 1;
  }

  private readonly DROP_T = 0.3;
  private readonly BASE_BOUNCE_T = 0.18; // base per-bounce duration

  private readonly SPAWN_INTERVAL = 0.05; // seconds
  private readonly MAX_COINS = 25;

  private readonly ROT_FREQ = 6; // Hz for scaleY flip feel

  private elapsed = 0;
  private spawnAccum = 0;
  private spawned = 0;

  private coins: Coin[] = [];
  private source!: PIXI.Sprite;

  constructor(object: any, sprites: PIXI.Sprite[]) {
    super(object, sprites);
    this.source = sprites[0];
    this.loop = true; // continuous spawning
  }

  protected reset(): void {
    // Cleanup existing coins
    for (const c of this.coins) {
      try {
        this.object.removeChild(c.sprite);
      } catch {}
      try {
        (c.sprite as any).destroy?.({ children: true, texture: false, baseTexture: false });
      } catch {}
    }
    this.coins = [];
    this.spawnAccum = 0;
    this.spawned = 0;
    this.elapsed = 0;

    // Hide the source sprite during the effect
    this.source.visible = false;
  }

  public update(dt: number): void {
    if (!this.isPlaying) return;
    this.elapsed += dt;
    this.spawnAccum += dt;

    // Spawn coins at interval, reset after reaching MAX_COINS to keep looping
    while (this.spawnAccum >= this.SPAWN_INTERVAL) {
      this.spawnAccum -= this.SPAWN_INTERVAL;
      this.spawnOne();
      this.spawned++;
      if (this.spawned >= this.MAX_COINS) {
        this.spawned = 0; // loop the sequence
      }
    }

    const _x0 = (this.source as any).x ?? 0;
    const y0 = (this.source as any).y ?? 0;

    // Update coins; remove finished
    for (let i = this.coins.length - 1; i >= 0; i--) {
      const c = this.coins[i];
      const t = this.elapsed - c.startAt;
      if (t < 0) continue; // not started yet (shouldn't happen with startAt=elapsed)

      if (t >= c.coinT) {
        // end of this coin
        try {
          this.object.removeChild(c.sprite);
        } catch {}
        this.coins.splice(i, 1);
        continue;
      }

      const p = c.sprite as any;
      // X-axis rotation feel via scaleY flip
      const sy = Math.cos(2 * Math.PI * this.ROT_FREQ * t);
      if (p.scale?.set) {
        const sx = p.scale.x ?? 1;
        p.scale.set(sx, sy);
      } else {
        p.scale = { x: 1, y: sy };
      }

      // piecewise motion over drop + multiple staircase bounces
      let xx = c.spawnX;
      let yy = y0;
      const _sign = c.dir;

      if (t <= this.DROP_T) {
        // Accelerating drop from screen top to (y0 + dropDepth) in 0.3s
        const u = Math.min(1, t / this.DROP_T);
        const pos = u * u; // quadratic ease-in (0 -> 1)
        const topY = -this.getScreenHeight() * 0.5;
        const endY = y0 + c.dropDepth;
        yy = topY + (endY - topY) * pos;
        xx = c.spawnX;
      } else {
        // traverse bounces
        let tb = t - this.DROP_T;
        // pre-sum horizontal shift before current bounce
        let sumDx = 0;
        let groundY = y0 + c.dropDepth; // ground for current bounce start
        let bounceIndex = -1;
        for (let bi = 0; bi < c.bounceCount; bi++) {
          const T = c.bounceTs[bi];
          if (tb <= T) {
            bounceIndex = bi;
            break;
          }
          tb -= T;
          // advance ground and horizontal for next bounce
          groundY += c.stepDowns[bi];
          sumDx += c.dxUp[bi] + c.dxDown[bi];
        }

        if (bounceIndex >= 0) {
          const T = c.bounceTs[bounceIndex];
          const half = T * 0.5;
          const up = c.upAmps[bounceIndex];
          const step = c.stepDowns[bounceIndex];
          const dxU = c.dxUp[bounceIndex];
          const dxD = c.dxDown[bounceIndex];

          // fade on the last bounce
          if (bounceIndex === c.bounceCount - 1) {
            const k = Math.min(1, tb / T);
            p.alpha = 1 - k;
          } else {
            p.alpha = 1;
          }

          if (tb <= half) {
            const u = tb / half; // 0..1
            const h = up * (1 - (1 - u) * (1 - u)); // ease-out up
            yy = groundY - h;
            xx = c.spawnX + sumDx + dxU * u;
          } else {
            const u = (tb - half) / half; // 0..1
            // go down from apex to next lower ground (groundY + step)
            const down = (up + step) * (u * u); // ease-in down
            yy = groundY - up + down;
            xx = c.spawnX + sumDx + dxU + dxD * u;
          }
        } else {
          // past all bounces (numerical edge), clamp to last ground
          const finalGround = y0 + c.dropDepth + c.stepDowns.reduce((a, b) => a + b, 0);
          yy = finalGround;
          xx = c.spawnX + c.dxUp.reduce((a, b) => a + b, 0) + c.dxDown.reduce((a, b) => a + b, 0);
          p.alpha = 0;
        }
      }

      // Apply fixed jitter and subtle wiggle
      const wiggle = c.wiggleAmp * Math.sin(2 * Math.PI * c.wiggleFreq * t);
      p.x = xx + c.jitterX + wiggle;
      p.y = yy + c.jitterY;
    }
  }

  private spawnOne(): void {
    // Spawn one coin at current time
    const tex = this.source.texture;
    const s = new PIXI.Sprite(tex);
    const x0 = (this.source as any).x ?? 0;
    const _y0 = (this.source as any).y ?? 0;
    const spawnX = x0 + (Math.random() * 60 - 30); // ±30px around current point
    (s as any).x = spawnX;
    (s as any).y = -this.getScreenHeight() * 0.5; // start at screen top in local coords
    (s as any).alpha = 1;
    if ((s as any).anchor?.set) (s as any).anchor.set(0.5); // center if available
    if ((s as any).scale?.set) (s as any).scale.set(1, 1);

    const dir: 1 | -1 = Math.random() < 0.5 ? -1 : 1;
    const rnd = (base: number, amp: number) => base + (Math.random() * 2 - 1) * amp;

    // Build a staircase bounce plan
    const dropDepth = 200; // first ground at y0 + 200
    const bounceCount = 5 + Math.floor(Math.random() * 3); // 5..7 bounces
    const bounceTs: number[] = [];
    const upAmps: number[] = [];
    const stepDowns: number[] = [];
    const dxUp: number[] = [];
    const dxDown: number[] = [];

    // step height ~18..28 px, slight jitter per step
    const baseStep = rnd(22, 6);
    // initial up amplitude then decay each bounce
    let up = rnd(40, 10);
    let horizBaseUp = rnd(14, 6);
    let horizBaseDown = rnd(22, 8);
    for (let i = 0; i < bounceCount; i++) {
      const T = this.BASE_BOUNCE_T * rnd(1.0, 0.25); // ~0.18s ±12.5%
      bounceTs.push(T);
      const step = Math.max(8, rnd(baseStep, 4));
      stepDowns.push(step);
      upAmps.push(Math.max(6, up));
      // horizontal per half-bounce; slightly reduce over time
      const dxu = Math.max(6, horizBaseUp) * dir;
      const dxd = Math.max(10, horizBaseDown) * dir;
      dxUp.push(dxu);
      dxDown.push(dxd);
      // decay for next bounce
      up *= rnd(0.78, 0.1); // ~0.78 ±0.05
      horizBaseUp *= rnd(0.9, 0.1);
      horizBaseDown *= rnd(0.9, 0.1);
    }

    const coinT = this.DROP_T + bounceTs.reduce((a, b) => a + b, 0);

    const coin: Coin = {
      sprite: s,
      startAt: this.elapsed,
      dir,
      spawnX,
      dropDepth,
      bounceCount,
      bounceTs,
      upAmps,
      stepDowns,
      dxUp,
      dxDown,
      coinT,
      jitterX: rnd(0, 2),
      jitterY: rnd(0, 2),
      wiggleAmp: Math.random() * 1.5,
      wiggleFreq: 2 + Math.random() * 3,
    };

    this.coins.push(coin);
    this.object.addChild(s);
  }

  public stop(): void {
    // Cleanup
    for (const c of this.coins) {
      try {
        this.object.removeChild(c.sprite);
      } catch {}
      try {
        (c.sprite as any).destroy?.({ children: true, texture: false, baseTexture: false });
      } catch {}
    }
    this.coins = [];
    this.source.visible = true;
    this.setState('IDLE');
  }

  private getScreenHeight(): number {
    try {
      if (typeof window !== 'undefined' && (window as any).innerHeight) {
        return Math.max(1, (window as any).innerHeight);
      }
    } catch {}
    return 600; // fallback
  }
}
