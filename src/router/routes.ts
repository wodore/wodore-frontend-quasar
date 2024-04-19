import { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: 'map',
    component: () => import('layouts/MainLayout.vue'),
    children: [
      {
        path: 'map/hut/:slug',
        name: 'map-hut',
        meta: { content: true },
        components: {
          default: () => import('pages/MapPage.vue'),
          menu: () => import('components/MapMenu.vue'),
          content: () => import('components/huts/HutView.vue'),
        },
        props: { content: true },
      },
      {
        path: 'map',
        name: 'map',
        components: {
          default: () => import('pages/MapPage.vue'),
          menu: () => import('components/MapMenu.vue'),
          content: () => import('components/huts/HutView.vue'),
        },
      },
      {
        path: 'feedback',
        name: 'feedback',
        meta: { dialog: true },
        components: {
          default: () => import('pages/MapPage.vue'),
          dialog: () => import('components/feedback/FeedbackForm.vue'),
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
