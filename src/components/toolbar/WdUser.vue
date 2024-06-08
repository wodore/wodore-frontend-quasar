<script setup lang="ts">
import { ref, watchEffect } from 'vue';

//import { useRouter, useRoute } from 'vue-router';
//import track from '@services/analytics';
import { useAuthStore } from '@stores/auth-store';
import { useAuthService } from 'src/composables/useAuthService';
import { LocalStorage } from 'quasar';

const authStore = useAuthStore();
const $auth = useAuthService();

const tracking = ref<boolean>(
  LocalStorage.hasItem('umami.disabled')
    ? !(LocalStorage.getItem('umami.disabled') as boolean)
    : true,
);

watchEffect(() => {
  if (!tracking.value) {
    LocalStorage.set('umami.disabled', !tracking.value);
  } else {
    LocalStorage.removeItem('umami.disabled');
  }
});

const adminLinks = [
  {
    url: `${process.env.API_HOST}/admin/`,
    name: 'Admin',
    caption: 'Wodore backend admin',
    group: 'admin',
    avatar: `https://${process.env.DOMAIN}/apple-touch-icon.png`,
  },
  {
    url: `${process.env.API_HOST}/v1/docs`,
    name: 'API',
    caption: 'Wodore API docs',
    group: 'root',
    avatar:
      'https://www.openapis.org/wp-content/uploads/sites/3/2019/06/favicon-140x140.png',
  },
  {
    url: `https://stats.${process.env.DOMAIN}/websites/${process.env.UMAMI_WEBSITE_ID}`,
    name: 'Analytics',
    caption: 'Umami analytics',
    group: 'admin',
    avatar: `https://stats.${process.env.DOMAIN}/apple-touch-icon.png`,
  },
  {
    url: `${process.env.OICD_ISSUER_URL}/ui/console/`,
    name: 'Zitadel',
    caption: 'Identity access management',
    group: 'root',
    avatar: `${process.env.OICD_ISSUER_URL}/ui/console/favicon.ico`,
  },
  {
    url: `https://traefik.${process.env.DOMAIN}`,
    name: 'Traefik',
    caption: 'Traefik dashboard (reverse proxy)',
    group: 'root',
    avatar: `https://traefik.${process.env.DOMAIN}/dashboard/statics/icons/favicon-96x96.png`,
  },
];

const filteredAdminLinks = adminLinks.filter((v) =>
  authStore.hasRole('group:' + v.group, true),
);

//const $router = useRouter();
//const $route = useRoute();
const showMenu = ref(false);
</script>

<!-- Why does min height not work -->
<style lang="scss" scoped>
.scroll-desktop {
  min-height: 200px;
  max-height: 400px;
  height: 240px;
  min-width: 330px;
  width: 300px;
}
.scroll-mobile {
  min-height: 200px;
  height: 250px;
  max-height: 400px;
  min-width: 250px;
  width: 300px;
}
</style>
<template>
  <div>
    <q-popup-proxy
      no-parent-event
      :offset="[0, 1]"
      anchor="top start"
      target="#toolbar-user-menu"
      v-model="showMenu"
      breakpoint="600"
      transition-show="jump-down"
      transition-hide="jump-up"
    >
      <q-card class="bg-dark-500 text-white dialog-radius">
        <!-- SETTINGS -->
        <div
          class="q-ma-xs z-top text-icon"
          style="position: absolute; width: 32px; top: 6px; right: 6px"
        >
          <q-btn
            dense
            round
            v-close-popup
            color="accent-700"
            icon="wd-close"
          ></q-btn>
          <q-btn
            flat
            dense
            round
            href="https://iam.wodore.com/ui/console/users/me"
            target="_blank"
            aria-label="Benutzer Einstellungen"
            class="q-mt-xs"
            ><q-icon> <IconEvaSettingsOutline /> </q-icon
          ></q-btn>
        </div>
        <!-- HEADER -->
        <q-list padding class="bg-dark-700">
          <q-item>
            <q-item-section avatar>
              <q-avatar size="56px">
                <img :src="authStore.avatar" />
              </q-avatar>
            </q-item-section>
            <!-- NAME - EMAIL -->
            <q-item-section>
              <q-item-label class="text-h5 text-accent">{{
                authStore.name
              }}</q-item-label>
              <q-item-label class="text-caption text-primary-200">{{
                authStore.email
              }}</q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
        <div>
          <div
            class="row justify-center z-top"
            style="position: relative; top: -10px; height: 0"
          >
            <!-- ROLES -->
            <div class="q-gutter-xs">
              <q-badge
                color="positive-700"
                v-for="p in authStore.permissions"
                :label="p"
                :key="p"
              ></q-badge>
              <q-badge
                color="secondary-800"
                v-for="g in authStore.groups"
                :label="g"
                :key="g"
              ></q-badge>
            </div>
          </div>
          <q-scroll-area
            visible
            :thumb-style="{
              width: '6px',
              backgroundColor: '#998019',
              opacity: '0.5',
              borderRadius: '8px 0 0 8px',
            }"
            class="bg-dark"
            :class="{
              'scroll-mobile': $q.platform.is.mobile,
              'scroll-desktop': !$q.platform.is.mobile,
            }"
          >
            <q-list dense padding>
              <!-- SETTINGS -->
              <q-item tag="label" v-ripple>
                <q-item-section>
                  <q-item-label>Umami Tracking</q-item-label>
                  <q-item-label class="text-caption text-primary-300">
                    <b>Mich</b> einschliessen beim tracken.
                  </q-item-label>
                </q-item-section>
                <q-item-section side top>
                  <q-toggle color="accent" v-model="tracking" />
                </q-item-section>
              </q-item>
              <!-- LINKS -->
              <q-item-label
                header
                v-if="filteredAdminLinks"
                class="text-primary-100"
                >Externe Links</q-item-label
              >
              <q-item
                v-for="link in filteredAdminLinks"
                :key="link.name"
                class="q-my-sm"
                dense
                clickable
                v-ripple
                :href="link.url"
                target="_blank"
              >
                <q-item-section avatar>
                  <q-avatar color="white" text-color="white">
                    <img v-if="link.avatar" :src="link.avatar" />
                    <span v-else>{{ link.name }}</span>
                  </q-avatar>
                </q-item-section>
                <q-item-section>
                  <q-item-label>{{ link.name }}</q-item-label>
                  <q-item-label
                    class="text-caption text-primary-200"
                    lines="1"
                    >{{ link.caption }}</q-item-label
                  >
                </q-item-section>
              </q-item>
            </q-list>
          </q-scroll-area>
        </div>
        <div
          class="q-pa-md column q-gutter-sm bg-dark-700"
          v-if="authStore.isLoggedIn"
        >
          <q-btn
            color="accent-700"
            unelevated
            @click="$auth.logout()"
            label="Logout"
            style="opacity: 0.8"
          />
        </div>
      </q-card>
    </q-popup-proxy>
    <!-- USER avatar menu button-->
    <q-btn round dense flat>
      <q-avatar @click="showMenu = true" id="toolbar-user-menu">
        <img :src="authStore.avatar" />
      </q-avatar>
    </q-btn>
  </div>
</template>
