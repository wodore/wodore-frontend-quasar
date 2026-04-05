<script setup lang="ts">
import { reactive, defineOptions } from 'vue';
import WdPlaceTitle from '@components/content/place/WdPlaceTitle.vue';

defineOptions({
  name: 'WdPlaceTitleLiveStory',
});

const slugs = reactive({
  0: 'aarbiwak',
  1: 'britannia',
  2: 'monte-rosa',
  3: 'arben',
  4: 'alp-de-fora',
  5: 'baita-valmaggia',
});
</script>

<template>
  <Story
    title="Content/WdPlaceTitle (Live)"
    :layout="{ type: 'grid', width: '100%' }"
    auto-props-disabled
  >
    <template #controls>
      <HstText
        v-for="(_, i) in slugs"
        :key="i"
        v-model="slugs[i]"
        :title="`Slug ${Number(i) + 1}`"
      />
    </template>

    <Variant v-for="(_, i) in slugs" :key="i" :title="slugs[i]">
      <WdPlaceTitle :slug="slugs[i]" />
    </Variant>
  </Story>
</template>
