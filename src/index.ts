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
