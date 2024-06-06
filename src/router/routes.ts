import { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '',
    component: () => import('layouts/MainLayout.vue'),
    children: [
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
