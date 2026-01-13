import { useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';

/**
 * Composable for handling PWA update notifications
 * Provides methods to show update notifications and trigger reload
 */
export function usePwaUpdate() {
  const $q = useQuasar();
  const { t } = useI18n();

  /**
   * Shows a notification when a new PWA version is available
   * @param onReload - Callback function to execute when user clicks "Update now"
   */
  const showUpdateNotification = (onReload: () => void) => {
    // Dismiss any existing update notifications first
    $q.notify({
      type: 'info',
      message: t('pwa.update_available'),
      caption: t('pwa.update_caption'),
      timeout: 0, // Don't auto-dismiss
      position: 'top',
      actions: [
        {
          label: t('pwa.update_button'),
          color: 'white',
          handler: () => {
            // Tell the waiting service worker to skip waiting
            navigator.serviceWorker.ready.then((registration) => {
              registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
            });

            // Execute the reload callback
            onReload();
          },
        },
        {
          label: t('pwa.later_button'),
          color: 'white',
          handler: () => {
            // Just dismiss the notification
            // The waiting SW will still be there for later
          },
        },
      ],
    });
  };

  return {
    showUpdateNotification,
  };
}
