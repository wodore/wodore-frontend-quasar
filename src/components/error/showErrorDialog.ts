import { useQuasar } from 'quasar';
import WdErrorDialog from './WdErrorDialog.vue';
import track from '@services/analytics';

/**
 * Error codes used as translation keys in i18n/locales/*.json
 * Each error code maps to: error.${ErrorCode}.title, error.${ErrorCode}.description, etc.
 */
export enum ErrorCode {
  WEBGL_NOT_SUPPORTED = 'WEBGL_NOT_SUPPORTED',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  MAP_ERROR = 'MAP_ERROR',
}

export interface ErrorDialogOptions {
  errorCode: ErrorCode;
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
 * Show a persistent error dialog (cannot be closed by clicking outside or pressing ESC)
 * Use this for critical errors that must be acknowledged
 *
 * @param errorCode - Error code to display
 * @param data - Additional data to pass to the error dialog
 * @returns Dialog reference
 */
export function showErrorDialogPersistent(errorCode: ErrorCode, data?: Record<string, unknown>) {
  return showErrorDialog({ errorCode, data, persistent: true });
}
