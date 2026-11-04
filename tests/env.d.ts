/**
 * Vue SFC shim for plain tsserver contexts (editors, lens probes) that
 * resolve test files through THIS tsconfig — the nearest-config walk
 * from tests/** lands here, not on the root tsconfig (whose include
 * covers only the app). vue-tsc never needs this: it compiles SFCs
 * natively and does not include tests/ in the app project.
 */
declare module '*.vue' {
  import type { ComponentOptions } from 'vue';
  const component: ComponentOptions;
  export default component;
}
