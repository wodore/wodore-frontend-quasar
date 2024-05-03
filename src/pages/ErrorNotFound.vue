<script setup lang="ts">
defineOptions({
  name: 'ErrorNotFound',
});
</script>

<template>
  <div
    class="fullscreen bg-primary text-white text-center q-pa-md flex flex-center"
  >
    <div>
      <q-icon size="13vh" name="img:errors/logo_404.svg" />
      <div style="font-size: 12vh" class="text-white">404</div>
      <div class="text-h4" style="opacity: 0.4">Oops. Wrong way...</div>

      <q-btn
        class="q-mt-xl"
        color="accent"
        text-color="white"
        to="/"
        size="lg"
        label="track back"
        no-caps
      />
    </div>
  </div>
</template>
