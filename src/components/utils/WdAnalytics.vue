<script setup lang="ts">
import { onMounted } from 'vue';

onMounted(() => {
  if (process.env.UMAMI_WEBSITE_ID) {
    const script = document.createElement('script');
    script.async = true;
    script.defer = true;
    script.dataset.websiteId = process.env.UMAMI_WEBSITE_ID;
    let url: string;
    if (process.env.PROD && process.env.DOMAIN) {
      url = `https://${process.env.DOMAIN}`;
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
