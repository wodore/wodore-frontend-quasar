import { defineCapacitorConfig } from '@quasar/app-vite/capacitor';

export default defineCapacitorConfig({
  appId: 'com.wodore.app',
  appName: 'Wodore',
  android: {
    adjustMarginsForEdgeToEdge: 'disable',
  },
});
