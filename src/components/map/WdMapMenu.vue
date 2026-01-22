<script setup lang="ts">
import { useAuthService } from 'src/composables/useAuthService';
import { useAuthStore } from '@stores/auth-store';
import { LocalStorage } from 'quasar';
import { ref, watchEffect } from 'vue';
import AuthService from 'src/services/auth';
import WdVersionsPanel from 'src/components/version/WdVersionsPanel.vue';

const authStore = useAuthStore();
let $auth: AuthService | undefined = undefined;
if (process.env.CLIENT) {
  $auth = useAuthService();
}

const tracking = ref<boolean>(
  LocalStorage.hasItem('umami.disabled')
    ? !(LocalStorage.getItem('umami.disabled') as boolean)
    : true,
);

watchEffect(() => {
  if (!tracking.value) {
    LocalStorage.set('umami.disabled', !tracking.value);
  } else {
    LocalStorage.removeItem('umami.disabled');
  }
});
</script>
<style scoped>
.drawer-desktop {
  position: absolute;
  bottom: 80px;
  top: 0;
  left: 0;
  right: 0;
  height: calc(100vh - 40px)
}

.drawer-mobile {
  position: absolute;
  top: 50px;
  left: 4px;
  right: 0;
  height: calc(100vh - 60px)
}

.map-menu__versions {
  background: rgba(255, 255, 255, 0.2);
  /* border-radius: 0px; */
}
</style>

<template>
  <div :class="{
    'drawer-desktop': $q.screen.gt.xs,
    'drawer-mobile': $q.screen.xs,
  }">
    <div class="text-center q-pa-xl">
      <q-icon size="80px">
        <IconNotoV1Construction />
      </q-icon>
    </div>
    <div class="bg-transparent absolute-bottom">
      <div class="q-pa-xs column q-gutter-sm">
        <q-btn v-if="!authStore.isLoggedIn" color="secondary-700" unelevated flat @click="$auth?.signinRedirect()"
          label="Login" style="opacity: 0.8" />
        <q-btn v-else color="accent-700" unelevated flat @click="$auth?.logout()" label="Logout" style="opacity: 0.8" />
      </div>
      <!-- </div> -->
      <!-- <div class="q-pa-sm"> -->
      <div class="">
        <!-- Privacy Policy Link -->
        <div v-if="authStore.isEditor()" class="text-center q-mb-sm">
          <router-link :to="{ name: 'data-policy' }" target="_blank" class="text-secondary-700">
            Datenschutz
          </router-link>
        </div>

        <!-- Version Information -->
        <WdVersionsPanel class="map-menu__versions" />
      </div>
    </div>
    <!-- <q-list bordered padding class="rounded-borders text-primary">
    <q-item
      clickable
      v-ripple
      :active="link === 'inbox'"
      @click="link = 'inbox'"
      :active-class="active_classes"
    >
      <q-item-section avatar>
        <q-icon name="eva-inbox" />
      </q-item-section>

      <q-item-section>Inbox</q-item-section>
    </q-item>

  </q-list> -->
  </div>
</template>
