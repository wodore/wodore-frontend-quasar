/**
 * Native app (Capacitor) detection & body class.
 *
 * Android 15+ (targetSdk 35) enforces edge-to-edge: the WebView draws
 * under the status and navigation bars. CSS rules keyed on
 * `body.capacitor` (see src/css/app.scss) use `env(safe-area-inset-*)`
 * to keep controls out of the system bar zones while surfaces stay
 * full-bleed. The insets evaluate to 0 in the PWA, so all rules are
 * no-ops there.
 */
export default () => {
  if (process.env.CLIENT && process.env.MODE === 'capacitor') {
    document.body.classList.add('capacitor');
  }
};
