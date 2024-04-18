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
            v-if="!isMobile"
            height="45"
            src="/logos/wodore_desktop.png"
            alt="Wodore"
          />
          <img v-else height="30" src="/logos/wodore_mobile.png" alt="Wodore" />
        </q-toolbar-title>
      </q-toolbar>
    </q-header>

    <!-- MENU -->
    <q-drawer
      v-model="menuDrawerOpen"
      bordered
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
