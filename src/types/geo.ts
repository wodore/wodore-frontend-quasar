/**
 * Types for the geo images API response
 * (`/v1/geo/images/hut/{slug}`, `/v1/geo/images/place/{slug}`, `/v1/geo/images/nearby`)
 */

/** T-shirt size keys, ordered small → large (long edge: ~200 / ~400 / ~1200 / ~2000 / ~4000 px). */
export type ImageSizeKey = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

/** URLs for one aspect group, sized xs through xl (all sizes always present). */
export interface ImageVariantUrls {
  /** ~200px — cards, thumbnails. Focal-cropped. */
  xs: string;
  /** ~400px — previews, 2x thumbnails. Focal-cropped. */
  sm: string;
  /** ~1200px — gallery, 2x previews. Curated crop. */
  md: string;
  /** ~2000px — hero images, 2x gallery. Curated crop. */
  lg: string;
  /** ~4000px — fullscreen, 2x heroes. Curated crop. */
  xl: string;
}

/** Untransformed source URLs. */
export interface ImageOriginalUrls {
  /** Direct URL to the source image (for Wikimedia, a bounded thumb — never the true original). */
  raw: string;
  /** Full-size image served through imagor (JPEG — browsers cannot render TIFF). */
  proxy: string;
}

/** Image URLs grouped by aspect ratio. Pick the group via `is_portrait`. */
export interface ImageUrls {
  original: ImageOriginalUrls;
  /** Square (1:1) variants — for cards and thumbnails. */
  square: ImageVariantUrls;
  /** Landscape (3:2) variants — use when `is_portrait` is false. */
  landscape: ImageVariantUrls;
  /** Portrait (2:3) variants — use when `is_portrait` is true. */
  portrait: ImageVariantUrls;
}

/**
 * ThumbHash placeholder per rendering context.
 * Two crop styles × three aspect groups = six hashes; individual hashes are
 * null when not yet assessed. Decode with `@/utils/thumbhash`.
 */
export interface ImageThumbhashes {
  /** Square (1:1) focal-cropped — matches square xs/sm URLs. */
  thumb_square: string | null;
  /** Landscape (3:2) focal-cropped — matches landscape xs/sm URLs. */
  thumb_landscape: string | null;
  /** Portrait (2:3) focal-cropped — matches portrait xs/sm URLs. */
  thumb_portrait: string | null;
  /** Square (1:1) curated crop — matches square md+ URLs. */
  preview_square: string | null;
  /** Landscape (3:2) curated crop — matches landscape md+ URLs. */
  preview_landscape: string | null;
  /** Portrait (2:3) curated crop — matches portrait md+ URLs. */
  preview_portrait: string | null;
}

/** Pixel dimensions of one image variant. */
export interface ImageDimensions {
  width: number;
  height: number;
}

export interface NearbyImagesResponse {
  type: 'FeatureCollection';
  features: NearbyImageFeature[];
  metadata: NearbyImagesMetadata;
}

export interface NearbyImageFeature {
  type: 'Feature';
  geometry: NearbyImageGeometry;
  properties: NearbyImageProperties;
}

export interface NearbyImageGeometry {
  type: 'Point';
  coordinates: [number, number]; // [lon, lat]
}

export interface NearbyImageProperties {
  provider: {
    slug: string;
    name: string;
    url?: string | null;
    icon?: string | null;
    description?: string | null;
  };
  source_id: string;
  source_url: string | null;
  image_type: 'flat' | '360';
  captured_at: string | null;
  distance_m: number;
  attribution: {
    short: string;
    full: string;
    license_icon?: string | null;
    license_short: string;
    license_full: string;
    author: string;
  };
  author: {
    name?: string | null;
    url?: string | null;
  } | null;
  license: {
    slug: string;
    name: string;
    url?: string | null;
    icon?: string | null;
  };
  urls: ImageUrls;
  /** Pixel dimensions per size key (raw, xs, sm, md, lg, xl) for the image's own orientation. */
  sizes: Record<string, ImageDimensions>;
  /** True if the original is portrait (height > width). Pick urls.portrait when true, urls.landscape when false. */
  is_portrait: boolean | null;
  place: ImagePlace | null;
  /** Display order — higher appears first. */
  score: number;
  /** Always present in API responses; individual hashes may be null when not yet assessed. */
  thumbhashes?: ImageThumbhashes;
}

export interface ImagePlace {
  id: number | null;
  slug: string;
  name: string;
  location: {
    lon: number;
    lat: number;
    elevation?: number | null;
  };
}

export interface NearbyImagesMetadata {
  total: number;
  sources_queried: string[];
  query_radius_m: number;
  center: {
    lat: number;
    lon: number;
  };
  geoplaces_found: number;
  huts_found: number;
}

/**
 * Helper type for image with additional computed properties
 */
export interface HutImage extends NearbyImageProperties {
  id: string; // combination of provider slug and source_id
}
