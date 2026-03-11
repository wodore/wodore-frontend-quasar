import { ref, watchEffect, type Ref } from 'vue';
import { clientWodore } from '@clients/index';
import type { components } from '@clients/wodore_v1.d';

// Type shortcuts from OpenAPI generated types
type ImageCollectionResponse = components['schemas']['ImageCollectionResponse'];
type ImagePropertiesSchema = components['schemas']['ImagePropertiesSchema'];

/**
 * Extended image type with ID for component compatibility
 * Uses Omit to remove conflicting fields, then makes them required
 */
export interface HutImage extends Omit<
  ImagePropertiesSchema,
  'provider' | 'source_id' | 'attribution' | 'license' | 'urls'
> {
  id: string; // combination of provider and source_id
  provider: components['schemas']['ImageProviderSchema']; // Required
  source_id: string; // Required
  attribution: components['schemas']['ImageAttributionSchema']; // Required
  license: components['schemas']['ImageLicenseSchema']; // Required
  urls: components['schemas']['ImageUrlsSchema']; // Required
}

/**
 * Composable for fetching images for a specific hut using the specialized endpoint
 * This is faster than the nearby endpoint as it uses the hut slug directly
 */
export function useHutImages(hutSlug?: Ref<string | undefined>) {
  const images = ref<HutImage[]>([]);
  const loading = ref(false);
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
          ...props,
          id: `${props.provider.slug}_${props.source_id}`,
        } as HutImage;
      });
  };

  /**
   * Fetch images for a specific hut
   */
  const fetchHutImages = async (slug: string) => {
    if (!slug) {
      return;
    }

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
            radius: 50,
            limit: 20,
          },
        },
      });

      if (err) {
        console.error('Error fetching hut images:', err);
        error.value = 'Failed to load images';
      } else if (data) {
        images.value = transformResponse(data as unknown as ImageCollectionResponse);
      }
    } catch (err) {
      console.error('Error fetching hut images:', err);
      error.value = 'Failed to load images';
    } finally {
      loading.value = false;
    }
  };

  // Watch for hut slug changes and fetch images
  watchEffect(() => {
    const slug = hutSlug?.value;

    if (slug) {
      fetchHutImages(slug);
    } else {
      images.value = [];
    }
  });

  return {
    images,
    loading,
    error,
  };
}
