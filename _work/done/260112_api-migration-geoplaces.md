# GeoPlaces API Migration Guide

## Overview

The GeoPlaces API endpoints have been updated with a new URL structure, improved response schemas, and better type safety. This document outlines the steps needed to migrate the frontend to use the new endpoints.

**IMPORTANT**: This project uses auto-generated API clients from OpenAPI schemas. Do NOT manually create or maintain TypeScript types for API responses. Always regenerate the client after backend changes.

## Breaking Changes

### 1. Base URL Change

**Old URL Pattern:**

```
/api/v1/geoplaces/{endpoint}
```

**New URL Pattern:**

```
/api/v1/geo/places/{endpoint}
```

### 2. Category Tag Change

**Old Tag:** `geoplace`
**New Tag:** `geometries`

This affects API documentation grouping and filtering.

### 3. Response Schema Changes

The response structure has been improved with proper schemas and nested objects. The main change is that **symbol fields are now nested under a `symbol` object**.

#### Symbol Field Mapping

| Old Field Path             | New Field Path               |
| -------------------------- | ---------------------------- |
| `place_type.icon`          | `place_type.symbol.mono`     |
| `place_type.symbol`        | `place_type.symbol.detailed` |
| `place_type.symbol_simple` | `place_type.symbol.simple`   |

## Migration Steps

### Step 1: Regenerate API Client

After backend changes are deployed, regenerate the API client to get updated TypeScript types:

```bash
# For local development
yarn gen:api-local

# For production API
yarn gen:api
```

This will update `src/clients/wodore_v1.ts` with the new endpoint paths and response schemas.

**What gets updated automatically:**

- ✅ Endpoint URLs (from `/geoplaces/` to `/geo/places/`)
- ✅ TypeScript type definitions for all request/response schemas
- ✅ Query parameter types
- ✅ Response validation

### Step 2: Update API Calls

The client will handle the URL changes automatically. Just verify your API calls use the correct paths:

```typescript
import createClient from 'openapi-fetch';
import type { paths } from 'clients/wodore_v1';

const client = createClient<paths>({ baseUrl: 'https://api.wodore.com' });

// Search endpoint - URL is automatically updated
const { data, error } = await client.GET('/v1/geo/places/search', {
  params: {
    query: {
      q: 'Matterhorn',
      limit: 15,
      include_place_type: 'all',
      include_sources: 'slug',
    },
  },
});

// Nearby endpoint - URL is automatically updated
const { data, error } = await client.GET('/v1/geo/places/nearby', {
  params: {
    query: {
      lat: 46.0342,
      lon: 7.6488,
      radius: 10000,
      include_place_type: 'all',
    },
  },
});
```

### Step 3: Update Symbol Field Access

**Before (Old Structure):**

```typescript
// Accessing symbol fields (old way)
const iconUrl = place.place_type?.icon;
const detailedSymbolUrl = place.place_type?.symbol;
const simpleSymbolUrl = place.place_type?.symbol_simple;
```

**After (New Structure):**

```typescript
// Accessing nested symbol fields (new way)
const iconUrl = place.place_type?.symbol?.mono;
const detailedSymbolUrl = place.place_type?.symbol?.detailed;
const simpleSymbolUrl = place.place_type?.symbol?.simple;
```

### Step 4: Update Components Using Symbol URLs

Search for all usages of `icon`, `symbol`, and `symbol_simple` fields and update them:

```vue
<template>
  <div v-for="place in places" :key="place.id">
    <!-- OLD -->
    <img :src="place.place_type?.icon" />
    <img :src="place.place_type?.symbol" />
    <img :src="place.place_type?.symbol_simple" />

    <!-- NEW -->
    <img :src="place.place_type?.symbol?.mono" />
    <img :src="place.place_type?.symbol?.detailed" />
    <img :src="place.place_type?.symbol?.simple" />
  </div>
</template>
```

### Step 5: Search and Replace in Codebase

Use these regex patterns to find all occurrences:

**Search for old symbol field access:**

```regex
place_type\?(?:\.\w+)?\.icon
place_type\?(?:\.\w+)?\.symbol
place_type\?(?:\.\w+)?\.symbol_simple
```

**Replace with new structure:**

```regex
# place_type?.icon → place_type?.symbol?.mono
# place_type?.symbol → place_type?.symbol?.detailed
# place_type?.symbol_simple → place_type?.symbol?.simple
```

### Step 6: Update Composables and Services

If you have any composables or services that work with place data, update the symbol field access:

```typescript
// Example in a composable
export function usePlaceSymbol(place: Ref<GeoPlaceSearch | null>) {
  const symbolMono = computed(() => place.value?.place_type?.symbol?.mono);
  const symbolDetailed = computed(() => place.value?.place_type?.symbol?.detailed);
  const symbolSimple = computed(() => place.value?.place_type?.symbol?.simple);

  return { symbolMono, symbolDetailed, symbolSimple };
}
```

### Step 7: Update Tests

Update any tests that reference the old response structure:

```typescript
describe('GeoPlaces', () => {
  it('should display place symbols', async () => {
    // Mock response with new structure
    const mockPlace = {
      id: 1,
      name: 'Test Place',
      place_type: {
        slug: 'peak',
        name: 'Peak',
        symbol: {
          mono: '/icons/mono.svg',
          detailed: '/icons/detailed.svg',
          simple: '/icons/simple.svg',
        },
      },
    };

    // Test new field access
    expect(mockPlace.place_type?.symbol?.mono).toBe('/icons/mono.svg');
  });
});
```

## Type Safety

The auto-generated client provides full type safety. You don't need to manually define types - they're automatically generated from the OpenAPI schema:

```typescript
// Types are auto-generated and available
import type { components } from 'clients/wodore_v1';

type GeoPlaceSearch = components['schemas']['GeoPlaceSearchSchema'];
type GeoPlaceNearby = components['schemas']['GeoPlaceNearbySchema'];
type PlaceSymbol = components['schemas']['SymbolSchema'];
type CategorySchema = components['schemas']['CategorySchema'];

// Use them in your code
const place: GeoPlaceSearch = {
  id: 1,
  name: 'Test',
  // ... TypeScript will enforce correct structure
};
```

## Query Parameters

All query parameters remain the same and are type-safe:

### Search Parameters

```typescript
client.GET('/v1/geo/places/search', {
  params: {
    query: {
      q: string,                    // Required
      limit?: number,               // Default: 15
      offset?: number,              // Default: 0
      types?: string[],             // Place type slugs
      categories?: string[],        // Parent category slugs
      countries?: string[],         // Country codes
      threshold?: number,           // Default: 0.2
      min_importance?: number,      // Default: 0
      deduplicate?: boolean,        // Default: false
      include_place_type?: 'no' | 'slug' | 'all',  // Default: 'all'
      include_sources?: 'no' | 'slug' | 'all',     // Default: 'no'
    },
  },
});
```

### Nearby Parameters

```typescript
client.GET('/v1/geo/places/nearby', {
  params: {
    query: {
      lat: number,                  // Required
      lon: number,                  // Required
      radius?: number,              // Default: 10000 (meters)
      limit?: number,               // Default: 20
      offset?: number,              // Default: 0
      types?: string[],             // Place type slugs
      categories?: string[],        // Parent category slugs
      min_importance?: number,      // Default: 0
      include_place_type?: 'no' | 'slug' | 'all',  // Default: 'all'
      include_sources?: 'no' | 'slug' | 'all',     // Default: 'no'
    },
  },
});
```

## Testing Checklist

- [ ] Regenerate API client with `yarn gen:api-local` or `yarn gen:api`
- [ ] Verify no TypeScript errors in generated client
- [ ] Update all symbol field access (`.icon` → `.symbol?.mono`, etc.)
- [ ] Test search functionality with new response structure
- [ ] Test nearby functionality with new response structure
- [ ] Verify symbol images display correctly in UI
- [ ] Update and run all unit tests
- [ ] Update and run all component tests
- [ ] Test error handling with new endpoints
- [ ] Run `yarn lint` and fix any issues

## Rollback Plan

If issues arise, the backend still supports the old query parameters. You can:

1. Keep using the old code temporarily
2. Use feature flags to toggle between old/new implementations
3. Gradually migrate components one at a time

However, the URL path change (`/geoplaces/` → `/geo/places/`) is a breaking change that requires updating all API calls.

## Common Issues

### Issue: TypeScript errors after regenerating client

**Solution:**

```bash
# Clean and regenerate
rm -rf src/clients/wodore_v1.ts
yarn gen:api-local
```

### Issue: Missing types for new fields

**Solution:** Ensure you've regenerated the API client after backend deployment. The types are auto-generated from the OpenAPI schema.

### Issue: Symbol images not displaying

**Solution:** Check that you're accessing the nested `symbol` object:

```typescript
// Wrong
place.place_type?.icon;

// Correct
place.place_type?.symbol?.mono;
```

## Additional Resources

- **Backend API Documentation**: `http://localhost:8000/api/v1/openapi.json`
- **Frontend Development Guide**: `AGENT.md`
- **API Client**: `src/clients/wodore_v1.ts` (auto-generated)
- **Backend Schema Definitions**: `../wodore-backend/server/apps/geometries/schemas.py`
- **Organization Schemas**: `../wodore-backend/server/apps/organizations/schema.py`

## Best Practices

1. **Always regenerate after backend changes**: Run `yarn gen:api-local` after any backend API changes

2. **Trust auto-generated types**: Don't manually define types that are already generated by the OpenAPI client

3. **Use type-safe API calls**: Always use the generated client with proper typing:

   ```typescript
   const { data } = await client.GET('/v1/geo/places/search', { ... });
   ```

4. **Check types in IDE**: Your IDE should provide autocomplete and type checking for all API responses

5. **Run linter**: Always run `yarn lint` after making changes to ensure code quality

## Questions?

If you encounter any issues during migration:

1. Check the auto-generated types in `src/clients/wodore_v1.ts`
2. Verify the backend API documentation at `/api/v1/openapi.json`
3. Contact the backend team if response structure seems incorrect
