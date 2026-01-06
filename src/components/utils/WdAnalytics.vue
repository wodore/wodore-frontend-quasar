<script setup lang="ts">
import { onMounted } from 'vue';

onMounted(() => {
  if (process.env.WODORE_UMAMI_WEBSITE_ID) {
    const script = document.createElement('script');
    script.async = true;
    script.defer = true;
    script.dataset.websiteId = process.env.WODORE_UMAMI_WEBSITE_ID;
    script.dataset.excludeHash = 'true';
    let url: string;
    if (process.env.PROD && process.env.WODORE_UMAMI_WEBSITE_URL) {
      url = `${process.env.WODORE_UMAMI_WEBSITE_URL}`;
    } else {
      url = 'http://localhost:3009';
    }
    script.src = `${url}/script.js`;
    document.head.appendChild(script);
  }
});
</script>
<template>
  <div></div>
</template>
