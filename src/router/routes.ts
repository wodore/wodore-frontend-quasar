import { RouteLocation, RouteLocationRaw, RouteRecordRaw } from 'vue-router';

import { FALLBACK_LOCALE, LANG_PREFIXES } from '@/i18n';

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
    // The default language (English) is served unprefixed —
    // /en/... redirects to bare (the edge does the same for crawlers;
    // this covers SPA-side navigation). Prefixes come from the i18n
    // config so this stays in sync with it.
    path: `/${FALLBACK_LOCALE}/:rest(.*)*`,
    redirect: to => ({
      path: to.path.replace(new RegExp(`^/${FALLBACK_LOCALE}`), '') || '/',
      query: to.query,
      hash: to.hash,
    }),
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
    // Locale-prefixed public routes (cartoload pattern): English, the
    // default, stays at the bare path; every other language in the i18n
    // config gets the optional prefix. The prefix is the initial-language
    // hint — the stored user preference still wins for display (see
    // boot/i18n.ts).
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
          menu: () => import('components/map/WdMapMenu.vue'),
          content: () => import('components/content/place/WdPlaceContent.vue'),
        },
        props: { content: true },
      },
      {
        path: '',
        name: 'map',
        components: {
          default: () => import('pages/MapPage.vue'),
          menu: () => import('components/map/WdMapMenu.vue'),
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
