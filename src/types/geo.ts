/* Types for the image views — see the generated OpenAPI types for the wire shapes. */

/**
 * Types for nearby images API response
 */

import type { components } from '@clients/wodore_v1.d';

/**
 * Image view types — derived from the generated OpenAPI schema
 * (single source of truth; the hand-maintained mirror drifted years ago).
 */
export type ImageProperties = NonNullable<
  components['schemas']['Feature_Point_ImagePropertiesSchema_']['properties']
>;

/** Image with the computed client-side id (provider slug + source_id). */
export interface HutImage extends ImageProperties {
  id: string;
}

export type NearbyImagesMetadata = components['schemas']['ImageMetadataSchema'];

// Aliases for the generated schema shapes other modules import from here.
export type ImageUrls = NonNullable<ImageProperties['urls']>;
export type ImageVariantUrls = ImageUrls['landscape'];
export type ImageThumbhashes = NonNullable<ImageProperties['thumbhashes']>;
export type ImageDimensions = NonNullable<ImageProperties['sizes']>['sm'];
