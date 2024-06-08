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
  <div class="bg-transparent">
    <div class="q-pa-md column q-gutter-sm" v-if="!authStore.isLoggedIn">
      <q-btn
        color="accent-700"
        unelevated
        @click="$auth.signinRedirect()"
        label="Login"
        style="opacity: 0.8"
      />
    </div>
    <div class="q-pa-md column q-gutter-sm" v-if="authStore.isLoggedIn">
      <q-btn
        color="accent-700"
        unelevated
        @click="$auth.logout()"
        label="Logout"
        style="opacity: 0.8"
      />
    </div>
    <div v-if="authStore.isLoggedIn">
      <div class="row inline">
        <q-avatar size="56px" class="q-mb-sm q-mr-md">
          <img :src="authStore.avatar" />
        </q-avatar>
        <div class="text-weight-bold text-accent text-subtitle1 self-center">
          {{ authStore.profile?.name }}
        </div>
        <!-- <div class="text-secondary text-caption">{{  authStore.profile?.email }}</div> -->
      </div>
      <div v-if="authStore.hasRole('admin', true)">
        <q-toggle v-model="tracking" label="Tracking" />
      </div>
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
