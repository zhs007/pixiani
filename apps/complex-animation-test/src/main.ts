import './style.css';
import { ComplexStage } from './stage/ComplexStage';

async function bootstrap(): Promise<void> {
  const host = document.getElementById('app');

  if (!host) {
    throw new Error('Unable to locate #app container');
  }

  const stage = new ComplexStage({
    backgroundColor: 0x060f24,
    pixelRatio: Math.min(window.devicePixelRatio, 2),
    initialWidth: Math.min(window.innerWidth, 1280),
    initialHeight: Math.min(window.innerHeight, 720),
    showDebugOverlay: true,
  });

  await stage.init();
  stage.mount(host);
  stage.start();

  const handleResize = (): void => {
    stage.resize(Math.max(window.innerWidth, 720), Math.max(window.innerHeight, 480));
  };

  window.addEventListener('resize', handleResize, { passive: true });
  handleResize();
}

void bootstrap();
