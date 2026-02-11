import { useQuasar } from 'quasar';
import WdErrorDialog from './WdErrorDialog.vue';
import track from '@services/analytics';

export interface ErrorDialogOptions {
  errorCode: string;
  // Additional data to pass to the error dialog
  data?: Record<string, unknown>;
  // Whether the dialog should be persistent (cannot be closed by clicking outside or ESC)
  // Default: false
  persistent?: boolean;
}

/**
 * Show an error dialog with the given error code
 * The error code is used as a translation key: `error.${errorCode}.title`, etc.
 * Tracks the error with Umami analytics when shown
 *
 * @param options - Error dialog options
 * @returns Dialog reference
 */
export function showErrorDialog(options: ErrorDialogOptions) {
  const { errorCode, data = {}, persistent = false } = options;
  const $q = useQuasar();

  // Track error with Umami
  track('error_shown', {
    error_code: errorCode,
    persistent,
    ...data,
  });

  return $q.dialog({
    component: WdErrorDialog,
    componentProps: {
      errorCode,
      persistent,
      ...data,
    },
  });
}

/**
 * Convenience function to show specific error types
 */
export const showWebGLError = () => showErrorDialog({ errorCode: 'webgl', persistent: true });
export const showGenericError = () => showErrorDialog({ errorCode: 'generic' });
