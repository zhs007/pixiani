import { Container, Sprite, Texture } from 'pixi.js';
import { randomFloat } from '../utils/random';

type CoinDirection = 1 | -1;

interface CoinParticle {
  sprite: Sprite;
  velocityX: number;
  velocityY: number;
  gravity: number;
  horizontalSpeed: number;
  rotationSpeed: number;
  direction: CoinDirection;
  bounces: number;
  readonly maxBounces: number;
  baseBounceStrength: number;
  pendingFade: boolean;
  state: 'falling' | 'fading';
  fadeTimer: number;
  fadeDuration: number;
  flipTimer: number;
  flipSpeed: number;
  mode: 'flip' | 'spin';
}

const BOUNCE_DECAY = [1, 0.55, 0.28, 0.16];
const COIN_X_RANGE_FACTOR = 0.5;

export interface CoinEmitterBounds {
  width: number;
  height: number;
}

export interface CoinEmitterOptions {
  container: Container;
  coinTexture: Texture;
  demonSprite: Sprite;
  maxCoins: number;
  bounds: CoinEmitterBounds;
}

export interface CoinEmitterConfig {
  maxCoins?: number;
  spawnIntervalRange?: [number, number];
}

export class CoinEmitter {
  private readonly container: Container;

  private readonly coinTexture: Texture;

  private readonly demonSprite: Sprite;

  private readonly coins: CoinParticle[] = [];

  private maxCoins: number;

  private readonly maxCoinsCap: number;

  private bounds: CoinEmitterBounds;

  private spawnTimer = 0;

  private nextSpawnIn = 0;

  private spawnIntervalRange: [number, number] = [0.04, 0.12];

  constructor({ container, coinTexture, demonSprite, maxCoins, bounds }: CoinEmitterOptions) {
    this.container = container;
    this.coinTexture = coinTexture;
    this.demonSprite = demonSprite;
    this.maxCoinsCap = maxCoins;
    this.maxCoins = maxCoins;
    this.bounds = bounds;
    this.scheduleNextSpawn();
  }

  configure(config: CoinEmitterConfig): void {
    if (typeof config.maxCoins === 'number') {
      this.maxCoins = Math.min(config.maxCoins, this.maxCoinsCap);
      while (this.coins.length > this.maxCoins) {
        this.removeCoinAt(0);
      }
    }

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
    const horizontalLimit = this.bounds.width / 2 + this.coinTexture.width * 2;
    const fadeThresholdY = this.bounds.height / 2 + this.coinTexture.height * 2;

    for (let index = this.coins.length - 1; index >= 0; index -= 1) {
      const coin = this.coins[index];

      coin.velocityY += coin.gravity * dt;
      coin.sprite.x += coin.velocityX * dt;
      coin.sprite.y += coin.velocityY * dt;

      if (coin.mode === 'flip') {
        coin.flipTimer += dt * coin.flipSpeed;
        coin.sprite.scale.x = Math.sin(coin.flipTimer);
        coin.sprite.scale.y = 1;
        coin.sprite.rotation = 0;
      } else {
        coin.sprite.scale.set(1, 1);
        coin.sprite.rotation += coin.rotationSpeed * dt;
      }

      if (coin.state !== 'fading' && coin.velocityY > 0 && coin.sprite.y >= targetY) {
        coin.sprite.y = targetY;
        coin.bounces += 1;

        if (coin.bounces <= coin.maxBounces) {
          const bounceIndex = Math.min(coin.bounces - 1, BOUNCE_DECAY.length - 1);
          const bounceMultiplier = BOUNCE_DECAY[bounceIndex];
          coin.velocityY = -coin.baseBounceStrength * bounceMultiplier;
          coin.velocityX = coin.direction * coin.horizontalSpeed;
          coin.horizontalSpeed *= randomFloat(0.35, 0.5);

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
        const alpha = 1 - coin.fadeTimer / coin.fadeDuration;
        coin.sprite.alpha = Math.max(0, alpha);
      } else {
        coin.sprite.alpha = 1;
      }

      coin.velocityX *= 0.98;

      const isInvisible = coin.state === 'fading' && coin.fadeTimer >= coin.fadeDuration;
      const outOfBounds =
        Math.abs(coin.sprite.x) > horizontalLimit || coin.sprite.y > fadeThresholdY;

      if (isInvisible || outOfBounds) {
        this.removeCoinAt(index);
      }
    }
  }

  private spawnCoin(): void {
    if (this.coins.length >= this.maxCoins) {
      return;
    }

    const spawnX = this.getSpawnX();
    let direction: CoinDirection = spawnX >= 0 ? 1 : -1;
    if (Math.abs(spawnX) < this.coinTexture.width * 0.2) {
      direction = (Math.random() < 0.5 ? 1 : -1) as CoinDirection;
    }

    const sprite = new Sprite(this.coinTexture);
    sprite.anchor.set(0.5);
    sprite.scale.set(1);
    sprite.position.set(spawnX, this.getSpawnY());
    sprite.alpha = 1;
    sprite.blendMode = 'add';

    const mode: CoinParticle['mode'] = Math.random() < 0.5 ? 'flip' : 'spin';
    const rotationSpeed = mode === 'spin' ? randomFloat(-6, 6) : 0;
    sprite.rotation = mode === 'spin' ? randomFloat(-Math.PI, Math.PI) : 0;

    const coin: CoinParticle = {
      sprite,
      velocityX: randomFloat(-40, 40) * COIN_X_RANGE_FACTOR,
      velocityY: randomFloat(20, 80),
      gravity: randomFloat(900, 1100),
      horizontalSpeed: randomFloat(220, 320) * COIN_X_RANGE_FACTOR,
      rotationSpeed,
      direction,
      bounces: 0,
      maxBounces: 3,
      baseBounceStrength: randomFloat(680, 780),
      pendingFade: false,
      state: 'falling',
      fadeTimer: 0,
      fadeDuration: randomFloat(0.6, 1.1),
      flipTimer: randomFloat(0, Math.PI * 2),
      flipSpeed: mode === 'flip' ? randomFloat(8, 12) : 0,
      mode,
    };

    this.coins.push(coin);
    this.container.addChild(sprite);
    if (mode === 'flip') {
      sprite.scale.x = Math.sin(coin.flipTimer);
      sprite.scale.y = 1;
    } else {
      sprite.scale.set(1, 1);
    }
  }

  private removeCoinAt(index: number): void {
    const [coin] = this.coins.splice(index, 1);
    coin.sprite.destroy();
  }

  private scheduleNextSpawn(): void {
    const [min, max] = this.spawnIntervalRange;
    this.nextSpawnIn = randomFloat(min, max);
  }

  private getSpawnX(): number {
    const spread = this.coinTexture.width * 5 * COIN_X_RANGE_FACTOR;
    return randomFloat(-spread / 2, spread / 2);
  }

  private getSpawnY(): number {
    return -this.bounds.height / 2 - this.coinTexture.height;
  }

  private getImpactY(): number {
    return this.demonSprite.y - this.demonSprite.height * 0.32;
  }
}
