<script lang="ts" setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthService } from 'src/composables/useAuthService';

const $auth = useAuthService();
const router = useRouter();

const error = ref<string | null>(null);

$auth
  .signinCallback()
  .then(() => {
    // Success - the auth store reacts to the new session and routing continues
  })
  .catch(err => {
    console.warn('[signin-callback] Authentication failed:', err);
    error.value = 'Die Anmeldung konnte nicht abgeschlossen werden.';
  });

function backToLogin() {
  router.push({ name: 'login' });
}
</script>

<template>
  <q-page class="row items-center justify-evenly">
    <h5 v-if="!error">Authenticate...</h5>
    <div v-else class="column items-center q-gutter-md">
      <h5 class="text-negative q-mb-none">Anmeldung fehlgeschlagen</h5>
      <p class="text-grey-7 q-mt-none">{{ error }}</p>
      <q-btn color="primary" label="Zum Login" unelevated @click="backToLogin" />
    </div>
  </q-page>
</template>
