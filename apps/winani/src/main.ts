import './style.css';
import { Application, Assets, Sprite, Texture, AnimatedSprite } from 'pixi.js';
import { gsap } from 'gsap';

const backgroundAssetUrl = new URL('../../../assets/winani002/background.png', import.meta.url).href;
const arrowAssetUrls = Array.from({ length: 5 }, (_, index) =>
  new URL(`../../../assets/winani002/arrow${String(index + 1).padStart(3, '0')}.png`, import.meta.url).href,
);
const coinAssetUrls = Array.from({ length: 8 }, (_, index) =>
  new URL(`../../../assets/winani002/coin${String(index + 1).padStart(3, '0')}.png`, import.meta.url).href,
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
  const arrowsPerBurst = 8;
  const travelDuration = 7.2;
  const fadeDelay = 2.4;
  const fadeDuration = 4.0;

  const coinTextures = await Promise.all(coinAssetUrls.map((url) => Assets.load<Texture>(url)));
  const coins: {
    sprite: AnimatedSprite;
    velocity: { x: number; y: number };
    angularVelocity: number;
  }[] = [];
  const spawnIntervalSeconds = 0.07;
  const gravity = 1800;
  const cleanupMargin = 120;
  const launchAngles = {
    left: degreesToRadians(120),
    right: degreesToRadians(60),
  } as const;
  const angleVariance = degreesToRadians(10);
  let spawnTimer = 0;

  const spawnCoin = (side: keyof typeof launchAngles): void => {
    const coin = new AnimatedSprite(coinTextures);
    const speed = randomBetween(580, 780) * 1.5;
    const angle = launchAngles[side] + randomBetween(-angleVariance, angleVariance);
    const scale = randomBetween(0.85, 1.1) * 0.5;

    coin.anchor.set(0.5);
    coin.position.set(app.screen.width / 2, app.screen.height / 2);
    coin.rotation = randomBetween(-Math.PI, Math.PI);
    coin.animationSpeed = randomBetween(0.6, 0.95);
    coin.scale.set(scale);
    coin.loop = true;
    coin.play();

    app.stage.addChild(coin);

    coins.push({
      sprite: coin,
      velocity: {
        x: Math.cos(angle) * speed,
        y: -Math.sin(angle) * speed,
      },
      angularVelocity: randomBetween(-Math.PI, Math.PI),
    });
  };

  const updateCoins = (deltaSeconds: number): void => {
    spawnTimer += deltaSeconds;

    while (spawnTimer >= spawnIntervalSeconds) {
      spawnTimer -= spawnIntervalSeconds;
      spawnCoin('left');
      spawnCoin('right');
    }

    for (let index = coins.length - 1; index >= 0; index -= 1) {
      const coin = coins[index];
      const sprite = coin.sprite;

      coin.velocity.y += gravity * deltaSeconds;
      sprite.x += coin.velocity.x * deltaSeconds;
      sprite.y += coin.velocity.y * deltaSeconds;
      sprite.rotation += coin.angularVelocity * deltaSeconds;

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

    for (let index = 0; index < arrowsPerBurst; index += 1) {
      const arrow = new Sprite(arrowTextures[Math.floor(Math.random() * arrowTextures.length)]);
      const jitter = (Math.random() - 0.5) * baseSpacing * 0.6;
      const angle = baseAngle + index * baseSpacing + jitter;
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

      timeline.to(
        arrow,
        {
          alpha: 1,
          duration: 0.2,
          ease: 'sine.in',
        },
        0.18,
      );

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
    repeatDelay: 0.8,
    delay: 0.6,
  });

  burstTimeline.call(emitArrows).call(emitArrows, undefined, '+=0.18').call(emitArrows, undefined, '+=0.18');

  const handleResize = (): void => {
    const nextWidth = Math.max(window.innerWidth, 720);
    const nextHeight = Math.max(window.innerHeight, 480);

    app.renderer.resize(nextWidth, nextHeight);
    app.canvas.width = nextWidth;
    app.canvas.height = nextHeight;
    repositionBackground();
  };

  window.addEventListener('resize', handleResize, { passive: true });
  handleResize();
}

void bootstrap();
