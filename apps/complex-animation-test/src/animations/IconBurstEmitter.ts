import { Container, Sprite, Texture } from 'pixi.js';
import { randomFloat } from '../utils/random';

export interface IconBurstEmitterOptions {
  container: Container;
  textures: Texture[];
  colorPalette: number[];
}

export interface IconBurstEmitterConfig {
  burstCount: number;
  burstIntervalRange: [number, number];
  speedRange: [number, number];
  startScale: number;
  peakScale: number;
  finalScale: number;
  lifetimeMultiplier: number;
  spinSpeedRange: [number, number];
}

export interface IconBurstEmitterActivationConfig extends IconBurstEmitterConfig {
  radius: number;
}

interface IconParticle {
  sprite: Sprite;
  velocityX: number;
  velocityY: number;
  rotationSpeed: number;
  life: number;
  peakTime: number;
  totalLife: number;
  startScale: number;
  peakScale: number;
  finalScale: number;
}

export class IconBurstEmitter {
  private readonly container: Container;

  private readonly textures: Texture[];

  private readonly colorPalette: number[];

  private readonly particles: IconParticle[] = [];

  private isActive = false;

  private config: IconBurstEmitterActivationConfig | null = null;

  private radius = 200;

  private spawnTimer = 0;

  private nextBurstIn = 0;

  constructor({ container, textures, colorPalette }: IconBurstEmitterOptions) {
    this.container = container;
    this.textures = textures;
    this.colorPalette = colorPalette;
  }

  activate(config: IconBurstEmitterActivationConfig): void {
    this.clearParticles();
    this.config = config;
    this.isActive = true;
    this.radius = config.radius;
    this.spawnTimer = 0;
    this.scheduleNextBurst();
    this.spawnBurst();
    this.scheduleNextBurst();
  }

  deactivate(): void {
    this.isActive = false;
    this.config = null;
    this.spawnTimer = 0;
    this.nextBurstIn = 0;
    this.clearParticles();
  }

  setRadius(radius: number): void {
    this.radius = radius;
  }

  update(dt: number): void {
    const hasConfig = Boolean(this.config);
    if (this.isActive && hasConfig) {
      this.spawnTimer += dt;
      while (this.spawnTimer >= this.nextBurstIn) {
        this.spawnTimer -= this.nextBurstIn;
        this.spawnBurst();
        this.scheduleNextBurst();
      }
    }

    for (let index = this.particles.length - 1; index >= 0; index -= 1) {
      const particle = this.particles[index];
      particle.life += dt;

      particle.sprite.x += particle.velocityX * dt;
      particle.sprite.y += particle.velocityY * dt;
      particle.sprite.rotation += particle.rotationSpeed * dt;

      const { life, peakTime, totalLife, startScale, peakScale, finalScale } = particle;

      if (life <= peakTime) {
        const t = Math.min(life / peakTime, 1);
        const scale = startScale + (peakScale - startScale) * t;
        particle.sprite.scale.set(scale);
      } else {
        const postLife = Math.min(
          (life - peakTime) / Math.max(totalLife - peakTime, Number.EPSILON),
          1,
        );
        const scale = peakScale + (finalScale - peakScale) * postLife;
        particle.sprite.scale.set(scale);
        particle.sprite.alpha = Math.max(0, 1 - postLife);
      }

      if (life >= totalLife) {
        this.removeParticleAt(index);
      }
    }

    this.container.visible = this.isActive || this.particles.length > 0;
  }

  private spawnBurst(): void {
    if (!this.config || this.textures.length === 0) {
      return;
    }

    const {
      burstCount,
      speedRange,
      startScale,
      peakScale,
      finalScale,
      lifetimeMultiplier,
      spinSpeedRange,
    } = this.config;

    const angleStep = (Math.PI * 2) / burstCount;

    for (let i = 0; i < burstCount; i += 1) {
      const angleOffset = randomFloat(-angleStep * 0.25, angleStep * 0.25);
      const angle = angleStep * i + angleOffset;
      const directionX = Math.cos(angle);
      const directionY = Math.sin(angle);
      const speed = randomFloat(speedRange[0], speedRange[1]);
      const peakTime = this.radius / Math.max(speed, Number.EPSILON);
      const totalLife = peakTime * lifetimeMultiplier;

      const texture = this.textures[Math.floor(Math.random() * this.textures.length)];
      const sprite = new Sprite(texture);
      sprite.anchor.set(0.5);
      sprite.position.set(0, 0);
      sprite.scale.set(startScale);
      sprite.blendMode = 'add';
      sprite.alpha = 1;
      sprite.tint =
        this.colorPalette[Math.floor(Math.random() * this.colorPalette.length)] ?? 0xffffff;

      const rotationSpeed = randomFloat(spinSpeedRange[0], spinSpeedRange[1]);

      const particle: IconParticle = {
        sprite,
        velocityX: directionX * speed,
        velocityY: directionY * speed,
        rotationSpeed,
        life: 0,
        peakTime,
        totalLife,
        startScale,
        peakScale,
        finalScale,
      };

      this.particles.push(particle);
      this.container.addChild(sprite);
    }
  }

  private scheduleNextBurst(): void {
    if (!this.config) {
      this.nextBurstIn = 0;
      return;
    }
    const [min, max] = this.config.burstIntervalRange;
    this.nextBurstIn = randomFloat(min, max);
  }

  private removeParticleAt(index: number): void {
    const [particle] = this.particles.splice(index, 1);
    particle.sprite.destroy();
  }

  private clearParticles(): void {
    this.particles.forEach((particle) => particle.sprite.destroy());
    this.particles.length = 0;
  }
}
