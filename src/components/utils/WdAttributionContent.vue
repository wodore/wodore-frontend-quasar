<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  content: string;
  imageId: string;
  index: number;
}

const props = defineProps<Props>();

// Unique key to force Vue to create new instances for each slide
const uniqueKey = computed(() => `${props.imageId}-${props.index}-${Date.now()}`);

// Function to sanitize and render HTML content safely
const renderContent = (content: string) => {
  if (!content) return '';

  // Basic sanitization - remove potentially harmful attributes
  // You might want to use a more robust sanitization library for production
  return content
    .replace(/on\w+="[^"]*"/g, '') // Remove event handlers
    .replace(/javascript:/gi, '') // Remove javascript: protocols
    .replace(/data:text\/html/gi, '') // Remove data:text/html
    .replace(/<\s*script[^>]*>[\s\S]*?<\/script>/gi, ''); // Remove script tags
};
</script>

<template>
  <div :key="uniqueKey" class="attribution-content" v-html="renderContent(content)" />
</template>

<style scoped>
.attribution-content {
  /* Ensure links are clickable */
  pointer-events: auto;

  /* Inherit styles from parent */
  font-size: inherit;
  color: inherit;
  line-height: inherit;
}

/* Ensure links work properly */
:deep(a) {
  pointer-events: auto;
  cursor: pointer;
}
</style>
