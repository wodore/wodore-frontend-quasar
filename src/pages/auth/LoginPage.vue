<script lang="ts" setup>
import { useAuthService } from 'src/composables/useAuthService';
//import { useRouter } from 'vue-router';
//const router = useRouter();

const $auth = useAuthService();

const login = function () {
  $auth.signinRedirect();
};
</script>

<template>
  <div
    class="window-height bg-primary text-white text-center q-pa-md flex flex-center"
  >
    <div>
      <a>
        <q-icon size="13vh" name="img:/logos/wodore_original.svg" />
      </a>
      <div>
        <q-btn
          class="q-mt-xl"
          color="accent"
          text-color="accent"
          size="xl"
          @click="login"
          label="Login"
          flat
        />
      </div>
    </div>
  </div>
  <!-- <q-page class="row items-center justify-evenly">
  </q-page> -->
</template>
