<script setup lang="ts">
import { ref } from 'vue';
//import { Todo, Meta } from './models';
import { MglMap } from 'vue-maplibre-gl';

//interface Props {
//  title: string;
//  todos?: Todo[];
//  meta: Meta;
//  active: boolean;
//}

//const props = withDefaults(defineProps<Props>(), {
//  todos: () => [],
//});

const map = ref(null);

//@import '~maplibre-gl/dist/maplibre-gl.css';
//@import '~vue-maplibre-gl/dist/vue-maplibre-gl.css';
</script>
<style lang="scss">
@import 'node_modules/maplibre-gl/dist/maplibre-gl.css';
@import '/node_modules/vue-maplibre-gl/dist/vue-maplibre-gl.css';
</style>
<template>
  <div class="fit">
    <!-- <p>{{ title }}</p>
    <ul>
      <li v-for="todo in todos" :key="todo.id" @click="increment">
        {{ todo.id }} - {{ todo.content }}
      </li>
    </ul>
    <p>Count: {{ todoCount }} / {{ meta.totalCount }}</p>
    <p>Active: {{ active ? 'yes' : 'no' }}</p>
    <p>Clicks on todos: {{ clickCount }}</p> -->
    <mgl-map language="de" ref="map"> </mgl-map>
  </div>
</template>
