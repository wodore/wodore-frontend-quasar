import { boot } from 'quasar/wrappers';
import { setPwaUpdateCallback } from 'src-pwa/register-service-worker';
import { usePwaUpdate } from 'src/composables/usePwaUpdate';

export default boot(() => {
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
      console.log('Service worker controller changed - new version active');
    });
  }
});
