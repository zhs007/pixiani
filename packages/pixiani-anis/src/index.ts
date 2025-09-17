import { AnimationManager } from '@pixi-animation-library/pixiani-engine';

import { ArcBounce3sAnimation } from './animations/ArcBounce3sAnimation';
import { BlackHoleSpiralAnimation } from './animations/BlackHoleSpiralAnimation';
import { CoinV2Animation } from './animations/CoinV2Animation';
import { ComplexPopAnimation } from './animations/ComplexPopAnimation';
import { FadeAnimation } from './animations/FadeAnimation';
import { FlagWaveAnimation } from './animations/FlagWaveAnimation';
import { ParticleSpinAnimation } from './animations/ParticleSpinAnimation';
import { ScaleAnimation } from './animations/ScaleAnimation';
import { ScaleRotateScale } from './animations/ScaleRotateScale';
import { StairBounceAnimation } from './animations/StairBounceAnimation';
import { VortexAnimation } from './animations/VortexAnimation';

// Export all animation classes individually
export {
  ArcBounce3sAnimation,
  BlackHoleSpiralAnimation,
  CoinV2Animation,
  ComplexPopAnimation,
  FadeAnimation,
  FlagWaveAnimation,
  ParticleSpinAnimation,
  ScaleAnimation,
  ScaleRotateScale,
  StairBounceAnimation,
  VortexAnimation,
};

// Array of all animation classes for easier registration
const allAnimations = [
  ArcBounce3sAnimation,
  BlackHoleSpiralAnimation,
  CoinV2Animation,
  ComplexPopAnimation,
  FadeAnimation,
  FlagWaveAnimation,
  ParticleSpinAnimation,
  ScaleAnimation,
  ScaleRotateScale,
  StairBounceAnimation,
  VortexAnimation,
];

/**
 * Registers all animations in this package with the provided AnimationManager.
 * @param manager - The AnimationManager instance to register animations with.
 * @returns {AnimateClass[]} The array of animation classes that were registered.
 */
export function registerAllAnimations(manager: AnimationManager): any[] {
  allAnimations.forEach((animClass) => {
    manager.register(animClass);
  });
  return allAnimations;
}
