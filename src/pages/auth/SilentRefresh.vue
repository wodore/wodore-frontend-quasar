<script lang="ts" setup>
import { useAuthService } from 'src/composables/useAuthService';
//import { useRouter } from 'vue-router';

const $auth = useAuthService();
//const router = useRouter()

//import { useAuth } from '../stores/auth-store';
//const authStore = useAuth();
const silentRefreshOidc = () => {
  $auth
    .renewToken()
    .then((user) => {
      //authStore.setUpUserCredentials(user)
      console.log('Silent refresh', user);
      //router.push('/map')
    })
    .catch((error) => {
      console.log(error);
    });
};

silentRefreshOidc();
</script>

<template>
  <h3>Refresh...</h3>
</template>
