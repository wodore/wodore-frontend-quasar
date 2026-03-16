/**
 * Swiper effect configurations for Wodore media components
 */

import type { Swiper } from 'swiper';

/**
 * Custom Overlay Effect for Swiper
 *
 * Effect behavior:
 * - Active slide (current image): stays 100% stationary, fully visible
 * - Next slide (incoming from right): starts at +80% translate, transparent, animates to 0, opaque
 * - Prev slide (incoming from left): starts at -80% translate, transparent, animates to 0, opaque
 *
 * This creates a smooth overlay transition where the old image remains visible
 * while the new image slides over it.
 */
export const OverlayEffect = {
  name: 'overlay',
  params: {
    overlayEffect: {
      transformProgress: 1,
      slideScale: 1,
      slideShadows: false,
    },
  },
  create() {
    // Effect initialization - no setup needed for this simple effect
  },
  on: {
    beforeTransitionStart(swiper: Swiper) {
      // Reset any custom styles before transition
      const slides = swiper.slides;
      slides.forEach(slide => {
        const el = slide as HTMLElement;
        el.style.transition = '';
      });
    },
    setTransition(swiper: Swiper, duration: number) {
      const { slides } = swiper;

      slides.forEach(slide => {
        const el = slide as HTMLElement;
        el.style.transition = `${duration}ms transform, ${duration}ms opacity`;
      });
    },
    setTranslate(swiper: Swiper) {
      const { slides, activeIndex } = swiper;

      slides.forEach((slide, index) => {
        const el = slide as HTMLElement;
        const slideProgress =
          (index - activeIndex) *
          (swiper as unknown as { progressMultiplier: number }).progressMultiplier;

        // Active slide - completely stationary, fully visible
        if (index === activeIndex) {
          el.style.transform = 'translate3d(0, 0, 0)';
          el.style.opacity = '1';
          return;
        }

        // Calculate slide position relative to active
        const offset = slideProgress;

        // Determine direction and apply transforms
        if (offset < 0) {
          // Slide is to the left (will come from left when going backwards)
          const absProgress = Math.abs(offset);
          el.style.transform = `translate3d(${-absProgress * 80}%, 0, 0)`;
          el.style.opacity = String(absProgress < 1 ? absProgress : 1);
        } else if (offset > 0) {
          // Slide is to the right (will come from right when going forward)
          el.style.transform = `translate3d(${offset * 80}%, 0, 0)`;
          el.style.opacity = String(offset < 1 ? offset : 1);
        } else {
          // Adjacent slide, not transitioning
          el.style.transform = 'translate3d(0, 0, 0)';
          el.style.opacity = '0';
        }
      });
    },
  },
};

/**
 * Creative effect configuration for preview mode
 * Old/current image stays stationary
 * New image starts transparent and shifted, then slides to position and becomes opaque
 */
export const previewCreativeEffect = {
  progressMultiplier: 1,
  limitProgress: 1,
  shadowPerProgress: false,
  perspective: false, // Disable 3D perspective for flat animation
  prev: {
    // Previous slide (old content) - stays completely stationary
    translate: [0, 0, 0] as [number, number, number],
    opacity: 1,
    scale: 1,
  },
  next: {
    // Next slide (new content) - comes from side, starting transparent
    translate: ['80%', 0, 0] as [string, number, number],
    opacity: 0,
    scale: 1,
  },
} as const;

/**
 * Swiper module imports needed for effects
 */
export { EffectCreative } from 'swiper/modules';
