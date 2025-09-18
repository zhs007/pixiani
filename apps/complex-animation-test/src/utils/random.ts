export const randomFloat = (min: number, max: number): number => Math.random() * (max - min) + min;

export const randomInt = (min: number, max: number): number => Math.floor(randomFloat(min, max + 1));
