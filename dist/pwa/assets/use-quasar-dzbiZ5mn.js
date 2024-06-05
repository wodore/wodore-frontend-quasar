import { bm as Platform, q as inject, bt as quasarKey } from "./index-CAHSu7Ql.js";
function clearSelection() {
  if (window.getSelection !== void 0) {
    const selection = window.getSelection();
    if (selection.empty !== void 0) {
      selection.empty();
    } else if (selection.removeAllRanges !== void 0) {
      selection.removeAllRanges();
      Platform.is.mobile !== true && selection.addRange(document.createRange());
    }
  } else if (document.selection !== void 0) {
    document.selection.empty();
  }
}
function useQuasar() {
  return inject(quasarKey);
}
export {
  clearSelection as c,
  useQuasar as u
};
