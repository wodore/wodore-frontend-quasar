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

  // Strip the ?lang= SEO edge-hint from the address bar: the nginx/njs
  // edge consumed it to localize the injected meta tags of the initial
  // HTML (boot/i18n also reads it as a fallback language hint). The
  // canonical never includes the query, so crawlers collapse param URLs
  // anyway — removing it keeps what users see, copy and share clean.
  // Runs through the router (not history.replaceState) so it wins over
  // components re-syncing the URL from their parsed route.
  let langParamStripped = false;
  Router.afterEach(to => {
    if (langParamStripped || !('lang' in to.query)) return;
    langParamStripped = true;
    const { lang: _lang, ...query } = to.query;
    void Router.replace({ query, hash: to.hash });
  });

  return Router;
});
