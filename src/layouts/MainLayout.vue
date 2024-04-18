<script setup lang="ts">
import { ref, computed } from 'vue';
import { useQuasar } from 'quasar';

const $q = useQuasar();
function ajaxFilter(url: string) {
  //return !/^.*transport\/stations\/by_name/.test(url);
  return !/^.*timetable.search.ch.*/.test(url);
}

const isMobile = computed(() => {
  return $q.screen.xs;
});
const logo_path = computed(() => {
  return '/logos/wodore_' + (isMobile.value ? 'mobile' : 'desktop') + '.svg';
});
const menuDrawerOpen = ref(false);

function toggleMenuDrawer() {
  menuDrawerOpen.value = !menuDrawerOpen.value;
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
  <q-layout view="hHh LpR fFf">
    <q-ajax-bar color="accent" :hijack-filter="ajaxFilter" />
    <q-header class="text-white shadow-6 app-header">
      <q-toolbar>
        <!-- MENU BUTTON -->
        <q-btn
          v-if="!isMobile"
          flat
          dense
          round
          :icon="menuDrawerOpen ? 'eva-menu-arrow' : 'eva-menu-outline'"
          aria-label="Menu"
          @click="toggleMenuDrawer"
        />

        <!-- TOOLBAR -->
        <q-toolbar-title>
          <img
            height="32"
            style="margin-bottom: -6px"
            :src="logo_path"
            alt="Wodore"
          />
          <!-- <q-icon name="img:/logos/wodore_desktop.svg" /> -->
        </q-toolbar-title>
        <q-btn
          v-if="isMobile"
          flat
          dense
          round
          icon="eva-menu-outline"
          aria-label="Menu"
          @click="toggleMenuDrawer"
        />
      </q-toolbar>
    </q-header>

    <!-- MENU -->
    <q-drawer
      v-model="menuDrawerOpen"
      bordered
      :side="isMobile ? 'right' : 'left'"
      :width="200"
      :breakpoint="610"
      class="shadow-2"
    >
      <router-view name="menu" />
    </q-drawer>

    <!-- PAGE -->
    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>
