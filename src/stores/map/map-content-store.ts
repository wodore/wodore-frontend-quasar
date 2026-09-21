import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';

export type ContentType =
  | 'place' // Huts, peaks, bivouacs, etc.
  | 'route' // Hiking routes, tours
  | 'admin' // Account settings, preferences
  | null; // No content open

export const useMapContentStore = defineStore('mapContent', () => {
  // === State ===
  const contentOpen = ref(false);
  const contentType = ref<ContentType>(null);

  // Get router/route once at store initialization
  const router = useRouter();
  const route = useRoute();

  // === Computed ===

  // Extract slug/id from current route
  const contentSlug = computed(() => {
    if (route.meta.contentType) {
      return route.params.slug as string | undefined;
    }
    return undefined;
  });

  const contentId = computed(() => {
    if (route.meta.contentType) {
      return route.params.id as string | undefined;
    }
    return undefined;
  });

  // === Watchers ===

  // Watch route changes to update store state
  watch(
    () => route.meta.contentType,
    newType => {
      if (newType) {
        contentType.value = newType as ContentType;
        contentOpen.value = true;
      } else {
        contentOpen.value = false;
        contentType.value = null;
      }
    },
    { immediate: true }
  );

  // === Actions ===

  function openPlace(slug: string) {
    const current = router.currentRoute.value;
    router.push({
      name: 'map-hut', // Using existing route name for now
      params: { slug },
      query: current.query,
      hash: current.hash,
    });
  }

  function openRoute(id: string) {
    const current = router.currentRoute.value;
    router.push({
      name: 'map-route',
      params: { id },
      query: current.query,
      hash: current.hash,
    });
  }

  function close() {
    const current = router.currentRoute.value;
    router.push({
      name: 'map',
      query: current.query,
      hash: current.hash,
    });
  }

  return {
    // State
    contentOpen,
    contentType,
    contentSlug,
    contentId,

    // Actions
    openPlace,
    openRoute,
    close,
  };
});
