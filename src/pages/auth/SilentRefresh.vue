<script lang="ts" setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthService } from 'src/composables/useAuthService';

const $auth = useAuthService();
const router = useRouter();

const error = ref<string | null>(null);

$auth
  .renewToken()
  .then(() => {
    console.debug('[silent-refresh] Token renewed');
  })
  .catch(err => {
    console.warn('[silent-refresh] Token renewal failed:', err);
    error.value = 'Die Sitzung konnte nicht aktualisiert werden.';
  });

function backToLogin() {
  router.push({ name: 'login' });
}
</script>

<template>
  <q-page class="row items-center justify-evenly">
    <h5 v-if="!error">Refresh...</h5>
    <div v-else class="column items-center q-gutter-md">
      <h5 class="text-negative q-mb-none">Aktualisierung fehlgeschlagen</h5>
      <p class="text-grey-7 q-mt-none">{{ error }}</p>
      <q-btn color="primary" label="Neu anmelden" unelevated @click="backToLogin" />
    </div>
  </q-page>
</template>
