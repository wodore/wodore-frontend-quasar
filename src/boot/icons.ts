import { boot } from 'quasar/wrappers';

import 'src/extras/icons/dist/icons.css';

// more info on params: https://v2.quasar.dev/quasar-cli/boot-files
export default boot(({ app }) => {
  app.config.globalProperties.$q.iconMapFn = (iconName: string) => {
    if (iconName.startsWith('wd-') === true) {
      return {
        cls: 'wd ' + iconName,
      };
    }
  };
});
