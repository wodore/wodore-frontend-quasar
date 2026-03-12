import { ref, watchEffect, type Ref } from 'vue';
import { clientWodore } from '@clients/index';
import type { components } from '@clients/wodore_v1.d';
import type { HutImage } from './useHutImages';

// Type shortcuts from OpenAPI generated types
type ImageCollectionResponse = components['schemas']['ImageCollectionResponse'];

/**
 * Generic image loading options
 * Only ONE of hutSlug, placeName, or coordinates should be provided
 */
export interface MediaImagesOptions {
  hutSlug?: string;
  placeName?: string;
  lat?: number;
  lon?: number;
  radius?: number;
  limit?: number;
  progressive?: boolean;
}

/**
 * Generic composable for fetching images from various sources
 * Supports loading by:
 * - Hut slug (fastest, uses specialized endpoint)
 * - Place name (geocoding + nearby images)
 * - Coordinates (nearby images)
 */
export function useMediaImages(options?: Ref<MediaImagesOptions> | MediaImagesOptions) {
  const images = ref<HutImage[]>([]);
  const loading = ref(false);
  const loadingWodore = ref(false);
  const loadingAll = ref(false);
  const error = ref<string | null>(null);

  /**
   * Transform API response to HutImage array
   */
  const transformResponse = (response: ImageCollectionResponse): HutImage[] => {
    return response.features
      .filter(feature => feature.properties !== null)
      .map(feature => {
        const props = feature.properties!;
        return {
          id: `${props.provider.slug}_${props.source_id}`,
          provider: {
            name: props.provider.name,
            slug: props.provider.slug,
            website: props.provider.url || null,
            icon: props.provider.icon || null,
          },
          source_id: props.source_id,
          attribution: props.attribution || { short: '', full: '' },
          license: props.license || { name: '', slug: '', url: null },
          urls: props.urls,
          is_portrait: props.is_portrait,
          captured_at: props.captured_at,
          width: props.width,
          height: props.height,
          distance_m: props.distance_m,
          image_type: props.image_type,
          focal: props.focal,
          crop: props.crop,
          place: props.place,
          score: props.score,
        } as unknown as HutImage;
      });
  };

  /**
   * Fetch images by hut slug (specialized endpoint - fastest)
   */
  const fetchByHutSlug = async (slug: string, radius = 50, limit = 20) => {
    if (!slug) return;

    loading.value = true;
    error.value = null;

    try {
      const { data, error: err } = await clientWodore.GET('/v1/geo/images/hut/{hut_slug}', {
        params: {
          path: {
            hut_slug: slug,
          },
          query: {
            lang: 'de',
            radius,
            limit,
          },
        },
      });

      if (err) {
        // Silently handle errors - don't console.error network failures
        const errorMessage = (err as { message?: string }).message || String(err);
        if (errorMessage === 'Failed to fetch') {
          // Network error - silently ignore
          images.value = [];
        } else {
          // API error - log but don't crash
          console.warn('API error fetching hut images:', err);
          images.value = [];
        }
      } else if (data) {
        images.value = transformResponse(data as unknown as ImageCollectionResponse);
      } else {
        images.value = [];
      }
    } catch (err) {
      // Handle unexpected errors silently
      const errorMessage = (err as { message?: string }).message || String(err);
      if (errorMessage === 'Failed to fetch') {
        // Network error - silently ignore
        images.value = [];
      } else {
        // Unexpected error - log but don't crash
        console.warn('Unexpected error fetching hut images:', err);
        images.value = [];
      }
    } finally {
      loading.value = false;
    }
  };

  /**
   * Fetch images by coordinates (nearby images endpoint)
   */
  const fetchByCoordinates = async (
    latitude: number,
    longitude: number,
    radius = 50,
    limit = 20,
    progressive = true
  ) => {
    if (!latitude || !longitude) return;

    loading.value = true;
    error.value = null;

    // For progressive loading, fetch wodore first
    if (progressive) {
      loadingWodore.value = true;
      loadingAll.value = true;

      try {
        // Request 1: Wodore only (fast)
        const wodorePromise = clientWodore.GET('/v1/geo/images/nearby', {
          params: {
            query: {
              lat: latitude,
              lon: longitude,
              radius: 10,
              precision: 'precise',
              limit: 5,
              sources: 'wodore',
              lang: 'de',
            },
          },
        });

        // Request 2: All sources (slower)
        const allPromise = clientWodore.GET('/v1/geo/images/nearby', {
          params: {
            query: {
              lat: latitude,
              lon: longitude,
              radius,
              precision: 'normal',
              limit,
              lang: 'de',
            },
          },
        });

        // Handle wodore response first
        wodorePromise.then(({ data, error: err }) => {
          loadingWodore.value = false;

          if (err) {
            console.error('Error fetching wodore images:', err);
          } else if (data) {
            const wodoreImages = transformResponse(data as unknown as ImageCollectionResponse);
            images.value = mergeImages(images.value, wodoreImages);
          }
        });

        // Handle all sources response
        const { data: allData, error: allErr } = await allPromise;
        loadingAll.value = false;

        if (allErr) {
          console.error('Error fetching all images:', allErr);
          error.value = 'Failed to load images';
        } else if (allData) {
          const allImages = transformResponse(allData as unknown as ImageCollectionResponse);
          images.value = mergeImages(images.value, allImages);
        }
      } catch (err) {
        console.error('Error fetching nearby images:', err);
        error.value = 'Failed to load images';
        loadingWodore.value = false;
        loadingAll.value = false;
      } finally {
        loading.value = false;
      }
    } else {
      // Non-progressive: single request
      try {
        const { data, error: err } = await clientWodore.GET('/v1/geo/images/nearby', {
          params: {
            query: {
              lat: latitude,
              lon: longitude,
              radius,
              limit,
              lang: 'de',
            },
          },
        });

        if (err) {
          console.error('Error fetching nearby images:', err);
          error.value = 'Failed to load images';
        } else if (data) {
          images.value = transformResponse(data as unknown as ImageCollectionResponse);
        }
      } catch (err) {
        console.error('Error fetching nearby images:', err);
        error.value = 'Failed to load images';
      } finally {
        loading.value = false;
      }
    }
  };

  /**
   * Fetch images by place name (geocoding + nearby)
   * Note: This requires geocoding service, not yet implemented
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const fetchByPlaceName = async (placeName: string) => {
    // TODO: Implement geocoding service
    console.warn('fetchByPlaceName not yet implemented - requires geocoding service');
    error.value = 'Place name search not yet implemented';
  };

  /**
   * Merge new images with existing ones, avoiding duplicates
   */
  const mergeImages = (existingImages: HutImage[], newImages: HutImage[]): HutImage[] => {
    const existingIds = new Set(existingImages.map(img => img.id));
    const uniqueNewImages = newImages.filter(img => !existingIds.has(img.id));
    return [...existingImages, ...uniqueNewImages];
  };

  /**
   * Main fetch logic - routes to appropriate method based on options
   */
  const fetchImages = async (opts: MediaImagesOptions) => {
    // Clear existing images
    images.value = [];

    // Priority: hutSlug > coordinates > placeName
    if (opts.hutSlug) {
      await fetchByHutSlug(opts.hutSlug, opts.radius, opts.limit);
    } else if (opts.lat !== undefined && opts.lon !== undefined) {
      await fetchByCoordinates(opts.lat, opts.lon, opts.radius, opts.limit, opts.progressive);
    } else if (opts.placeName) {
      await fetchByPlaceName(opts.placeName);
    }
  };

  // Watch for options changes
  watchEffect(() => {
    if (!options) {
      images.value = [];
      return;
    }

    // Handle both Ref and computed
    const opts = 'value' in options ? options.value : (options as MediaImagesOptions);

    if (!opts) {
      images.value = [];
      return;
    }

    // Validate that only one source is provided
    const sources = [
      opts.hutSlug ? 'hutSlug' : null,
      opts.placeName ? 'placeName' : null,
      opts.lat !== undefined && opts.lon !== undefined ? 'coordinates' : null,
    ].filter(Boolean);

    if (sources.length > 1) {
      console.warn(
        'useMediaImages: Multiple sources provided. Priority: hutSlug > coordinates > placeName'
      );
    }

    fetchImages(opts);
  });

  return {
    images,
    loading,
    error,
    loadingWodore,
    loadingAll,
  };
}
