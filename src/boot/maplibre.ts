import { boot } from 'quasar/wrappers';
import VueMaplibreGl from 'vue-maplibre-gl';

// "async" is optional;
// more info on params: https://v2.quasar.dev/quasar-cli/boot-files
export default boot(async ({ app }) => {
  app.use(VueMaplibreGl);
});
