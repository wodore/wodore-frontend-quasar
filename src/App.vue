<script setup lang="ts">
defineOptions({
  name: 'App',
});
import { useMeta } from 'quasar';
const metaData = {
  // sets document title
  title: 'Wodore',
  // optional; sets final title as "Index Page - My Website", useful for multiple level meta
  //titleTemplate: title => `${title} - My Website`,

  // meta tags
  meta: {
    description: {
      name: 'description',
      content: 'Wohin gipfelt deine nächste Tour?',
    },
    //// note: for Open Graph type metadata you will need to use SSR, to ensure page is rendered by the server
    //ogTitle:  {
    //  property: 'og:title',
    //  // optional; similar to titleTemplate, but allows templating with other meta properties
    //  template (ogTitle) {
    //    return `${ogTitle} - My Website`
    //  }
    //}
  },

  //// JS tags
  //script: {
  //  ldJson: {
  //    type: 'application/ld+json',
  //    innerHTML: `{ "@context": "http://schema.org" }`
  //  }
  //},
};
useMeta(metaData);
</script>

<template>
  <router-view />
</template>
