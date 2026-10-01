import { computed, type Ref } from 'vue';
import type { ImageThumbhashes, ImageUrls, ImageDimensions } from 'src/types/geo';
import { useMediaImages } from './useMediaImages';

/**
 * Extended image type with ID for component compatibility
 * Uses Omit to remove conflicting fields, then makes them required
 */
export interface HutImage {
  id: string; // combination of provider slug and source_id
  provider: {
    name: string;
    slug: string;
    website?: string | null;
    icon?: string | null;
  };
  source_id: string;
  source_url?: string | null;
  attribution: {
    short?: string;
    full?: string;
  };
  license: {
    name: string;
    slug: string;
    url?: string | null;
  };
  author: {
    name?: string | null;
    url?: string | null;
  };
  /** URL variants grouped by aspect ratio (square/landscape/portrait), sized xs–xl. */
  urls: ImageUrls;
  /** Pixel dimensions per size key (raw, xs, sm, md, lg, xl) for the image's own orientation. */
  sizes?: Record<string, ImageDimensions>;
  /** ThumbHash placeholders (six variants; individual hashes may be null). */
  thumbhashes?: ImageThumbhashes | null;
  is_portrait?: boolean | null;
  captured_at?: string | null;
  distance_m?: number;
  image_type?: string;
  place?: Record<string, unknown> | null;
  score?: number;
}

/**
 * Composable for fetching images for a specific hut
 * This is now a thin wrapper around the generic useMediaImages composable
 * Uses the specialized /v1/geo/images/hut/{hut_slug} endpoint for optimal performance
 */
export function useHutImages(hutSlug?: Ref<string | undefined>) {
  // Convert hutSlug ref to the format expected by useMediaImages
  const options = computed(() => ({
    hutSlug: hutSlug?.value,
    radius: 50,
    limit: 20,
  }));

  // Use the generic composable
  const mediaImages = useMediaImages(options);

  return {
    images: mediaImages.images,
    loading: mediaImages.loading,
    error: mediaImages.error,
  };
}
