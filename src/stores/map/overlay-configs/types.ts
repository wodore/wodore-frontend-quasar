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
  parent: string;
  identifier: string;
  children: boolean;
  symbol_detailed?: string;
  symbol_simple?: string;
  symbol_mono?: string;
}
