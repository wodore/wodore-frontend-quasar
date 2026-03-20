<script setup lang="ts">
import { ref, computed, watchEffect, markRaw, nextTick, type Component } from 'vue';
import { defineAsyncComponent } from 'vue';
import { useQuasar } from 'quasar';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@stores/auth-store';
import { useMapMenuStore } from '@stores/map/map-menu-store';
import { useMapContentStore } from '@stores/map/map-content-store';
import { useUserSettingsStore } from '@stores/user-settings-store';
import { useLocalPropertiesStore } from '@stores/local-properties-store';
import { useSyncedPropertiesStore } from '@stores/synced-properties-store';
import { useMeta } from 'quasar';
import WodoreLogo from 'components/wodore/WodoreLogo.vue';
import WdPlaceSearchMenu from 'components/search/WdPlaceSearchMenu.vue';
import WdPlaceSearchDialog from 'components/search/WdPlaceSearchDialog.vue';
import WdBottomSheet from '@components/utils/WdBottomSheet.vue';

// Initialize stores
const authStore = useAuthStore();
const menuStore = useMapMenuStore();
const contentStore = useMapContentStore();

// Initialize stores (this will create localStorage keys on first load)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const userSettingsStore = useUserSettingsStore();
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const localPropertiesStore = useLocalPropertiesStore();
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const syncedPropertiesStore = useSyncedPropertiesStore();

const $q = useQuasar();
const route = useRoute();
const router = useRouter();

const isMobile = computed(() => $q.screen.lt.md);

// Menu drawer state
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

const showDialog = ref(false);

// Track whether we should navigate when dialog closes
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

  if (fromDialog && !toDialog) {
    shouldNavigateOnHide = false;
  }

  next();
});

// Handle dialog close via backdrop click, ESC key, or close button
function onDialogHide() {
  if (!shouldNavigateOnHide) {
    return;
  }

  shouldNavigateOnHide = false;

  if (window.history.state.back) {
    router.back();
  } else {
    router.push({ name: 'map' });
  }
}

// Watch for dialog state changes
watchEffect(() => {
  if (showDialog.value) {
    nextTick(() => {
      shouldNavigateOnHide = true;
    });
  }
});

// Content drawer state (synced with store)
const contentDrawerOpen = computed({
  get: () => contentStore.contentOpen,
  set: val => {
    if (!val) {
      contentStore.close();
    }
  },
});

// Static component map with markRaw (prevents re-evaluation)
const componentMap: Record<string, { title: Component; content: Component; actions: Component }> = {
  place: {
    title: markRaw(
      defineAsyncComponent(() => import('@/components/content/place/WdPlaceTitle.vue'))
    ),
    content: markRaw(
      defineAsyncComponent(() => import('@/components/content/place/WdPlaceContent.vue'))
    ),
    actions: markRaw(
      defineAsyncComponent(() => import('@/components/content/place/WdPlaceActions.vue'))
    ),
  },
};

// Computed selects from static map
const contentTitleComponent = computed(() => {
  const type = contentStore.contentType;
  if (!type || !componentMap[type]) return null;
  return componentMap[type].title ?? null;
});

const contentActionsComponent = computed(() => {
  const type = contentStore.contentType;
  if (!type || !componentMap[type]) return null;
  return componentMap[type].actions ?? null;
});

function closeContent() {
  contentStore.close();
}

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

// Critical CSS for nested QLayout in container mode (inside drawer)
// Without this, the layout wrappers collapse to 0 height
.q-layout-container > div > div {
  min-height: 0;
  max-height: 100%;
  height: 100%;
}

.q-layout-container .q-layout {
  min-height: 100%;
  height: 100%;
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
      </router-view>
    </q-page-container>

    <!-- Content Drawer (Desktop) -->
    <q-drawer
      v-if="!isMobile"
      v-model="contentDrawerOpen"
      side="right"
      :width="$q.screen.gt.md ? 460 : 380"
      :breakpoint="0"
      class="shadow-2"
    >
      <q-layout
        view="lhh LpR lff"
        container
        class="no-background bg-grey-3"
        :style="`height: ${$q.screen.gt.sm ? 'calc(100% - 80px)' : '100%'}`"
      >
        <!-- Close button -->
        <div class="absolute-top z-max q-pa-sm" style="pointer-events: none">
          <q-btn
            round
            dense
            unelevated
            color="accent-100"
            icon="wd-close"
            @click="closeContent"
            class="text-primary-900"
            size="md"
            style="pointer-events: auto"
          />
        </div>

        <!-- Sticky Header (Actions + Title) -->
        <q-header class="no-background">
          <!-- Actions Toolbar (Desktop only) -->
          <component
            v-if="contentActionsComponent && $q.screen.gt.sm"
            :is="contentActionsComponent"
            :slug="contentStore.contentSlug"
          />
          <!-- Title -->
          <component
            v-if="contentTitleComponent"
            :is="contentTitleComponent"
            :slug="contentStore.contentSlug"
          />
        </q-header>

        <!-- Scrollable Content -->
        <q-page-container class="fit" style="height: 100%">
          <q-scroll-area
            visible
            :thumb-style="{
              width: '6px',
              backgroundColor: '#998019',
              opacity: '0.5',
              borderRadius: '8px 0 0 8px',
            }"
            style="height: 100%"
            class="fit"
          >
            <q-page class="q-px-md">
              <router-view name="content" v-slot="{ Component, route: contentRoute }">
                <transition name="fade" mode="out-in">
                  <component :is="Component" :key="contentRoute.path" />
                </transition>
              </router-view>
            </q-page>
          </q-scroll-area>
        </q-page-container>

        <!-- Footer (Actions for smaller desktop screens) -->
        <q-footer v-if="contentActionsComponent && !$q.screen.gt.sm" class="footer-toolbar">
          <component :is="contentActionsComponent" :slug="contentStore.contentSlug" />
        </q-footer>
      </q-layout>
    </q-drawer>
  </q-layout>

  <!-- Mobile Bottom Sheet (OUTSIDE QLayout, only on mobile) -->
  <WdBottomSheet v-if="isMobile" v-model="contentDrawerOpen" @close="closeContent">
    <!-- Close button (top-right corner) -->
    <div class="absolute" style="top: 10px; right: 10px; z-index: 1000">
      <q-btn round dense flat icon="wd-close" @click="closeContent" class="text-grey-7" size="md" />
    </div>

    <!-- Header slot -->
    <template #header>
      <div class="q-px-md q-pt-sm q-pb-xs" style="padding-right: 50px">
        <component
          v-if="contentTitleComponent"
          :is="contentTitleComponent"
          :slug="contentStore.contentSlug"
        />
      </div>
    </template>

    <!-- Content (native scroll) -->
    <div class="q-px-md">
      <router-view name="content" v-slot="{ Component, route: contentRoute }">
        <transition name="fade" mode="out-in">
          <component :is="Component" :key="contentRoute.path" />
        </transition>
      </router-view>
    </div>

    <!-- Footer slot -->
    <template #footer>
      <component
        v-if="contentActionsComponent"
        :is="contentActionsComponent"
        :slug="contentStore.contentSlug"
      />
    </template>
  </WdBottomSheet>
</template>
