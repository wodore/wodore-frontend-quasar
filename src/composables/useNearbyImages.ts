import { ref, watch, type Ref } from 'vue';
import { clientWodore } from '@clients/index';
import { currentLocale } from '@services/locale';
import { useLatestRequest } from './useLatestRequest';
import type { paths } from '@clients/wodore_v1.d';
import type { HutImage } from 'src/types/geo';

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

  // Structural type from the endpoint response (generated OpenAPI
  // types): the nearby endpoint inlines its geojson FeatureCollection
  // with looser bbox typing than the strict component schema - accept
  // just what this transform reads.
  type NearbyProperties = NonNullable<
    paths['/v1/geo/images/nearby']['get']['responses']['200']['content']['application/json']['features'][number]['properties']
  >;
  type NearbyEndpointResponse = { features: Array<{ properties: NearbyProperties | null }> };

  /**
   * Transform API response to HutImage array
   */
  const transformResponse = (response: NearbyEndpointResponse): HutImage[] => {
    return response.features
      .filter(feature => feature.properties !== null)
      .map(feature => ({
        ...feature.properties!,
        id: `${feature.properties!.provider.slug}_${feature.properties!.source_id}`,
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
  const latest = useLatestRequest();

  const fetchNearbyImages = async (latitude: number, longitude: number) => {
    if (!latitude || !longitude) {
      return;
    }

    loading.value = true;
    error.value = null;
    const token = latest.next();

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
            lang: currentLocale(),
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
            lang: currentLocale(),
          },
        },
      });

      // Handle wodore response first (usually faster)
      wodorePromise
        .then(({ data, error: err }) => {
          loadingWodore.value = false;

          if (err) {
            console.error('Error fetching wodore images:', err);
          } else if (data) {
            // A newer request superseded this one - do not merge stale images
            if (!latest.isLatest(token)) return;
            const wodoreImages = transformResponse(data);
            images.value = mergeImages(images.value, wodoreImages);
          }
        })
        .catch(() => {
          // Rejected promises must not escape unhandled
          loadingWodore.value = false;
        });

      // Handle all sources response
      const { data: allData, error: allErr } = await allPromise;
      loadingAll.value = false;

      if (!latest.isLatest(token)) return;

      if (allErr) {
        console.error('Error fetching all images:', allErr);
        error.value = 'Failed to load images';
      } else if (allData) {
        const allImages = transformResponse(allData);
        images.value = mergeImages(images.value, allImages);
      }
    } catch (err) {
      if (!latest.isLatest(token)) return;
      console.error('Error fetching nearby images:', err);
      error.value = 'Failed to load images';
      loadingWodore.value = false;
      loadingAll.value = false;
    } finally {
      if (latest.isLatest(token)) {
        loading.value = false;
      }
    }
  };

  // Watch for location and UI-language changes and fetch images.
  // Deliberately `watch`, NOT a `watchEffect`: starting a request runs the
  // API client's progress middleware (reactive read+write of the request
  // counter), which inside a watchEffect became a self-triggering
  // dependency and refetched endlessly — see useMediaImages for details.
  watch(
    [() => lat?.value, () => lon?.value, currentLocale],
    ([latitude, longitude]) => {
      if (latitude !== undefined && longitude !== undefined) {
        void fetchNearbyImages(latitude, longitude);
      } else {
        images.value = [];
      }
    },
    { immediate: true }
  );

  return {
    images,
    loading,
    error,
    loadingWodore,
    loadingAll,
  };
}
