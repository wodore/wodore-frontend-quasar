<script lang="ts" setup>
import { useAuthService } from 'src/composables/useAuthService';
//import { useRouter } from 'vue-router';

const $auth = useAuthService();
//const router = useRouter();

const authenticateOidc = () => {
  //try {
  $auth
    .signinCallback()
    .then(() => {
      //console.log('User authenticated', user)
      //authStore.setUpUserCredentials(user)
      //router.go(-1);
      //router.push('/');
    })
    .catch((error) => {
      console.log(error);
    });
  //await services.$auth.signInCallback()
  //} catch (error) {
  //}
};

authenticateOidc();
// await authenticateOidc()
</script>

<template>
  <q-page class="row items-center justify-evenly">
    <h5>Authenticate...</h5>
  </q-page>
</template>
