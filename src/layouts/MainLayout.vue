<script setup lang="ts">
import {
  ref,
  computed,
  watch,
  watchEffect,
  markRaw,
  nextTick,
  onMounted,
  type Component,
} from 'vue';
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
import { i18n } from '@services/locale';
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

// Mobile bottom sheet ref (for programmatic snap control)
const bottomSheetRef = ref<InstanceType<typeof WdBottomSheet> | null>(null);

// Desktop drawer: shadow the header once the content is scrolled
const drawerContentScrolled = ref(false);

interface DrawerScrollInfo {
  verticalPosition?: number;
}

function onDrawerScroll(info: DrawerScrollInfo): void {
  drawerContentScrolled.value = (info.verticalPosition ?? 0) > 2;
}

// When new content is opened while the sheet is already showing (e.g. another
// hut is clicked on the map), keep the sheet at its current snap position and
// only reset the content scroll so the new content starts at the top. Fresh
// opens (sheet was entirely closed) naturally start at the initial snap point.
// On desktop the ref is null (sheet not rendered), making this a no-op.
watch(
  () => contentStore.contentSlug ?? contentStore.contentId,
  () => {
    if (contentStore.contentOpen) {
      bottomSheetRef.value?.onContentChanged();
    }
  }
);

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
const officialUrl = process.env.WODORE_OFFICIAL_URL || '';
const isStaging = computed(() => appEnv === 'staging');
const isNotProduction = computed(() => appEnv !== 'production');
const metaData = {
  title: appTitle,
  meta: {
    description: {
      name: 'description',
      content: i18n.global.t('meta.description'),
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

onMounted(() => {
  if (isNotProduction.value && officialUrl && !process.env.DEV) {
    $q.notify({
      type: 'warning',
      color: 'negative-800',
      textColor: 'white',
      message: `This is a ${appEnv} environment.`,
      html: true,
      caption: `<a href="${officialUrl}" target="_blank" rel="noopener" style="color: inherit; text-decoration: underline">Goto production version.</a>`,
      timeout: 10000,
      progress: true,
      position: 'bottom',
      actions: [{ icon: 'wd-close', color: 'white', dense: true, round: true }],
    });
  }
});
</script>
<style lang="scss">
.wd-surface {
  background: var(--wd-surface) !important;
}
.wd-ink-soft-text {
  color: var(--wd-ink-soft) !important;
}
.app-header {
  backdrop-filter: blur(10px);
  // Night (default here): pine bar, paper text. Day gets the lighter bar
  // via the body--light override below.
  color: $white;
  background-color: rgba(17, 33, 25, 0.88) !important;
}

// Day: the incumbent wodore.com sage-pine toolbar (dark-200, lighter than
// Night's pine) with cream text and white-pill buttons.
body.body--light .app-header {
  color: #f2f7f4;
  background-color: rgba(49, 94, 71, 0.92) !important;
  border-bottom: 1px solid rgba(10, 20, 15, 0.25);
}

// Header buttons: flat icon chrome in BOTH themes (user rule: no icon
// bg) — cream icons on the Day sage bar, ice icons on the Night pine bar.
// The date field keeps its light chip (it is a field, not an icon).
.app-header .q-btn {
  background: transparent !important;
  border-width: 0 !important;
  box-shadow: none !important;
}

.app-header .q-btn:hover {
  background: rgba(255, 255, 255, 0.1) !important;
}

body.body--light .app-header .q-btn .q-icon,
body.body--light .app-header .q-btn .text-icon,
body.body--light .app-header .q-btn.text-icon,
body.body--light .app-header button.text-icon {
  color: #f2f7f4 !important;
  background: transparent !important;
}
// Quasar draws button fills on ::before - kill it in the header
.app-header .q-btn::before {
  background: transparent !important;
  box-shadow: none !important;
}

// Wordmark "wo": theme ink on surfaces; cream on the header bars (both
// themes use green bars where dark ink would vanish)
.wd-wordmark-wo {
  color: var(--wd-ink);
}

.app-header .wd-wordmark-wo,
.app-header .text-black {
  color: #f2f7f4 !important;
}

body.body--light .app-header .text-black {
  color: #f2f7f4 !important;
}

body.body--dark .app-header .q-btn .q-icon,
body.body--dark .app-header .q-btn.text-icon,
body.body--dark .app-header .text-icon {
  color: #a9f0d2 !important;
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
    color('accent', 900),
    color('accent', 900) 6px,
    color('accent', 800) 6px,
    color('accent', 800) 12px
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

// Prevent wide content (e.g. Swiper sliders) from pushing the
// content drawer wider than its configured :width prop.
//
// Quasar's QDrawer sets inline width but no max-width or overflow.
// Wide children with large intrinsic min-width can push the aside
// element wider. These rules enforce containment on the drawer itself
// and its content wrapper.
// The content drawer's user classes (content-drawer) land on Quasar's inner
// .q-drawer__content div (NOT the aside) - target that element.
.q-drawer__content.content-drawer {
  overflow: hidden !important;
  background: var(--wd-surface);
  color: var(--wd-ink);

  // Drawer header elevation: drop shadow once the content is scrolled
  // (mirrors the mobile sheet header shadow). The header area is backed by
  // the layout's grey background, so the shadow reads cleanly.
  .q-header {
    transition: box-shadow 0.2s ease;
  }

  .q-header.content-drawer-header-scrolled {
    box-shadow: 0 4px 10px -4px rgba(0, 0, 0, 0.35);
  }
}
</style>
<template>
  <WdAnalytics />
  <q-layout view="hHh LpR fFf" class="overflow-hidden">
    <div v-if="isStaging" class="preview-badge">preview</div>
    <q-header class="app-header" bordered>
      <!-- TOOLBAR -->
      <q-toolbar>
        <WdMenuButton desktop v-model="menuDrawerOpen" />
        <q-toolbar-title>
          <WodoreLogo
            class="text-h4"
            :text="!isMobile"
            icon
            :text-color-left="$q.dark.isActive ? 'white' : 'black'"
          />
        </q-toolbar-title>
        <WdPlaceSearchMenu v-if="!isMobile" />
        <WdSelectDate />
        <WdPlaceSearchDialog v-if="isMobile" />
        <WdSupportButton v-if="!authStore.isLoggedIn && !isMobile" class="wd-info-text" />
        <WdFeedbackButton v-if="!isMobile" />
        <WdLanguageSwitcher v-if="!isMobile" />
        <WdThemeSwitcher v-if="!isMobile" />

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
          <WodoreLogo
            text
            class="text-h5"
            :text-color-left="$q.dark.isActive ? 'white' : 'black'"
          />
        </q-toolbar-title>

        <WdLanguageSwitcher size="md" />
        <WdThemeSwitcher size="md" />
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
      class="shadow-2 content-drawer"
    >
      <q-layout
        view="lhh LpR lff"
        container
        class="no-background wd-surface overflow-hidden"
        style="height: 100%"
      >
        <!-- Close button -->
        <div class="absolute-top z-max q-pa-sm" style="pointer-events: none">
          <q-btn
            round
            dense
            unelevated
            icon="wd-close"
            @click="closeContent"
            class="wd-close-btn"
            size="md"
            style="pointer-events: auto"
          />
        </div>

        <!-- Sticky Header (Actions + Title) -->
        <q-header
          class="no-background"
          :class="{ 'content-drawer-header-scrolled': drawerContentScrolled }"
          style="background: none !important"
        >
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
            @scroll="onDrawerScroll"
            :thumb-style="{
              width: '6px',
              backgroundColor: '#998019',
              opacity: '0.5',
              borderRadius: '8px 0 0 8px',
            }"
            class="fit"
          >
            <q-page
              class="q-px-md"
              :style="{ height: '100%', maxWidth: ($q.screen.gt.md ? 460 : 380) + 'px' }"
            >
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
  <WdBottomSheet
    v-if="isMobile"
    ref="bottomSheetRef"
    v-model="contentDrawerOpen"
    @close="closeContent"
  >
    <!-- Close button (top-right corner) -->
    <div class="absolute" style="top: 10px; right: 10px; z-index: 1000">
      <q-btn
        round
        dense
        flat
        icon="wd-close"
        @click="closeContent"
        class="wd-ink-soft-text"
        size="md"
      />
    </div>

    <!-- Header slot -->
    <template #header>
      <div class="sheet-header-row q-px-md q-pt-sm q-pb-xs" style="padding-right: 50px">
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
