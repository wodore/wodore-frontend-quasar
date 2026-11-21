import { whenIdle } from '@services/idle';
import { defineBoot } from '#q-app';
import { setPwaUpdateCallback } from 'src-pwa/register-sw';
import { usePwaUpdate } from 'src/composables/usePwaUpdate';

export default defineBoot(() => {
  // Update-check registration is never boot-critical (perf/boot-parallel).
  return whenIdle(() => {
    // Set up the PWA update callback when the app is ready
    setPwaUpdateCallback(() => {
      // This callback is triggered when a new service worker is waiting
      // We need to use the composable to show the notification
      const { showUpdateNotification } = usePwaUpdate();

      showUpdateNotification(() => {
        // Reload the page once after the user clicks "Update now"
        window.location.reload();
      });
    });

    // Optional: Listen for service worker controller changes
    // This happens when a new service worker activates
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        // The new service worker has taken control
        // We can reload if needed, but the user already clicked reload
        // so this is just for cleanup or logging
        console.debug('Service worker controller changed - new version active');
      });
    }
  });
});
