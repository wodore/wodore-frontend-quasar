import { b as boot } from "./index-CAHSu7Ql.js";
const icons = boot(({ app }) => {
  app.config.globalProperties.$q.iconMapFn = (iconName) => {
    if (iconName.startsWith("wd-") === true) {
      return {
        cls: "wd " + iconName
      };
    }
  };
});
export {
  icons as default
};
