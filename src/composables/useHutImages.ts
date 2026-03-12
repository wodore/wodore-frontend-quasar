import { computed, type Ref } from 'vue';
import { useMediaImages } from './useMediaImages';

/**
 * Extended image type with ID for component compatibility
 * Uses Omit to remove conflicting fields, then makes them required
 */
export interface HutImage {
  id: string; // combination of provider and source_id
  provider: {
    name: string;
    slug: string;
    website?: string | null;
    icon?: string | null;
  };
  source_id: string;
  attribution: {
    short?: string;
    full?: string;
  };
  license: {
    name: string;
    slug: string;
    url?: string | null;
  };
  urls: {
    square: Record<string, string>;
    landscape: Record<string, string>;
    portrait?: Record<string, string>;
    original: {
      raw: string;
    };
  };
  is_portrait?: boolean;
  captured_at?: string;
  width?: number;
  height?: number;
  distance_m?: number;
  image_type?: string;
  focal?: Record<string, unknown>;
  crop?: Record<string, unknown>;
  place?: Record<string, unknown>;
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
