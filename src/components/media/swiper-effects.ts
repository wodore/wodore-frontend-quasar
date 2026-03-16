/**
 * Swiper effect configurations for Wodore media components
 */

/**
 * Creative effect configuration for preview mode
 * Current slide starts at 80%, slides to 100% and fades out
 * Works symmetrically for both prev and next navigation
 */
export const previewCreativeEffect = {
  // The current/active slide when transitioning
  // Slides from center (80%) to edge (100%) while fading out
  progressMultiplier: 1,
  limitProgress: 1,
  shadowPerProgress: false,
  perspective: true,
  prev: {
    // When going backward: current slide moves right and fades
    translate: ['20%', 0, 0] as [string, number, number],
    opacity: 0,
    scale: 1,
  },
  next: {
    // When going forward: current slide moves left and fades
    translate: ['-20%', 0, 0] as [string, number, number],
    opacity: 0,
    scale: 1,
  },
} as const;

/**
 * Swiper module imports needed for effects
 */
export { EffectCreative } from 'swiper/modules';
