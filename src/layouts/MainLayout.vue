<script setup lang="ts">
import { ref, computed, watchEffect } from 'vue';
import { useQuasar } from 'quasar';
import { useRoute } from 'vue-router';
//import FeedbackForm from 'components/feedback/FeedbackForm.vue';
import FeedbackButton from 'components/feedback/FeedbackButton.vue';
import MenuButton from 'components/toolbar/MenuButton.vue';
import WodoreLogo from 'components/wodore/WodoreLogo.vue';

const $q = useQuasar();
function ajaxFilter(url: string) {
  //return !/^.*transport\/stations\/by_name/.test(url);
  return !/^.*timetable.search.ch.*/.test(url);
}

const isMobile = computed(() => {
  return $q.screen.xs;
});

const menuDrawerOpen = ref(false);
const contentDrawerOpen = ref(true);

const showDialog = ref(false);

const route = useRoute();
// check if route.meta.dialog is set
watchEffect(() => {
  showDialog.value = route.meta?.dialog as boolean;
});
watchEffect(() => {
  contentDrawerOpen.value = route.meta?.content as boolean;
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
</style>
<template>
  <q-layout view="hHh LpR fFf">
    <q-ajax-bar color="accent" :hijack-filter="ajaxFilter" />
    <q-header class="text-white shadow-6 app-header">
      <!-- TOOLBAR -->
      <q-toolbar>
        <MenuButton desktop v-model="menuDrawerOpen" />
        <q-toolbar-title>
          <WodoreLogo class="text-h4" :text="!isMobile" icon />
        </q-toolbar-title>
        <FeedbackButton v-if="!isMobile" />
        <!-- MAIN DIALOG -->
        <q-dialog
          v-model="showDialog"
          no-backdrop-dismiss
          persistent
          :maximized="isMobile"
          backdrop-filter="blur(3px) saturate(180%) grayscale(60%)"
        >
          <router-view name="dialog" v-slot="{ Component }">
            <component :is="Component" />
          </router-view>
        </q-dialog>

        <!-- MENU BUTTON mobile open -->
        <MenuButton
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

        <FeedbackButton size="md" />

        <!-- MENU BUTTON mobile close -->
        <MenuButton mobile side="right" v-model="menuDrawerOpen" />
      </q-toolbar>
      <router-view name="menu" />
    </q-drawer>

    <!-- PAGE -->
    <q-page-container>
      <router-view />
    </q-page-container>
    <!-- MAP CONTENT -->
    <q-drawer
      v-model="contentDrawerOpen"
      side="right"
      :width="isMobile ? 250 : 450"
      :breakpoint="0"
      class="shadow-2"
    >
      <router-view name="content" />
    </q-drawer>
  </q-layout>
</template>
