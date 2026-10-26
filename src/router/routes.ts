import { RouteLocation, RouteLocationRaw, RouteRecordRaw } from 'vue-router';
import { defineComponent } from 'vue';

import { LANG_PREFIXES } from '@/i18n';
import { isCrawlerUA } from '@services/crawler-ua';

/** Crawler gate for the `menu` named view (SEO, follow-up to PR #347):
 * vue-router resolves lazy route components during NAVIGATION, before
 * any router-view renders — so a v-if on the view cannot stop the
 * WdMapMenu chunk (and its static chain: overlay-config cluster + the
 * 327 kB gz MapLibre vendor chunk) from loading for crawlers. The map
 * menu is pure map chrome with zero indexable content, so crawlers get
 * a render-nothing stub instead. */
const WdMapMenuCrawlerStub = defineComponent({
  name: 'WdMapMenuCrawlerStub',
  render: () => null,
});
const menuView = () =>
  isCrawlerUA() ? Promise.resolve(WdMapMenuCrawlerStub) : import('components/map/WdMapMenu.vue');

function redirectFix(to: RouteLocation, newRouteName: string): RouteLocationRaw {
  return {
    //path: to.path.replace(oldPath, newPath),
    name: newRouteName,
    query: to.query,
    hash: to.hash,
  };
}
const routes: RouteRecordRaw[] = [
  // it used to be '/m', but now we use '/' directly
  {
    path: '/auth',
    //redirect: '/oidc',
    name: 'auth',
    //component: () => import('layouts/MapLayout.vue'),
    children: [
      {
        path: 'signin-callback',
        name: 'auth.signin-callback',
        component: () => import('pages/auth/SigninCallbackPage.vue'),
      },
      {
        path: 'silent-refresh',
        name: 'auth.silent-refresh',
        component: () => import('pages/auth/SilentRefresh.vue'),
      },
    ],
  },
  {
    path: '/m/hut/:slug',
    redirect: to => redirectFix(to, 'map-hut'),
  },
  {
    path: '/m',
    redirect: to => redirectFix(to, 'map'),
  },
  {
    // Locale-prefixed public routes (full-prefix model): every language
    // in the i18n config gets an optional prefix — the indexed,
    // self-canonical SEO URLs. The router strips the prefix after boot
    // so users always see the bare URL; the prefix is the
    // initial-language hint, the stored preference still wins for
    // display (see boot/i18n.ts and router/index.ts).
    path: `/:langPrefix(${LANG_PREFIXES.join('|')})?`,
    component: () => import('layouts/MainLayout.vue'),
    children: [
      {
        path: 'login',
        name: 'login',
        components: {
          default: () => import('pages/auth/LoginPage.vue'),
        },
      },
      {
        path: 'hut/:slug',
        name: 'map-hut',
        meta: { content: true, contentType: 'place' },
        components: {
          default: () => import('pages/MapPage.vue'),
          menu: menuView,
          content: () => import('components/content/place/WdPlaceContent.vue'),
        },
        props: { content: true },
      },
      {
        path: '',
        name: 'map',
        components: {
          default: () => import('pages/MapPage.vue'),
          menu: menuView,
        },
      },
      {
        path: 'feedback',
        name: 'feedback',
        meta: { dialog: true },
        components: {
          default: () => import('pages/MapPage.vue'),
          dialog: () => import('components/feedback/WdFeedbackForm.vue'),
        },
      },
      {
        path: 'support',
        name: 'support',
        meta: { dialog: true },
        components: {
          default: () => import('pages/MapPage.vue'),
          dialog: () => import('components/support/WdSupportForm.vue'),
        },
      },
      {
        path: 'contribute',
        name: 'contribute',
        meta: { dialog: true },
        components: {
          default: () => import('pages/MapPage.vue'),
          dialog: () => import('components/contribute/WdContributePage.vue'),
        },
      },
    ],
  },

  {
    name: 'data-policy',
    path: '/data-policy',
    component: () => import('pages/DataPolicy.vue'),
  },
  // Always leave this as last one,
  // but you can also remove it
  {
    path: '/:catchAll(.*)*',
    component: () => import('pages/ErrorNotFound.vue'),
  },
];

export default routes;
