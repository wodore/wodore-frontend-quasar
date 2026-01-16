import { register } from 'register-service-worker';

// The ready(), registered(), cached(), updatefound() and updated()
// events passes a ServiceWorkerRegistration instance in their arguments.
// ServiceWorkerRegistration: https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration

// Import the composable for update notifications
// Note: We need to defer notification rendering until Vue app is ready
let showUpdateCallback: (() => void) | null = null;
const APP_VERSION = process.env.WODORE_APP_VERSION || '';

type Semver = {
  major: number;
  minor: number;
  patch: number;
};

const parseSemver = (version: string): Semver | null => {
  const clean = version.split('-')[0]?.split('+')[0] ?? '';
  const [majorRaw, minorRaw, patchRaw] = clean.split('.');
  if (!majorRaw || !minorRaw) return null;
  const major = Number(majorRaw);
  const minor = Number(minorRaw);
  const patch = Number(patchRaw ?? '0');
  if (Number.isNaN(major) || Number.isNaN(minor) || Number.isNaN(patch)) {
    return null;
  }
  return { major, minor, patch };
};

const shouldPromptUpdate = (currentVersion: string, nextVersion: string) => {
  const current = parseSemver(currentVersion);
  const next = parseSemver(nextVersion);

  if (!current || !next) return true;
  if (current.major !== next.major) return true;

  if (current.major === 0) {
    return current.minor !== next.minor;
  }

  return false;
};

const getWaitingSwVersion = async (
  waitingWorker: ServiceWorker,
  timeoutMs = 1000,
): Promise<string | null> => {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timeoutId = setTimeout(() => resolve(null), timeoutMs);

    channel.port1.onmessage = (event) => {
      clearTimeout(timeoutId);
      resolve(event.data?.version ?? null);
    };

    waitingWorker.postMessage({ type: 'GET_VERSION' }, [channel.port2]);
  });
};

register(process.env.SERVICE_WORKER_FILE, {
  // The registrationOptions object will be passed as the second argument
  // to ServiceWorkerContainer.register()
  // https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerContainer/register#Parameter

  // registrationOptions: { scope: './' },

  ready(/* registration */) {
    // console.log('Service worker is active.')
  },

  registered(registration) {
    console.log('[PWA] Service worker registered:', registration?.scope);

    // Periodically check for updates (every hour)
    // This helps detect updates even if the user doesn't navigate
    setInterval(
      () => {
        console.log('[PWA] Checking for updates...');
        registration?.update();
      },
      60 * 60 * 1000,
    );
  },

  cached(/* registration */) {
    console.log('[PWA] Content has been cached for offline use.');
  },

  updatefound(registration) {
    console.log('[PWA] New content is downloading...', {
      installing: registration?.installing?.state,
      waiting: registration?.waiting?.state,
      active: registration?.active?.scriptURL,
    });

    // Track the installing service worker
    const newWorker = registration?.installing;
    if (!newWorker) {
      console.log('[PWA] No installing worker found');
      return;
    }

    newWorker.addEventListener('statechange', async () => {
      console.log('[PWA] Worker state changed:', {
        state: newWorker.state,
        hasController: !!navigator.serviceWorker.controller,
      });

      if (
        newWorker.state === 'installed' &&
        navigator.serviceWorker.controller
      ) {
        // A new service worker is available and waiting
        // This means we have a newer version than what's currently running
        console.log('[PWA] New service worker is waiting to activate');

        const waitingWorker = registration?.waiting;
        const nextVersion = waitingWorker
          ? await getWaitingSwVersion(waitingWorker)
          : null;

        console.log('[PWA] Version comparison:', {
          current: APP_VERSION,
          next: nextVersion,
          shouldNotify:
            !nextVersion || shouldPromptUpdate(APP_VERSION, nextVersion),
        });

        if (!nextVersion || shouldPromptUpdate(APP_VERSION, nextVersion)) {
          // Wait a bit for the user to settle, then show notification
          setTimeout(() => {
            console.log('[PWA] Showing update notification to user');
            if (showUpdateCallback) {
              showUpdateCallback();
            } else {
              console.warn(
                '[PWA] No update callback set yet - will notify when app is ready',
              );
            }
          }, 2000);
        }
      }
    });
  },

  updated(/* registration */) {
    // console.log('New content is available; please refresh.')
    // This is called when the new SW becomes active
    // We handle the notification in updatefound instead
  },

  offline() {
    // console.log('No internet connection found. App is running in offline mode.')
  },

  error(/* err */) {
    // console.error('Error during service worker registration:', err)
  },
});

/**
 * Set the callback to show update notifications
 * This should be called from the Vue app when it's ready
 */
export function setPwaUpdateCallback(callback: () => void) {
  showUpdateCallback = callback;
}

/**
 * Trigger a manual service worker update check
 * Useful to call after user actions or on route changes
 */
export function checkForPwaUpdate() {
  console.log('[PWA] Manual update check requested');
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (reg) {
        console.log('[PWA] Current registration:', {
          scope: reg.scope,
          installing: reg.installing?.state,
          waiting: reg.waiting?.state,
          active: reg.active?.scriptURL,
        });
        reg
          .update()
          .then(() => {
            console.log('[PWA] Update check completed');
          })
          .catch((err) => {
            console.error('[PWA] Update check failed:', err);
          });
      } else {
        console.log('[PWA] No service worker registration found');
      }
    });
  }
}

/**
 * Get detailed service worker info for debugging
 */
export function getPwaDebugInfo() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistration().then((reg) => {
      console.log('[PWA] Debug Info:', {
        scope: reg?.scope,
        installing: reg?.installing?.state,
        waiting: reg?.waiting?.state,
        active: reg?.active?.scriptURL,
        controller: navigator.serviceWorker.controller?.scriptURL,
      });
    });
  }
}

// Make debug functions available globally for console access
if (typeof window !== 'undefined') {
  (
    window as unknown as {
      pwaDebug: { checkUpdate: () => void; getInfo: () => void };
    }
  ).pwaDebug = {
    checkUpdate: checkForPwaUpdate,
    getInfo: getPwaDebugInfo,
  };
  console.log(
    '[PWA] Debug functions available: window.pwaDebug.checkUpdate(), window.pwaDebug.getInfo()',
  );
}
