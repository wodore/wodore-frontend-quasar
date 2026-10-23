<script setup lang="ts">
/**
 * Root — global singleton components live here:
 * - WdConfirmPopover: pointer-anchored confirm dialogs (useConfirmPopover)
 */
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import WdConfirmPopover from '@components/quasar/WdConfirmPopover.vue';

defineOptions({
  name: 'App',
});

// Hand over from the static boot shell (index.html): fade it out and
// drop it once the Vue app owns the screen. Client-safe in every mode
// by construction — onMounted never runs on the SSR server, so an
// SSR-served shell is removed after hydration in the browser, and a
// missing shell (already removed, HMR remount) is a no-op.
const router = useRouter();

onMounted(() => {
  const shell = document.getElementById('wd-boot-shell');
  // Drop the pre-paint theme attribute together with the shell — the
  // app's theme boot (body--dark/body--light) owns theming from here.
  document.documentElement.removeAttribute('data-wd-shell');
  if (!shell) return;
  // Hand over only when the initial ROUTE has rendered its own
  // placeholder — removing the shell at App-mount alone showed a bare
  // green frame while the async route chunk was still loading (the
  // splash did not exist yet to take over). router.isReady() resolves
  // after the first navigation has completed and painted.
  void router.isReady().then(() => {
    shell.classList.add('wd-boot-shell--out');
    window.setTimeout(() => shell.remove(), 300);
  });
});
</script>

<template>
  <router-view />
  <WdConfirmPopover />
</template>
