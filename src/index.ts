/**
 * This is the main entry point for the pixi-animation-library.
 * It exports all the public-facing classes and types.
 */

// Core types and interfaces
export * from './core/types';

// Core classes
export { AnimationManager } from './core/AnimationManager';
export { BaseObject } from './core/BaseObject';
export { BaseAnimate } from './core/BaseAnimate';

// Available animations
export { ScaleAnimation } from './animations/ScaleAnimation';
export { FadeAnimation } from './animations/FadeAnimation';
export { ComplexPopAnimation } from './animations/ComplexPopAnimation';
export { FlagWaveAnimation } from './animations/FlagWaveAnimation';
export { VortexAnimation } from './animations/VortexAnimation';
export { BlackHoleSpiralAnimation } from './animations/BlackHoleSpiralAnimation';
export { ParticleSpinAnimation } from './animations/ParticleSpinAnimation';
export { CoinV2Animation } from './animations/CoinV2Animation';
export { StairBounceAnimation } from './animations/StairBounceAnimation';
