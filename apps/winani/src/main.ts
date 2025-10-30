import './style.css';
import { Application, Assets, Sprite, Texture, AnimatedSprite } from 'pixi.js';
import { gsap } from 'gsap';

const backgroundAssetUrl = new URL('../../../assets/winani002/background.png', import.meta.url).href;
const arrowAssetUrls = Array.from({ length: 5 }, (_, index) =>
  new URL(`../../../assets/winani002/arrow${String(index + 1).padStart(3, '0')}.png`, import.meta.url).href,
);
const coinAssetUrls = Array.from({ length: 6 }, (_, index) =>
  new URL(`../../../assets/winani002/${String(index + 1).padStart(2, '0')}.png`, import.meta.url).href,
);

const degreesToRadians = (degrees: number): number => (degrees * Math.PI) / 180;

const randomBetween = (min: number, max: number): number => Math.random() * (max - min) + min;

async function bootstrap(): Promise<void> {
  const host = document.getElementById('app');

  if (!host) {
    throw new Error('Winani bootstrap failed: #app container is missing');
  }

  const app = new Application();

  await app.init({
    width: Math.min(window.innerWidth, 1280),
    height: Math.min(window.innerHeight, 720),
    backgroundColor: 0x060a18,
    resolution: Math.min(window.devicePixelRatio, 2),
    autoDensity: true,
    antialias: true,
  });

  host.appendChild(app.canvas);

  const backgroundTexture = await Assets.load(backgroundAssetUrl);
  const background = new Sprite(backgroundTexture);

  background.anchor.set(0.5);
  background.alpha = 0;
  app.stage.addChild(background);

  const repositionBackground = (): void => {
    const { width, height } = app.screen;
    const textureRatio = backgroundTexture.width / backgroundTexture.height;
    const screenRatio = width / height;

    if (screenRatio > textureRatio) {
      background.width = width;
      background.height = width / textureRatio;
    } else {
      background.height = height;
      background.width = height * textureRatio;
    }

    background.position.set(width / 2, height / 2);
  };

  repositionBackground();

  gsap.to(background, { alpha: 1, duration: 1.2, ease: 'power2.out' });

  const arrowTextures = await Promise.all(arrowAssetUrls.map((url) => Assets.load<Texture>(url)));
  const blueArrowIndices = new Set([3, 4]);
  const arrowsPerBurst = 20;
  const blackArrowDuration = 14.4;
  const blueArrowDuration = blackArrowDuration * 0.5;
  const appearRatio = 0.08;
  const fadeStartRatio = 0.75;
  const fadeDurationRatio = 0.25;

  const coinTextures = await Promise.all(coinAssetUrls.map((url) => Assets.load<Texture>(url)));
  const coinMinAlpha = 0.5;
  const coinMaxAlpha = 1;
  const coins: {
    sprite: AnimatedSprite;
    initialPosition: { x: number; y: number };
    initialVelocity: { x: number; y: number };
    angularVelocity: number;
    elapsed: number;
    timeToApex: number;
    baseScale: number;
    boostMultiplier: number;
    rotationAccumulated: number;
  }[] = [];
  const spawnIntervalSeconds = 0.07;
  const gravity = 1800;
  const cleanupMargin = 120;
  const launchAngles = {
    left: degreesToRadians(105),
    right: degreesToRadians(75),
    centerRight: degreesToRadians(88),
  } as const;
  const launchVariances = {
    left: degreesToRadians(6),
    right: degreesToRadians(6),
    centerRight: degreesToRadians(3),
  } as const;
  let spawnTimer = 0;
  let spawnCenterRightAlternate = false;
  let coinSpawningEnabled = true;

  const spawnCoin = (side: keyof typeof launchAngles, originOffsetX = 0): void => {
    const coin = new AnimatedSprite(coinTextures);
    const speed = randomBetween(580, 780) * 1.5;
    const angle = launchAngles[side] + randomBetween(-launchVariances[side], launchVariances[side]);
    const baseScale = randomBetween(0.85, 1.1) * 0.5;
    const boostMultiplier = Math.random() < 0.35 ? 1.5 : 1;
    const initialVelocityX = Math.cos(angle) * speed;
    const initialVelocityY = -Math.sin(angle) * speed;
    const timeToApex = initialVelocityY < 0 ? -initialVelocityY / gravity : 0;
    const initialPosition = {
      x: app.screen.width / 2 + originOffsetX,
      y: app.screen.height / 2,
    };
    const angularVelocity = randomBetween(-Math.PI, Math.PI);

    coin.anchor.set(0.5);
    coin.position.set(initialPosition.x, initialPosition.y);
    coin.rotation = randomBetween(-Math.PI, Math.PI);
    coin.animationSpeed = randomBetween(0.15, 0.2375) * 1.3;
    coin.scale.set(baseScale);
    coin.alpha = coinMinAlpha;
    coin.loop = true;
    coin.play();

    app.stage.addChild(coin);

    coins.push({
      sprite: coin,
      initialPosition,
      initialVelocity: {
        x: initialVelocityX,
        y: initialVelocityY,
      },
      angularVelocity,
      elapsed: 0,
      timeToApex,
      baseScale,
      boostMultiplier,
      rotationAccumulated: 0,
    });
  };

  const updateCoins = (deltaSeconds: number): void => {
    spawnTimer += deltaSeconds;

    while (spawnTimer >= spawnIntervalSeconds) {
      spawnTimer -= spawnIntervalSeconds;
      if (!coinSpawningEnabled) {
        continue;
      }

      spawnCoin('left');
      spawnCoin('right');
      if (spawnCenterRightAlternate) {
        const extraOffsetX = Math.min(app.screen.width, app.screen.height) * 0.04;
        spawnCoin('centerRight', extraOffsetX);
      }
      spawnCenterRightAlternate = !spawnCenterRightAlternate;
    }

    for (let index = coins.length - 1; index >= 0; index -= 1) {
      const coin = coins[index];
      const sprite = coin.sprite;

      coin.elapsed += deltaSeconds;
      const currentTime = coin.elapsed;
      const currentVelocityY = coin.initialVelocity.y + gravity * currentTime;

      if (currentVelocityY < 0 && coin.timeToApex > 0) {
        const progress = Math.min(currentTime / coin.timeToApex, 1);
        sprite.alpha = coinMinAlpha + (coinMaxAlpha - coinMinAlpha) * progress;
      } else {
        sprite.alpha = coinMaxAlpha;
      }

      sprite.x = coin.initialPosition.x + coin.initialVelocity.x * currentTime;
      sprite.y = coin.initialPosition.y + coin.initialVelocity.y * currentTime + 0.5 * gravity * currentTime * currentTime;
      sprite.rotation += coin.angularVelocity * deltaSeconds;
      coin.rotationAccumulated += Math.abs(coin.angularVelocity) * deltaSeconds;

      const scaleMultiplier =
        coin.boostMultiplier > 1
          ? 1 + (coin.boostMultiplier - 1) * Math.min(coin.rotationAccumulated / (Math.PI * 2), 1)
          : 1;

      sprite.scale.set(coin.baseScale * scaleMultiplier);

      const { width, height } = app.screen;
      const isOutOfBounds =
        sprite.x < -cleanupMargin ||
        sprite.x > width + cleanupMargin ||
        sprite.y - sprite.height * 0.5 > height + cleanupMargin;

      if (isOutOfBounds) {
        sprite.stop();
        app.stage.removeChild(sprite);
        sprite.destroy();
        coins.splice(index, 1);
      }
    }
  };

  const emitArrows = (): void => {
    const baseAngle = Math.random() * Math.PI * 2;
    const { width, height } = app.screen;
    const originX = width / 2;
    const originY = height / 2;
    const travelDistance = Math.max(width, height) * 0.75;

    const baseSpacing = (Math.PI * 2) / arrowsPerBurst;
    const textureOffset = Math.floor(Math.random() * arrowTextures.length);

    for (let index = 0; index < arrowsPerBurst; index += 1) {
      const textureIndex = (textureOffset + index) % arrowTextures.length;
      const arrowTexture = arrowTextures[textureIndex];
      const arrow = new Sprite(arrowTexture);
      const angle = baseAngle + index * baseSpacing;
      const targetX = originX + Math.cos(angle) * travelDistance;
      const targetY = originY + Math.sin(angle) * travelDistance;

      arrow.anchor.set(1, 0.5);
      arrow.position.set(originX, originY);
      arrow.rotation = angle;
      arrow.alpha = 0;

      app.stage.addChild(arrow);

      const timeline = gsap.timeline({
        onComplete: () => {
          app.stage.removeChild(arrow);
          arrow.destroy();
        },
      });

      const isBlue = blueArrowIndices.has(textureIndex);
      const travelDuration = isBlue ? blueArrowDuration : blackArrowDuration;
      const fadeDelay = travelDuration * fadeStartRatio;
      const fadeDuration = travelDuration * fadeDurationRatio;
      const appearTime = travelDuration * appearRatio;

      timeline.to(
        arrow,
        {
          x: targetX,
          y: targetY,
          duration: travelDuration,
          ease: 'expo.out',
        },
        0,
      );

      timeline.set(arrow, { alpha: 1 }, appearTime);

      timeline.to(
        arrow,
        {
          alpha: 0,
          duration: fadeDuration,
          ease: 'sine.out',
        },
        fadeDelay,
      );
    }
  };

  app.ticker.add((ticker) => {
    updateCoins(ticker.deltaMS / 1000);
  });

  const burstTimeline = gsap.timeline({
    repeat: -1,
    repeatDelay: 0.3,
    delay: 0.6,
  });

  burstTimeline.call(emitArrows);

  const handleResize = (): void => {
    const nextWidth = Math.max(window.innerWidth, 720);
    const nextHeight = Math.max(window.innerHeight, 480);

    app.renderer.resize(nextWidth, nextHeight);
    app.canvas.width = nextWidth;
    app.canvas.height = nextHeight;
    repositionBackground();
  };

  window.addEventListener('resize', handleResize, { passive: true });
  window.addEventListener(
    'keydown',
    (event) => {
      if (event.key.toLowerCase() === 's') {
        coinSpawningEnabled = false;
      }
    },
    { passive: true },
  );
  handleResize();
}

void bootstrap();
