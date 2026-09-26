/**
 * Overlay Configuration System - Type Definitions
 *
 * This module defines the types for configurable overlay filters, settings, and legends.
 */

// Category Configuration
// ======================

/**
 * Category data source:
 * - string: Fetch from backend API using slug (e.g., 'accommodation')
 * - CategoryItem[]: Use provided data directly (frontend-defined)
 * - CategoryConfigObject: Fetch from API with custom field mappings
 */
export type CategorySource = string | CategoryItem[] | CategoryConfigObject;

/**
 * Advanced configuration for fetching data from category API
 * Only needed when you want to customize field mappings or endpoint
 */
export interface CategoryConfigObject {
  slug: string; // Category parent slug (e.g., 'accommodation', 'public_transport')
  apiEndpoint?: string; // Override default endpoint if needed
  labelField?: string; // Which field to use as label (default: 'name')
  valueField?: string; // Which field to use as value (default: 'identifier')
}

// Legacy alias for backwards compatibility
export type CategoryConfig = CategorySource;

// Filter Types
// ============

export type FilterType = 'multi-select' | 'single-select' | 'slider' | 'toggle' | 'range';

/**
 * Primitive filter/setting value: toggles (boolean), sliders/ranges
 * (number), selects/colors (string), plus null.
 */
export type OverlayPrimitive = string | number | boolean | null;

/**
 * Runtime value of a filter or setting preference. Heterogeneous by design:
 * primitives, arrays of primitives (multi-select) or flat option objects
 * (e.g. `{min, max}` ranges), sourced from config definitions and
 * persisted JSON. Bounded to one object/array level — the shapes the
 * Quasar filter/setting inputs actually produce.
 */
export interface OverlayValueObject {
  [key: string]: OverlayPrimitive | undefined;
}
export type OverlayValue = OverlayPrimitive | OverlayPrimitive[] | OverlayValueObject;

/**
 * Boundary guard for values read from persisted preferences or config
 * definitions: accepts exactly the shapes `OverlayValue` allows and
 * rejects everything else, so callers get a narrowed domain type
 * without trusting localStorage blindly.
 */
export function isOverlayValue(value: unknown): value is OverlayValue {
  const isPrimitive = (v: unknown): v is OverlayPrimitive =>
    v === null || ['string', 'number', 'boolean'].includes(typeof v);
  if (isPrimitive(value)) {
    return true;
  }
  if (Array.isArray(value)) {
    return value.every(isPrimitive);
  }
  if (typeof value === 'object') {
    return Object.values(value).every(isPrimitive);
  }
  return false;
}

export interface FilterOption {
  value: string;
  label: string;
  icon?: string;
  description?: string;
  color?: string;
  iconDetailed?: string;
  iconSimple?: string;
}

export interface FilterDefinition {
  id: string;
  label: string;
  type: FilterType;
  category?: CategoryConfig; // Auto-populate options from category API
  options?: FilterOption[];
  defaultValue?: unknown;
  min?: number;
  max?: number;
  step?: number;
  mapLayers?: string[]; // Map layers to apply filter to
  mapProperty?: string; // GeoJSON property to filter on
  filterExpression?: 'in' | 'eq' | 'range' | 'custom'; // Filter expression type
}

// Setting Types
// =============

export type SettingType = 'toggle' | 'slider' | 'select' | 'color' | 'number' | 'custom';

export interface SettingOption {
  value: string | number;
  label: string;
}

export interface SettingDefinition {
  id: string;
  label: string;
  type: SettingType;
  description?: string;
  defaultValue: unknown;
  options?: SettingOption[];
  min?: number;
  max?: number;
  step?: number;
  dependsOn?: string;
  unit?: string;
  component?: string; // Component name for custom settings (e.g., 'WdHutOccupancySettings')
}

// Legend Types
// ============

/**
 * How to render legend items:
 * - symbol_detailed: Show detailed icon only
 * - symbol_simple: Show simple icon only
 * - symbol_mono: Show monochrome icon only
 * - symbol_dual: Show both detailed and simple icons side-by-side
 * - line: Show colored line
 * - area: Show colored rectangle
 * - point: Show colored circle
 */
export type InfoItemType =
  | 'symbol_detailed'
  | 'symbol_simple'
  | 'symbol_mono'
  | 'symbol_dual'
  | 'line'
  | 'area'
  | 'point';

/**
 * Link item for overlay information
 */
export interface LinkItem {
  name: string;
  url: string;
}

export interface LegendItem {
  icon?: string;
  color?: string;
  label: string;
  description?: string;
  metadata?: {
    iconDetailed?: string | null;
    iconSimple?: string | null;
    iconMono?: string | null;
    type?: InfoItemType;
    [key: string]: unknown;
  };
}

export interface LegendSection {
  title: string;
  description?: string;
  category?: CategoryConfig; // Auto-populate items from category API
  type?: InfoItemType; // How to render items (symbol/line/area/point)
  items: LegendItem[];
}

export interface LegendDefinition {
  sections: LegendSection[];
  links?: LinkItem[]; // List of related links (displayed below description)
  attribution?: LinkItem[]; // List of data sources/attributions (displayed at bottom)
}

// Overlay Configuration
// =====================

export interface OverlayConfig {
  filters?: FilterDefinition[];
  settings?: SettingDefinition[];
  legend?: LegendDefinition;
}

export interface OverlayConfigs {
  [overlayName: string]: OverlayConfig;
}

// User Preferences
// ================

export interface OverlayPreferences {
  [overlayName: string]: {
    filters?: Record<string, unknown>;
    settings?: Record<string, unknown>;
  };
}

// Category Item (from backend API)
// =================================

/**
 * Generic category item structure from backend API
 * Used for accommodation, public_transport, availability, etc.
 *
 * Fields marked as optional are only required when fetched from backend.
 * Frontend-defined categories only need: slug, name, identifier, and any relevant display fields.
 */
export interface CategoryItem {
  slug: string;
  name: string;
  description?: string;
  order?: number;
  level?: number;
  parent?: string | null;
  identifier: string;
  children?: boolean;
  symbol_detailed?: string | null;
  symbol_simple?: string | null;
  symbol_mono?: string | null;
  color?: string | null;
  color_text?: string | null;
}

// Legacy type aliases for backward compatibility
export type HutCategory = CategoryItem;
export type AvailabilityCategory = CategoryItem;
