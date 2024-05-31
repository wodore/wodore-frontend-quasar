<script setup lang="ts">
import { useRouter } from 'vue-router';
const router = useRouter();
function toFeedback() {
  router.push({ name: 'feedback' });
}
</script>
<style lang="scss" scoped>
.content {
  background-image: repeating-linear-gradient(
    -45deg,
    color('negative', 900),
    color('negative', 900) 10px,
    color('negative', 800) 10px,
    color('negative', 800) 20px
  );
  padding-top: 3px;
  padding-bottom: 4px;
}
a:active,
a:visited,
a:hover,
a:link,
a {
  color: color('accent');
  text-decoration: underline dotted;
  text-decoration-color: color('accent');
  cursor: pointer;
  font-weight: 600;
}
a:hover {
  color: color('accent', 100);
}
</style>
<template>
  <div class="content text-primary-100 shadow-8 text-caption text-center">
    <q-icon
      size="15px"
      name="img:/logos/logo_beta.svg"
      style="
        padding-left: 10px;
        transform: scale(3) translateY(-2.5px) translateX(-6px);
      "
    />
    Die Seite ist noch im Aufbau,
    <a class="link" @click="toFeedback">Feedback</a> ist willkommen!
    <IconNotoHandshake
      style="
        padding-right: 10px;
        transform: scale(6) translateY(-0.7px) translateX(7px) rotate(-10deg);
      "
    />
  </div>
</template>
