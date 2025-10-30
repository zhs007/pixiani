import './style.css';
import { Application, Assets, Sprite } from 'pixi.js';
import { gsap } from 'gsap';

const backgroundAssetUrl = new URL('../../../assets/winani002/background.png', import.meta.url).href;

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
