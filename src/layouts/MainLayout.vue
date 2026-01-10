<script setup lang="ts">
import { ref, computed, watchEffect } from 'vue';
import { useQuasar } from 'quasar';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@stores/auth-store';
import { useMeta } from 'quasar';
import WodoreLogo from 'components/wodore/WodoreLogo.vue';
import WdPlaceSearch from 'components/search/WdPlaceSearch.vue';

const authStore = useAuthStore();
//import { useRouter } from 'vue-router';

//const router = useRouter();
const $q = useQuasar();

const isMobile = computed(() => {
  return $q.screen.xs;
});
const menuDrawerOpen = ref(false);
const contentDrawerOpen = ref(true);

const showDialog = ref(false);

const route = useRoute();
const router = useRouter();
// check if route.meta.dialog is set
watchEffect(() => {
  showDialog.value = route.meta?.dialog as boolean;
});
watchEffect(() => {
  contentDrawerOpen.value = route.meta?.content as boolean;
});
const metaData = {
  title: 'Wodore',
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
</style>
<template>
  <WdAnalytics />
  <q-layout view="hHh LpR fFf" class="overflow-hidden">
    <q-header class="text-white shadow-6 app-header">
      <!-- TOOLBAR -->
      <q-toolbar>
        <WdMenuButton desktop v-model="menuDrawerOpen" />
        <q-toolbar-title>
          <WodoreLogo class="text-h4" :text="!isMobile" icon />
        </q-toolbar-title>
        <WdPlaceSearch />
        <WdSelectDate />
        <WdSupportButton
          v-if="!authStore.isLoggedIn"
          class="text-secondary-700"
        />
        <WdFeedbackButton v-if="!isMobile" />

        <WdUser v-if="authStore.isLoggedIn" />

        <!-- MAIN DIALOG -->
        <q-dialog
          v-model="showDialog"
          no-backdrop-dismiss
          persistent
          :maximized="isMobile"
          backdrop-filter="blur(3px) saturate(180%) grayscale(60%)"
          class="dialog-radius"
        >
          <router-view name="dialog" v-slot="{ Component, route }">
            <!-- <transition name="fade" mode="out-in"> -->
            <component :is="Component" :key="route.path" />
            <!-- </transition> -->
          </router-view>
        </q-dialog>

        <!-- MENU BUTTON mobile open -->
        <WdMenuButton
          mobile
          function="open"
          side="right"
          v-model="menuDrawerOpen"
        />
      </q-toolbar>
    </q-header>

    <!-- MENU -->
    <q-drawer
      v-model="menuDrawerOpen"
      :side="isMobile ? 'right' : 'left'"
      :width="200"
      :breakpoint="610"
      class="shadow-2"
    >
      <!-- TOOLBAR mobile -->
      <q-toolbar v-if="isMobile" class="bg-primary-600">
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
