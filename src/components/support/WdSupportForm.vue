<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useQuasar } from 'quasar';
import getImageUrl from 'src/services/imageService';
//import { clientWodore } from '@clients/index';

import track from '@services/analytics';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const $q = useQuasar();
const router = useRouter();

function onClose(do_track = false) {
  if (do_track) {
    track('support-no-action');
  }
  // Navigation is handled by MainLayout's onDialogHide()
  // which is triggered when v-close-popup closes the dialog
  // No need to call router.go(-1) here
}

const imgPath =
  // 'https://cdn.pixabay.com/photo/2014/05/11/11/12/mailbox-341744_1280.jpg';
  //'https://cdn.pixabay.com/photo/2016/03/19/23/36/hut-1267670_960_720.jpg';
  'https://cdn.pixabay.com/photo/2017/05/13/17/05/hut-2310075_960_720.jpg';

const headerImg = getImageUrl(imgPath, {
  //focal: '0.5,0.55',
  focal: '0.5,0.45',
  size: '800x300',
  quality: 50,
  //filters: ['grayscale()'],
});
function toFeedback() {
  router.replace({ name: 'feedback' });
}
</script>

<style lang="scss" scoped>
.card-header {
  filter: blur(15px);
  height: 60px;
}
.card-header__text {
  background: none !important;
  text-shadow: 0px 0px 8px $black;
}

.card--mobile {
  border-radius: unset;
  min-height: 100%;
  height: 100%;
  width: 100%;
  min-width: 100%;
}
.card--desktop {
  min-height: 300px;
  height: 800px;
  max-height: 900px;
  min-width: 300px;
  width: 550px;
  max-width: 600px;
}
.link:active,
.link:visited,
.link:hover,
.link:link,
.link {
  color: color('accent', 800);
  text-decoration: underline dotted;
  text-decoration-color: color('accent', 600);
  cursor: pointer;
  font-weight: 500;
}
.link:hover {
  color: color('accent', 600);
}
</style>

<template>
  <q-card :class="{ 'card--desktop': $q.screen.gt.xs, 'card--mobile': $q.screen.xs }">
    <div>
      <q-img :src="headerImg" style="height: 140px" class="shadow-4">
        <div class="card-header absolute-bottom text-white text-h5"></div>
        <div class="absolute-bottom text-accent-400 text-h4 text-center card-header__text">
          {{ t('support.title') }}
        </div>
      </q-img>
    </div>
    <q-card-section style="padding: 0; height: calc(100% - 196px)">
      <!-- TODO: add scroll area -->
      <!-- min-height: 200px;
            height: 450px;
            max-height: 600px; -->
      <q-scroll-area
        class="fit"
        style="padding: 0 16px 0 16px"
        :thumb-style="{
          width: '6px',
          borderRadius: '8px 0 0 8px',
        }"
      >
        <div class="col no-wrap items-center q-py-md">
          <p class="text-body1 q-pt-md">
            {{ t('support.intro_prefix') }}
            <a class="link" @click="toFeedback">{{ t('feedback_label') }}</a
            >{{ t('support.intro_middle') }}
            <WdStripeLink
              stripe-id="28o02Oda19qnbiE28a"
              :name="t('support.tip_link')"
              icon="tip"
              class="link"
              @click="onClose(false)"
            />
            {{ t('support.intro_suffix') }}
          </p>
          <div class="q-pt-lg row justify-center">
            <q-btn-group style="border-radius: 40px; max-width: 400px">
              <WdStripeBadge
                stripe-id="9AQ16S2vn1XV3QcbIO"
                name="Snickers"
                amount="1.50"
                color="primary-800"
                icon="snickers"
                class="col"
                @click="onClose(false)"
              />
              <WdStripeBadge
                stripe-id="bIY6rcc5X8mj2M87sz"
                name="Bier"
                amount="4"
                color="primary-900"
                icon="beer"
                :size-factor="1.3"
                style="
                  overflow: hidden;
                  z-index: 5;
                  min-width: 140px;
                  width: 150px;
                  max-width: 160px;
                "
                class="shadow-6 col-auto"
                @click="onClose(false)"
              />
              <WdStripeBadge
                stripe-id="8wM2aW0nf0TRgCY6or"
                name="Essen"
                amount="15"
                color="primary-800"
                icon="lunch"
                class="col"
                @click="onClose(false)"
              />
            </q-btn-group>
            <div class="text-center">
              <p class="text-body2 q-pt-xs text-secondary-800">
                <a href="https://billing.stripe.com/p/login/aEU9AA29o9vv7JucMM" target="_blank">{{
                  t('support.manage_payments')
                }}</a>
                <span class="text-grey-7"> {{ t('support.cancel_anytime') }} </span>
              </p>
            </div>
          </div>
          <div class="text-body2 q-pt-md q-pb-md">
            <i18n-t keypath="support.one_man_project" tag="span">
              <template #term
                ><i>{{ t('support.one_man_project_term') }}</i></template
              >
            </i18n-t>
          </div>
          <q-card class="text-body2 bg-secondary-900 text-white q-my-lg">
            <q-card-section>
              <h5 class="q-mb-md q-mt-none">{{ t('support.hands_on_title') }}</h5>
              <div>
                <b>{{ t('support.hands_on_super') }}</b
                >{{ t('support.hands_on_intro') }}
                <ul>
                  <li>{{ t('support.contribute_editor') }}</li>
                  <li>
                    {{ t('support.contribute_dev_prefix')
                    }}<a href="https://quasar.dev/" target="_blank">Quasar</a
                    >{{ t('support.contribute_dev_middle')
                    }}<a href="https://www.djangoproject.com/" target="_blank">Django</a>)
                  </li>
                  <li>{{ t('support.contribute_design') }}</li>
                  <li>...</li>
                </ul>
              </div>
              {{ t('support.contact_invite') }}
              <a style="cursor: pointer" @click="toFeedback">{{ t('support.contact_link') }}</a
              >!
            </q-card-section>
          </q-card>
        </div>
      </q-scroll-area>
    </q-card-section>
    <q-separator />
    <q-card-actions>
      <q-space />
      <q-btn
        :label="t('close')"
        color="secondary-700"
        flat
        v-close-popup
        @click="onClose(true)"
        class="q-ml-sm"
      />
      <!-- <q-btn
          label="Zurücksetzen"
          type="reset"
          color="secondary-700"
          flat
          class="q-ml-sm"
        />
        <q-space />
        <q-btn label="Senden" flat type="submit" color="accent" /> -->
    </q-card-actions>
  </q-card>
</template>
