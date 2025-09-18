import { Container, Sprite, Texture } from 'pixi.js';
import { randomFloat } from '../utils/random';

interface Bounds {
  width: number;
  height: number;
}

interface TrailParticle {
  sprite: Sprite;
  progress: number;
  speed: number;
  amplitude: number;
  frequency: number;
  offset: number;
  stretch: number;
  baseX: number;
}

export interface TrailFieldOptions {
  bounds: Bounds;
  trailCount?: number;
}

export class TrailField {
  readonly view: Container;
  private readonly particles: TrailParticle[];
  private width: number;
  private height: number;

  constructor(options: TrailFieldOptions) {
    this.view = new Container();
    this.view.alpha = 0.85;
    this.view.sortableChildren = true;
    this.width = options.bounds.width;
    this.height = options.bounds.height;

    const trailCount = options.trailCount ?? 16;
    this.particles = Array.from({ length: trailCount }, () => this.createParticle());
  }

  get activeCount(): number {
    return this.particles.length;
  }

  update(elapsedSeconds: number, deltaSeconds: number): void {
    for (const particle of this.particles) {
      particle.progress += deltaSeconds * particle.speed;

      if (particle.progress > 1) {
        particle.progress %= 1;
        this.reseedParticle(particle);
      }

      const wave = Math.sin(elapsedSeconds * particle.frequency + particle.offset);
      const y = particle.progress * this.height;
      const x = particle.baseX + wave * particle.amplitude;

      particle.sprite.position.set(x, y);
      particle.sprite.scale.set(1, particle.stretch);
      particle.sprite.alpha = Math.min(1, 1 - particle.progress * 0.85);
      particle.sprite.rotation = wave * 0.12;
      particle.sprite.zIndex = y;
    }
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;

    for (const particle of this.particles) {
      particle.baseX = randomFloat(width * 0.2, width * 0.8);
    }
  }

  private createParticle(): TrailParticle {
    const sprite = new Sprite(Texture.WHITE);
    sprite.anchor.set(0.5, 1);
    sprite.blendMode = 'add';
    sprite.width = randomFloat(6, 14);

    const particle: TrailParticle = {
      sprite,
      progress: Math.random(),
      speed: randomFloat(0.08, 0.18),
      amplitude: randomFloat(36, 110),
      frequency: randomFloat(0.6, 1.2),
      offset: randomFloat(0, Math.PI * 2),
      stretch: randomFloat(6, 10),
      baseX: randomFloat(this.width * 0.2, this.width * 0.8)
    };

    this.view.addChild(sprite);
    return particle;
  }

  private reseedParticle(particle: TrailParticle): void {
    particle.speed = randomFloat(0.08, 0.18);
    particle.amplitude = randomFloat(36, 120);
    particle.frequency = randomFloat(0.6, 1.4);
    particle.offset = randomFloat(0, Math.PI * 2);
    particle.stretch = randomFloat(5, 11);
    particle.baseX = randomFloat(this.width * 0.2, this.width * 0.8);
  }
}
