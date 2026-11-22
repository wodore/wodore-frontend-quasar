import type { CapacitorConfig } from '@capacitor/cli';

// Plain object form (no @quasar/app-vite/capacitor import): the raw
// `cap` CLI parses this file from src-capacitor/, where the root's
// node_modules — and with it defineCapacitorConfig — is not resolvable
// (pnpm mode-scoped installs). A type-only import is erased in the CLI's
// transpile step, so nothing runtime is required from outside this dir.
const config: CapacitorConfig = {
  appId: 'com.wodore.app',
  appName: 'Wodore',
  webDir: 'www',
  android: {
    adjustMarginsForEdgeToEdge: 'disable',
  },
};

export default config;
