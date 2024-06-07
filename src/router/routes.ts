import { RouteLocation, RouteLocationRaw, RouteRecordRaw } from 'vue-router';

function redirectFix(
  to: RouteLocation,
  newRouteName: string,
): RouteLocationRaw {
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
    redirect: (to) => redirectFix(to, 'map-hut'),
  },
  {
    path: '/m',
    redirect: (to) => redirectFix(to, 'map'),
  },
  {
    path: '/',
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
        meta: { content: true },
        components: {
          default: () => import('pages/MapPage.vue'),
          menu: () => import('components/map/WdMapMenu.vue'),
          content: () => import('components/huts/WdHutView.vue'),
        },
        props: { content: true },
      },
      {
        path: '',
        name: 'map',
        components: {
          default: () => import('pages/MapPage.vue'),
          menu: () => import('components/map/WdMapMenu.vue'),
          content: () => import('components/huts/WdHutView.vue'),
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
    ],
  },
  // Always leave this as last one,
  // but you can also remove it
  {
    path: '/:catchAll(.*)*',
    component: () => import('pages/ErrorNotFound.vue'),
  },
];

export default routes;
