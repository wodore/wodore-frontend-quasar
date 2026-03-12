<script setup lang="ts">
import { ref, computed, watchEffect, nextTick } from 'vue';
import { useQuasar } from 'quasar';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@stores/auth-store';
import { useMapMenuStore } from '@stores/map/map-menu-store';
import { useMeta } from 'quasar';
import WodoreLogo from 'components/wodore/WodoreLogo.vue';
import WdPlaceSearchMenu from 'components/search/WdPlaceSearchMenu.vue';
import WdPlaceSearchDialog from 'components/search/WdPlaceSearchDialog.vue';

const authStore = useAuthStore();
const menuStore = useMapMenuStore();

const $q = useQuasar();

const isMobile = computed(() => {
  return $q.screen.xs;
});

// Use store for menu drawer state
const menuDrawerOpen = computed({
  get: () => menuStore.menuOpen,
  set: val => {
    if (val) {
      menuStore.openMenu();
    } else {
      menuStore.closeMenu();
    }
  },
});

const contentDrawerOpen = ref(true);
const showDialog = ref(false);

const route = useRoute();
const router = useRouter();

// Track whether we should navigate when dialog closes
// This prevents double navigation when browser back button is clicked
let shouldNavigateOnHide = false;

// check if route.meta.dialog is set
watchEffect(() => {
  const newDialogState = route.meta?.dialog as boolean;
  showDialog.value = newDialogState;
});

// Set up router guards to track navigation source
router.beforeEach((to, from, next) => {
  const fromDialog = from.meta?.dialog as boolean;
  const toDialog = to.meta?.dialog as boolean;

  // If we're navigating away from a dialog route, prevent onDialogHide from navigating again
  if (fromDialog && !toDialog) {
    shouldNavigateOnHide = false;
  }

  next();
});

// Handle dialog close via backdrop click, ESC key, or close button
// This ensures navigation happens consistently for user-initiated closes
function onDialogHide() {
  // Only navigate if this was a user-initiated dialog close (not router navigation)
  if (!shouldNavigateOnHide) {
    return;
  }

  // Reset flag to prevent duplicate navigation
  shouldNavigateOnHide = false;

  // Check if there's history to go back to
  // If user came directly to this page (e.g., from external link), window.history.state.back will be null
  if (window.history.state.back) {
    router.back();
  } else {
    // No history to go back to, navigate to map instead
    router.push({ name: 'map' });
  }
}

// Watch for dialog state changes to enable navigation on hide
// This MUST be set up as a separate watch after watchEffect to ensure proper ordering
watchEffect(() => {
  // When dialog opens, enable navigation on hide
  // This allows backdrop click, ESC key, and close button to trigger navigation
  if (showDialog.value) {
    // Use nextTick to ensure this runs after the dialog is fully open
    nextTick(() => {
      shouldNavigateOnHide = true;
    });
  }
});
watchEffect(() => {
  contentDrawerOpen.value = route.meta?.content as boolean;
});
const appTitle = process.env.WODORE_APP_NAME || 'Wodore';
const appEnv = process.env.WODORE_ENV || 'production';
const isStaging = computed(() => appEnv === 'staging');
const metaData = {
  title: appTitle,
  meta: {
    description: {
      name: 'description',
      content: 'Wohin gipfelt deine nächste Tour?',
    },
  },
};
watchEffect(() => {
  if (route.name == 'map') {
    useMeta(metaData);
  }
});
useMeta(() => {
  if (!isStaging.value) {
    return {};
  }
  return {
    meta: {
      robots: {
        name: 'robots',
        content: 'noindex,nofollow,noarchive',
      },
    },
  };
});
function closeContent(mode: string) {
  //contentDrawerOpen.value = false;
  console.debug(`Closed content in ${mode} mode.`);
  router.push({
    name: 'map',
    hash: route.hash,
    query: route.query,
  });
}
</script>
<style lang="scss">
.app-header {
  backdrop-filter: blur(10px);
  background-color: rgba(color('primary', 800), 0.85) !important;
  //background: linear-gradient(
  //  180deg,
  //  rgba(color('primary', 800), 1) 0%,
  //  rgba(color('primary', 800), 0.95) 10%,
  //  rgba(color('primary', 700), 0.7) 100%
  //);
}

.preview-badge {
  position: fixed;
  top: 1px;
  left: -26px;
  z-index: 6000;
  font-size: 11px;
  line-height: 10px;
  letter-spacing: 0.04em;
  text-transform: none;
  padding: 2px 32px 2px 26px;
  background-image: repeating-linear-gradient(
    -45deg,
    color('accent', 700),
    color('accent', 700) 6px,
    color('accent', 600) 6px,
    color('accent', 600) 12px
  );
  color: white;
  transform: rotate(-20deg);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
  pointer-events: none;
}
</style>
<template>
  <WdAnalytics />
  <q-layout view="hHh LpR fFf" class="overflow-hidden">
    <div v-if="isStaging" class="preview-badge">preview</div>
    <q-header class="text-white shadow-6 app-header">
      <!-- TOOLBAR -->
      <q-toolbar>
        <WdMenuButton desktop v-model="menuDrawerOpen" />
        <q-toolbar-title>
          <WodoreLogo class="text-h4" :text="!isMobile" icon />
        </q-toolbar-title>
        <WdPlaceSearchMenu v-if="!isMobile" />
        <WdSelectDate />
        <WdPlaceSearchDialog v-if="isMobile" />
        <WdSupportButton v-if="!authStore.isLoggedIn && !isMobile" class="text-secondary-700" />
        <WdFeedbackButton v-if="!isMobile" />

        <WdUser v-if="authStore.isLoggedIn" />

        <!-- MAIN DIALOG -->
        <q-dialog
          v-model="showDialog"
          :maximized="isMobile"
          backdrop-filter="blur(3px) saturate(180%) grayscale(60%)"
          class="dialog-radius"
          @hide="onDialogHide"
          @escape-key="onDialogHide"
        >
          <router-view name="dialog" v-slot="{ Component, route }">
            <!-- <transition name="fade" mode="out-in"> -->
            <component :is="Component" :key="route.path" />
            <!-- </transition> -->
          </router-view>
        </q-dialog>

        <!-- MENU BUTTON mobile open -->
        <WdMenuButton mobile function="open" side="right" v-model="menuDrawerOpen" />
      </q-toolbar>
    </q-header>

    <!-- MENU -->
    <q-drawer
      v-model="menuDrawerOpen"
      :side="isMobile ? 'right' : 'left'"
      :width="300"
      :breakpoint="610"
      class="shadow-2"
      style="max-width: 80vw"
    >
      <!-- TOOLBAR mobile -->
      <q-toolbar v-if="isMobile" class="bg-primary-600 shadow-6">
        <q-toolbar-title>
          <WodoreLogo text class="text-h5" />
        </q-toolbar-title>

        <WdFeedbackButton size="md" />

        <!-- MENU BUTTON mobile close -->
        <WdMenuButton mobile side="right" v-model="menuDrawerOpen" />
      </q-toolbar>
      <router-view name="menu" />
    </q-drawer>

    <!-- PAGE -->
    <q-page-container>
      <router-view v-slot="{ Component }">
        <component :is="Component" />
        <!-- <keep-alive>
        </keep-alive> -->
      </router-view>
    </q-page-container>
    <!-- MAP CONTENT -->
    <WdMapContent @close="closeContent" v-model="contentDrawerOpen" />
  </q-layout>
</template>
