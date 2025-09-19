import { instantiate, Node, Prefab, UIOpacity, UITransform } from 'cc';

// 弹跳衰减系数，控制每次落地后的反弹强度
const BOUNCE_DECAY = [1, 0.55, 0.28, 0.16];
// 控制金币水平偏移范围的缩放因子
const COIN_X_RANGE_FACTOR = 0.5;

const RAD_TO_DEG = 180 / Math.PI;

/**
 * 舞台边界尺寸，用于判断金币是否已经飞出视口。
 */
export interface CoinEmitterBounds {
  width: number;
  height: number;
}

/**
 * 动态配置项：可以在不同阶段调整金币数量与生成节奏。
 */
export interface CoinEmitterConfig {
  maxCoins?: number;
  spawnIntervalRange?: [number, number];
}

/**
 * Cocos 端初始化参数：传入承载节点、金币预制体等必要依赖。
 */
export interface CocosCoinEmitterOptions {
  container: Node;
  coinPrefab: Prefab;
  demonNode: Node;
  maxCoins: number;
  bounds: CoinEmitterBounds;
}

type CoinDirection = 1 | -1;

type CoinState = 'falling' | 'fading';

type CoinMode = 'flip' | 'spin';

interface CoinParticle {
  node: Node;
  opacity: UIOpacity;
  velocityX: number;
  velocityY: number;
  gravity: number;
  horizontalSpeed: number;
  rotationSpeedDeg: number;
  direction: CoinDirection;
  bounces: number;
  readonly maxBounces: number;
  baseBounceStrength: number;
  pendingFade: boolean;
  state: CoinState;
  fadeTimer: number;
  fadeDuration: number;
  flipTimer: number;
  flipSpeed: number;
  mode: CoinMode;
  rotationDeg: number;
}

const randomRange = (min: number, max: number): number => min + Math.random() * (max - min);

const randomRangeInt = (min: number, max: number): number => Math.floor(randomRange(min, max + 1));

const randomChoice = <T>(values: readonly T[]): T => values[randomRangeInt(0, values.length - 1)];

/**
 * Cocos Creator 复刻版的金币喷发器，实现与 Pixi 版本相同的逻辑：
 * 通过预制体实例化金币，处理重力、反弹、渐隐等效果，并暴露相同的配置接口。
 */
export class CocosCoinEmitter {
  private readonly container: Node;

  private readonly coinPrefab: Prefab;

  private readonly demonNode: Node;

  private readonly coins: CoinParticle[] = [];

  private readonly maxCoinsCap: number;

  private maxCoins: number;

  private bounds: CoinEmitterBounds;

  private spawnTimer = 0;

  private nextSpawnIn = 0;

  private spawnIntervalRange: [number, number] = [0.04, 0.12];

  private coinWidth = 0;

  private coinHeight = 0;

  constructor({ container, coinPrefab, demonNode, maxCoins, bounds }: CocosCoinEmitterOptions) {
    this.container = container;
    this.coinPrefab = coinPrefab;
    this.demonNode = demonNode;
    this.maxCoinsCap = maxCoins;
    this.maxCoins = maxCoins;
    this.bounds = bounds;
    this.scheduleNextSpawn();
    this.cacheCoinMetrics();
  }

  configure(config: CoinEmitterConfig): void {
    // maxCoins 会被阶段配置覆盖，用于限制场上同时存在的金币数量
    if (typeof config.maxCoins === 'number') {
      this.maxCoins = Math.min(config.maxCoins, this.maxCoinsCap);
      while (this.coins.length > this.maxCoins) {
        this.removeCoinAt(0);
      }
    }

    // spawnIntervalRange 控制生成间隔 [最小秒数, 最大秒数]
    if (config.spawnIntervalRange) {
      this.spawnIntervalRange = config.spawnIntervalRange;
      this.scheduleNextSpawn();
    }
  }

  setBounds(bounds: CoinEmitterBounds): void {
    this.bounds = bounds;
  }

  update(dt: number): void {
    this.spawnTimer += dt;

    while (this.coins.length < this.maxCoins && this.spawnTimer >= this.nextSpawnIn) {
      this.spawnTimer -= this.nextSpawnIn;
      this.spawnCoin();
      this.scheduleNextSpawn();
    }

    const targetY = this.getImpactY();
    const horizontalLimit = this.bounds.width / 2 + this.coinWidth * 2;
    const fadeThresholdY = this.bounds.height / 2 + this.coinHeight * 2;

    for (let index = this.coins.length - 1; index >= 0; index -= 1) {
      const coin = this.coins[index];

      coin.velocityY += coin.gravity * dt;
      const position = coin.node.getPosition();
      position.x += coin.velocityX * dt;
      position.y += coin.velocityY * dt;
      coin.node.setPosition(position);

      if (coin.mode === 'flip') {
        coin.flipTimer += dt * coin.flipSpeed;
        const scaleX = Math.sin(coin.flipTimer);
        coin.node.setScale(scaleX, 1, 1);
        coin.node.setRotationFromEuler(0, 0, 0);
      } else {
        coin.node.setScale(1, 1, 1);
        coin.rotationDeg += coin.rotationSpeedDeg * dt;
        coin.node.setRotationFromEuler(0, 0, coin.rotationDeg);
      }

      if (coin.state !== 'fading' && coin.velocityY > 0 && position.y >= targetY) {
        position.y = targetY;
        coin.node.setPosition(position);
        coin.bounces += 1;

        if (coin.bounces <= coin.maxBounces) {
          const bounceIndex = Math.min(coin.bounces - 1, BOUNCE_DECAY.length - 1);
          const bounceMultiplier = BOUNCE_DECAY[bounceIndex];
          coin.velocityY = -coin.baseBounceStrength * bounceMultiplier;
          coin.velocityX = coin.direction * coin.horizontalSpeed;
          coin.horizontalSpeed *= randomRange(0.35, 0.5);

          if (coin.bounces === coin.maxBounces) {
            coin.pendingFade = true;
          }
        } else {
          coin.pendingFade = true;
        }
      }

      if (coin.pendingFade && coin.state !== 'fading' && coin.velocityY >= 0) {
        coin.state = 'fading';
        coin.fadeTimer = 0;
        coin.pendingFade = false;
      }

      if (coin.state === 'fading') {
        coin.fadeTimer += dt;
        const alpha = Math.max(0, 1 - coin.fadeTimer / coin.fadeDuration);
        coin.opacity.opacity = Math.floor(alpha * 255);
      } else {
        coin.opacity.opacity = 255;
      }

      coin.velocityX *= 0.98;

      const isInvisible = coin.state === 'fading' && coin.fadeTimer >= coin.fadeDuration;
      const outOfBounds = Math.abs(position.x) > horizontalLimit || position.y > fadeThresholdY;

      if (isInvisible || outOfBounds) {
        this.removeCoinAt(index);
      }
    }
  }

  destroy(): void {
    for (let index = this.coins.length - 1; index >= 0; index -= 1) {
      this.removeCoinAt(index);
    }
  }

  private spawnCoin(): void {
    if (!this.coinPrefab || this.coins.length >= this.maxCoins) {
      return;
    }

    const spawnX = this.getSpawnX();
    let direction: CoinDirection = spawnX >= 0 ? 1 : -1;
    if (Math.abs(spawnX) < this.coinWidth * 0.2) {
      direction = randomChoice([1, -1]) as CoinDirection;
    }

    const node = instantiate(this.coinPrefab);
    node.setScale(1, 1, 1);
    node.setPosition(spawnX, this.getSpawnY(), 0);
    node.parent = this.container;

    const opacity = node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
    opacity.opacity = 255;

    const mode: CoinMode = Math.random() < 0.5 ? 'flip' : 'spin';
    const initialRotationDeg = mode === 'spin' ? randomRange(-Math.PI, Math.PI) * RAD_TO_DEG : 0;
    const rotationSpeedDeg = mode === 'spin' ? randomRange(-6, 6) * RAD_TO_DEG : 0;
    node.setRotationFromEuler(0, 0, initialRotationDeg);

    const coin: CoinParticle = {
      node,
      opacity,
      velocityX: randomRange(-40, 40) * COIN_X_RANGE_FACTOR,
      velocityY: randomRange(20, 80),
      gravity: randomRange(900, 1100),
      horizontalSpeed: randomRange(220, 320) * COIN_X_RANGE_FACTOR,
      rotationSpeedDeg,
      direction,
      bounces: 0,
      maxBounces: 3,
      baseBounceStrength: randomRange(680, 780),
      pendingFade: false,
      state: 'falling',
      fadeTimer: 0,
      fadeDuration: randomRange(0.6, 1.1),
      flipTimer: randomRange(0, Math.PI * 2),
      flipSpeed: mode === 'flip' ? randomRange(8, 12) : 0,
      mode,
      rotationDeg: initialRotationDeg,
    };

    this.coins.push(coin);
  }

  private removeCoinAt(index: number): void {
    const [coin] = this.coins.splice(index, 1);
    coin.node.destroy();
  }

  private scheduleNextSpawn(): void {
    const [min, max] = this.spawnIntervalRange;
    this.nextSpawnIn = randomRange(min, max);
  }

  private getSpawnX(): number {
    return randomRange(-this.coinWidth * 2.5, this.coinWidth * 2.5);
  }

  private getSpawnY(): number {
    return -this.bounds.height / 2 - this.coinHeight;
  }

  private getImpactY(): number {
    const demonTransform = this.demonNode.getComponent(UITransform);
    const demonHeight = demonTransform?.height ?? 0;
    return this.demonNode.position.y - demonHeight * 0.32;
  }

  private cacheCoinMetrics(): void {
    if (!this.coinPrefab) {
      return;
    }
    const sample = instantiate(this.coinPrefab);
    const transform = sample.getComponent(UITransform);
    this.coinWidth = transform?.width ?? 0;
    this.coinHeight = transform?.height ?? 0;
    sample.destroy();
  }
}
