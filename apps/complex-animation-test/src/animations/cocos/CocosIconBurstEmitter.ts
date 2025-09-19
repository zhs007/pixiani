import { Color, Node, Prefab, Sprite, UIOpacity, instantiate } from 'cc';

// 每次爆发生成的粒子会沿圆周均匀散开，半径用于计算峰值时间
const TWO_PI = Math.PI * 2;
const RAD_TO_DEG = 180 / Math.PI;

const DEFAULT_COLOR = 0xffffff;

/**
 * 图标爆发配置，和 Pixi 版本保持一致，便于复用原有数据。
 */
export interface CocosIconBurstEmitterConfig {
  burstCount: number;
  burstIntervalRange: [number, number];
  speedRange: [number, number];
  startScale: number;
  peakScale: number;
  finalScale: number;
  lifetimeMultiplier: number;
  spinSpeedRange: [number, number];
}

/**
 * 激活时的附加配置，radius 表示爆发时的目标半径。
 */
export interface CocosIconBurstActivationConfig extends CocosIconBurstEmitterConfig {
  radius: number;
}

/**
 * 初始化参数：容器节点 + 多个图标预制体，可选颜色调色板。
 */
export interface CocosIconBurstEmitterOptions {
  container: Node;
  iconPrefabs: Prefab[];
  colorPalette?: number[];
}

interface IconParticle {
  node: Node;
  opacity: UIOpacity;
  sprite: Sprite | null;
  velocityX: number;
  velocityY: number;
  rotationSpeedDeg: number;
  life: number;
  peakTime: number;
  totalLife: number;
  startScale: number;
  peakScale: number;
  finalScale: number;
  rotationDeg: number;
}

const randomRange = (min: number, max: number): number => min + Math.random() * (max - min);

const randomChoice = <T>(values: readonly T[]): T => values[Math.floor(Math.random() * values.length)];

const hexToColor = (value: number): Color => {
  const color = new Color();
  const hex = Math.max(0, Math.min(0xffffff, value));
  const r = (hex >> 16) & 0xff;
  const g = (hex >> 8) & 0xff;
  const b = hex & 0xff;
  color.r = r;
  color.g = g;
  color.b = b;
  color.a = 255;
  return color;
};

/**
 * Cocos 版的图标爆发器，负责实例化图标预制体并驱动运动/缩放/透明度动画。
 */
export class CocosIconBurstEmitter {
  private readonly container: Node;

  private readonly iconPrefabs: Prefab[];

  private readonly colorPalette: number[];

  private readonly particles: IconParticle[] = [];

  private isActive = false;

  private config: CocosIconBurstActivationConfig | null = null;

  private radius = 200;

  private spawnTimer = 0;

  private nextBurstIn = 0;

  constructor({ container, iconPrefabs, colorPalette = [] }: CocosIconBurstEmitterOptions) {
    this.container = container;
    this.iconPrefabs = iconPrefabs;
    this.colorPalette = colorPalette;
  }

  /**
   * 激活爆发器：清空旧粒子，记录配置并立即触发一次爆发。
   */
  activate(config: CocosIconBurstActivationConfig): void {
    this.clearParticles();
    this.config = config;
    this.isActive = true;
    this.radius = config.radius;
    this.spawnTimer = 0;
    this.scheduleNextBurst();
    this.spawnBurst();
    this.scheduleNextBurst();
  }

  /**
   * 停止爆发并清理现有粒子。
   */
  deactivate(): void {
    this.isActive = false;
    this.config = null;
    this.spawnTimer = 0;
    this.nextBurstIn = 0;
    this.clearParticles();
  }

  /**
   * 动态调整半径，通常在舞台缩放时调用。
   */
  setRadius(radius: number): void {
    this.radius = radius;
  }

  /**
   * 每帧推进粒子状态，包含生成节奏、位移、缩放和透明度。
   */
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

      const position = particle.node.getPosition();
      position.x += particle.velocityX * dt;
      position.y += particle.velocityY * dt;
      particle.node.setPosition(position);

      particle.rotationDeg += particle.rotationSpeedDeg * dt;
      particle.node.setRotationFromEuler(0, 0, particle.rotationDeg);

      const { life, peakTime, totalLife, startScale, peakScale, finalScale } = particle;

      if (life <= peakTime) {
        const t = Math.min(life / peakTime, 1);
        const scale = startScale + (peakScale - startScale) * t;
        particle.node.setScale(scale, scale, 1);
      } else {
        const progress = Math.min((life - peakTime) / Math.max(totalLife - peakTime, Number.EPSILON), 1);
        const scale = peakScale + (finalScale - peakScale) * progress;
        particle.node.setScale(scale, scale, 1);
        particle.opacity.opacity = Math.floor((1 - progress) * 255);
      }

      if (life >= totalLife) {
        this.removeParticleAt(index);
      }
    }

    this.container.active = this.isActive || this.particles.length > 0;
  }

  private spawnBurst(): void {
    if (!this.config || this.iconPrefabs.length === 0) {
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

    const angleStep = TWO_PI / Math.max(1, burstCount);

    for (let i = 0; i < burstCount; i += 1) {
      const angleOffset = randomRange(-angleStep * 0.25, angleStep * 0.25);
      const angle = angleStep * i + angleOffset;
      const directionX = Math.cos(angle);
      const directionY = Math.sin(angle);
      const speed = randomRange(speedRange[0], speedRange[1]);
      const peakTime = this.radius / Math.max(speed, Number.EPSILON);
      const totalLife = peakTime * lifetimeMultiplier;

      const prefab = randomChoice(this.iconPrefabs);
      const node = instantiate(prefab);
      node.setPosition(0, 0, 0);
      node.setScale(startScale, startScale, 1);
      node.parent = this.container;

      const opacity = node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
      opacity.opacity = 255;

      const sprite = node.getComponent(Sprite);
      const initialRotationDeg = randomRange(-Math.PI, Math.PI) * RAD_TO_DEG;
      const rotationSpeedDeg = randomRange(spinSpeedRange[0], spinSpeedRange[1]) * RAD_TO_DEG;
      node.setRotationFromEuler(0, 0, initialRotationDeg);
      if (sprite) {
        const tint = this.colorPalette.length > 0 ? randomChoice(this.colorPalette) : DEFAULT_COLOR;
        sprite.color = hexToColor(tint);
      }

      const particle: IconParticle = {
        node,
        opacity,
        sprite: sprite ?? null,
        velocityX: directionX * speed,
        velocityY: directionY * speed,
        rotationSpeedDeg,
        life: 0,
        peakTime,
        totalLife,
        startScale,
        peakScale,
        finalScale,
        rotationDeg: initialRotationDeg,
      };

      this.particles.push(particle);
    }
  }

  private scheduleNextBurst(): void {
    if (!this.config) {
      this.nextBurstIn = 0;
      return;
    }
    const [min, max] = this.config.burstIntervalRange;
    this.nextBurstIn = randomRange(min, max);
  }

  private removeParticleAt(index: number): void {
    const [particle] = this.particles.splice(index, 1);
    particle.node.destroy();
  }

  private clearParticles(): void {
    this.particles.forEach((particle) => particle.node.destroy());
    this.particles.length = 0;
  }
}
