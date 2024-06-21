<script setup lang="ts">
import TextClamp from 'vue3-text-clamp';
//const { t } = i18n.useI18n();
// const expanded = true;
// const toggle = () => {};
// const clamped = false;
</script>
<style scoped></style>
<template>
  <text-clamp>
    <template #after="{ toggle, expanded, clamped }">
      <p
        style="text-decoration: underline dotted"
        class="text-grey-6 cursor-pointer"
        v-show="clamped"
        @click="toggle"
      >
        {{ $t('more') }}
      </p>
      <p
        style="text-decoration: underline dotted"
        class="text-grey-6 cursor-pointer"
        v-show="expanded"
        @click="toggle"
      >
        {{ $t('less') }}
      </p>
    </template>
  </text-clamp>
</template>
