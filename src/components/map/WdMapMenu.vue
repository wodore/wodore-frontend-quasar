<script setup lang="ts">
import { useAuthService } from 'src/composables/useAuthService';
import { useAuthStore } from '@stores/auth-store';
import { LocalStorage } from 'quasar';
import { ref, watchEffect } from 'vue';
import AuthService from 'src/services/auth';

const authStore = useAuthStore();
let $auth: AuthService | undefined = undefined;
if (process.env.CLIENT) {
  $auth = useAuthService();
}
//import { ref } from 'vue';
//const link = ref('outbox');
//const active_classes = 'bg-accent text-white';
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
const VERSION = process.env.WODORE_APP_VERSION;
const GIT_HASH = process.env.WODORE_GIT_HASH;
</script>
<style scoped>
.drawer-desktop {
  position: absolute;
  bottom: 80px;
  top: 0;
  left: 0;
  right: 0;
}
.drawer-mobile {
  position: absolute;
  bottom: 80px;
  top: 50px;
  left: 0;
  right: 0;
}
</style>

<template>
  <div
    :class="{
      'drawer-desktop': $q.screen.gt.xs,
      'drawer-mobile': $q.screen.xs,
    }"
  >
    <div class="text-center q-pa-xl">
      <q-icon size="80px">
        <IconNotoV1Construction />
      </q-icon>
    </div>
    <!-- <div class="bg-transparent fixed-bottom"> -->
    <div class="bg-transparent absolute-bottom">
      <div class="q-pa-xs column q-gutter-sm">
        <q-btn
          v-if="!authStore.isLoggedIn"
          color="secondary-700"
          unelevated
          flat
          @click="$auth?.signinRedirect()"
          label="Login"
          style="opacity: 0.8"
        />
        <q-btn
          v-else
          color="accent-700"
          unelevated
          flat
          @click="$auth?.logout()"
          label="Logout"
          style="opacity: 0.8"
        />
      </div>
      <!-- </div> -->
      <div class="text-secondary-600 text-caption q-ma-xs q-ml-md text-center">
        <span v-if="authStore.isEditor()">
          <router-link :to="{ name: 'data-policy' }" target="_blank"
            >Datenschutz</router-link
          >
          |
        </span>
        <b>v{{ VERSION }}</b
        >-{{ GIT_HASH }}
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
