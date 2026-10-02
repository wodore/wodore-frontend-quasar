import { route } from 'quasar/wrappers';
import {
  createMemoryHistory,
  createRouter,
  createWebHashHistory,
  createWebHistory,
} from 'vue-router';

import routes from './routes';

/*
 * If not building with SSR mode, you can
 * directly export the Router instantiation;
 *
 * The function below can be async too; either use
 * async/await or return a Promise which resolves
 * with the Router instance.
 */

export default route(function (/* { store, ssrContext } */) {
  const createHistory = process.env.SERVER
    ? createMemoryHistory
    : process.env.VUE_ROUTER_MODE === 'history'
      ? createWebHistory
      : createWebHashHistory;

  const Router = createRouter({
    scrollBehavior: () => ({ left: 0, top: 0 }),
    routes,

    // Leave this as is and make changes in quasar.conf.js instead!
    // quasar.conf.js -> build -> vueRouterMode
    // quasar.conf.js -> build -> publicPath
    history: createHistory(process.env.VUE_ROUTER_BASE),
  });

  // Normalize the address bar to the bare (user-facing) URL after the
  // first navigation: strip the locale prefix and the ?lang= SEO
  // edge-hint. The nginx/njs edge consumed both to localize the meta
  // tags of the initial HTML (boot/i18n also reads them as language
  // hints), and crawlers see the prefixed URLs as self-canonical with
  // the bare URL canonicalized to the default language — so removing
  // them for users loses nothing and keeps what they see, copy and
  // share clean. Runs through the router (not history.replaceState) so
  // it wins over components re-syncing the URL from their parsed route.
  let seoLangNormalized = false;
  Router.afterEach(to => {
    if (seoLangNormalized) return;
    const hasLangParam = 'lang' in to.query;
    const langPrefix = to.params.langPrefix as string | undefined;
    if (!hasLangParam && !langPrefix) return;
    seoLangNormalized = true;
    const { lang: _lang, ...query } = to.query;
    const path = langPrefix
      ? to.path.replace(new RegExp(`^/${langPrefix}(/|$)`), '/')
      : to.path;
    void Router.replace({ path, query, hash: to.hash });
  });

  return Router;
});
