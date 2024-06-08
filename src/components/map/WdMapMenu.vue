<script setup lang="ts">
import { useAuthService } from 'src/composables/useAuthService';
import { useAuthStore } from '@stores/auth-store';
import { LocalStorage } from 'quasar';
import { ref, watchEffect } from 'vue';

const authStore = useAuthStore();
const $auth = useAuthService();
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
</script>

<template>
  <div class="bg-transparent absolute-bottom">
    <div class="q-pa-md column q-gutter-sm">
      <q-btn
        v-if="!authStore.isLoggedIn"
        color="secondary-700"
        unelevated
        flat
        @click="$auth.signinRedirect()"
        label="Login"
        style="opacity: 0.8"
      />
      <q-btn
        v-else
        color="accent-700"
        unelevated
        flat
        @click="$auth.logout()"
        label="Logout"
        style="opacity: 0.8"
      />
    </div>
  </div>
  <div class="text-center q-pa-xl">
    <q-icon size="80px">
      <IconNotoV1Construction />
    </q-icon>
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
</template>
