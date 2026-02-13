/**
 * Overlay Configuration System - Type Definitions
 *
 * This module defines the types for configurable overlay filters, settings, and legends.
 */

// Filter Types
// ============

export type FilterType = 'multi-select' | 'single-select' | 'slider' | 'toggle' | 'range';

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
  options?: FilterOption[];
  defaultValue?: unknown;
  min?: number;
  max?: number;
  step?: number;
}

// Setting Types
// =============

export type SettingType = 'toggle' | 'slider' | 'select' | 'color' | 'number';

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
}

// Legend Types
// ============

export interface LegendItem {
  icon?: string;
  color?: string;
  label: string;
  description?: string;
  metadata?: {
    iconDetailed?: string | null;
    iconSimple?: string | null;
    [key: string]: unknown;
  };
}

export interface LegendSection {
  title: string;
  description?: string;
  items: LegendItem[];
}

export interface LegendDefinition {
  sections: LegendSection[];
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

// Hut Category (from backend API)
// ================================

export interface HutCategory {
  slug: string;
  name: string;
  description: string;
  order: number;
  level: number;
  parent?: string | null;
  identifier: string;
  children: boolean;
  symbol_detailed?: string | null;
  symbol_simple?: string | null;
  symbol_mono?: string | null;
}

export interface AvailabilityCategory {
  slug: string;
  name: string;
  description: string;
  order: number;
  level: number;
  parent?: string | null;
  identifier: string;
  children: boolean;
  color?: string | null;
  color_text?: string | null;
  symbol_detailed?: string | null;
  symbol_simple?: string | null;
}
