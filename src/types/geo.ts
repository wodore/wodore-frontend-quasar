/**
 * Types for nearby images API response
 */

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
  provider: string;
  provider_info: {
    name: string;
    slug: string;
    website: string | null;
    icon: string | null;
  };
  source_id: string;
  source_url: string;
  source: string; // Provider/source name
  image_type: string;
  captured_at: string | null;
  distance_m: number;
  license_slug: string;
  license_name: string; // Human-readable license name
  attribution: string | { full?: string; short?: string };
  author: string | null;
  urls: ImageUrls;
  width: number | null;
  height: number | null;
  preferred_mode: string;
  focal: FocalPoint | null;
  crop: CropArea | null;
  place: ImagePlace | null;
  score: number;
}

export interface ImageUrls {
  original: {
    raw: string;
    proxy: string;
  };
  square: ImageSizeVariants;
  landscape: ImageSizeVariants;
  portrait: ImageSizeVariants;
}

export interface ImageSizeVariants {
  avatar: string;
  'avatar@2x': string;
  thumb: string;
  'thumb@2x': string;
  preview: string;
  'preview@2x': string;
  placeholder: string;
  'placeholder@2x': string;
  medium: string;
  'medium@2x': string;
  large: string;
  'large@2x': string;
}

export interface FocalPoint {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface CropArea {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface ImagePlace {
  id: number;
  slug: string;
  name: string;
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
  id: string; // combination of provider and source_id
}
