/**
 * Map Menu Store
 *
 * Controls the global map menu drawer state.
 * Determines what content is shown in the menu (default, overlay config, etc.)
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export type MenuType =
  | 'default' // Default menu (login, versions, etc.)
  | 'overlay-config'; // Overlay configuration (filter, info, settings)
// Future: 'basemaps', 'global-settings', etc.

export interface MenuData {
  overlayName?: string;
  initialTab?: string;
  title?: string;
  [key: string]: unknown;
}

export const useMapMenuStore = defineStore('mapMenu', () => {
  // State
  const menuOpen = ref(false);
  const menuType = ref<MenuType>('default');
  const menuData = ref<MenuData>({});
  const history = ref<Array<{ type: MenuType; data: MenuData }>>([]);

  // Computed
  const canGoBack = computed(() => history.value.length > 0);

  // Actions
  function openMenu() {
    menuOpen.value = true;
  }

  function closeMenu() {
    menuOpen.value = false;
    // Reset to default after close animation
    setTimeout(() => {
      if (!menuOpen.value) {
        reset();
      }
    }, 300);
  }

  function toggleMenu() {
    menuOpen.value = !menuOpen.value;
  }

  function setMenuType(type: MenuType, data: MenuData = {}) {
    // Save current state to history if not default
    if (menuType.value !== 'default') {
      history.value.push({
        type: menuType.value,
        data: { ...menuData.value },
      });
    }

    menuType.value = type;
    menuData.value = data;

    console.debug('[MapMenuStore] Set menu type:', type, data);
  }

  function openOverlayConfig(overlayName: string, initialTab?: string) {
    setMenuType('overlay-config', {
      overlayName,
      initialTab,
    });
    openMenu();
  }

  function goBack() {
    if (history.value.length > 0) {
      const previous = history.value.pop()!;
      menuType.value = previous.type;
      menuData.value = previous.data;
    } else {
      reset();
    }
  }

  function reset() {
    menuType.value = 'default';
    menuData.value = {};
    history.value = [];
  }

  return {
    // State
    menuOpen,
    menuType,
    menuData,

    // Computed
    canGoBack,

    // Actions
    openMenu,
    closeMenu,
    toggleMenu,
    setMenuType,
    openOverlayConfig,
    goBack,
    reset,
  };
});
