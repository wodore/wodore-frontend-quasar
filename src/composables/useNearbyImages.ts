import { ref, watchEffect, type Ref } from 'vue';
import { clientWodore } from '@clients/index';
import type { HutImage, NearbyImagesResponse, NearbyImageFeature } from 'src/types/geo';

/**
 * Composable for fetching nearby images for a hut location
 * Implements progressive loading: first wodore images, then all sources
 */
export function useNearbyImages(lat?: Ref<number | undefined>, lon?: Ref<number | undefined>) {
  const images = ref<HutImage[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const loadingWodore = ref(false);
  const loadingAll = ref(false);

  /**
   * Transform API response to HutImage array
   */
  const transformResponse = (response: NearbyImagesResponse): HutImage[] => {
    return response.features.map((feature: NearbyImageFeature) => ({
      ...feature.properties,
      id: `${feature.properties.provider}_${feature.properties.source_id}`,
    }));
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
   * Fetch nearby images
   */
  const fetchNearbyImages = async (latitude: number, longitude: number) => {
    if (!latitude || !longitude) {
      return;
    }

    loading.value = true;
    error.value = null;

    // Start both requests in parallel
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

      // Request 2: All sources (slower, includes wodore results)
      const allPromise = clientWodore.GET('/v1/geo/images/nearby', {
        params: {
          query: {
            lat: latitude,
            lon: longitude,
            radius: 50,
            precision: 'normal',
            limit: 20,
            lang: 'de',
          },
        },
      });

      // Handle wodore response first (usually faster)
      wodorePromise.then(({ data, error: err }) => {
        loadingWodore.value = false;

        if (err) {
          console.error('Error fetching wodore images:', err);
        } else if (data) {
          const wodoreImages = transformResponse(data as unknown as NearbyImagesResponse);
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
        const allImages = transformResponse(allData as unknown as NearbyImagesResponse);
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
  };

  // Watch for location changes and fetch images
  watchEffect(() => {
    const latitude = lat?.value;
    const longitude = lon?.value;

    if (latitude !== undefined && longitude !== undefined) {
      fetchNearbyImages(latitude, longitude);
    } else {
      images.value = [];
    }
  });

  return {
    images,
    loading,
    error,
    loadingWodore,
    loadingAll,
  };
}
