<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useQuasar } from 'quasar';
import getImageUrl from 'src/services/imageService';
//import { clientWodore } from '@clients/index';

const $q = useQuasar();
const router = useRouter();


function onClose() {
    router.go(-1);
}

const imgPath =
 // 'https://cdn.pixabay.com/photo/2014/05/11/11/12/mailbox-341744_1280.jpg';
 //'https://cdn.pixabay.com/photo/2016/03/19/23/36/hut-1267670_960_720.jpg';
 'https://cdn.pixabay.com/photo/2017/05/13/17/05/hut-2310075_960_720.jpg'

const headerImg = getImageUrl(imgPath, {
  //focal: '0.5,0.55',
  focal: '0.5,0.45',
  size: '800x300',
  quality: 50,
  //filters: ['grayscale()'],
});
 console.log(headerImg)
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
  min-height: 100%;
  height: 100%;
  width: 100%;
  min-width: 100%;
}
.card--desktop {
  border-radius: 10px !important;
  border: 2px solid rgba($black, 0.607);
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
  <q-card
    :class="{ 'card--desktop': $q.screen.gt.xs, 'card--mobile': $q.screen.xs }"
  >
      <q-img :src="headerImg" style="height: 140px">
        <div class="card-header absolute-bottom text-white text-h5"></div>
        <div
          class="absolute-bottom text-accent-400 text-h4 text-center card-header__text"
        >
          Support
        </div>
      </q-img>
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
              Unterstütze das Projekt mit
              <a class="link" @click="toFeedback">Feedback</a>, einem
              <WdStripeLink
                stripe-id="28o02Oda19qnbiE28a"
                name="Trinkgeld"
                icon="tip"
                class="link"
                  @click="onClose"
              />
              oder einem monatlichem:
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
                  @click="onClose"
                />
                <WdStripeBadge
                  stripe-id="bIY6rcc5X8mj2M87sz"
                  name="Bier"
                  amount="4"
                  color="primary-900"
                  icon="beer"
                  :size-factor="1.5"
                  style="
                    overflow: hidden;
                    z-index: 5;
                    min-width: 140px;
                    width: 150px;
                    max-width: 160px;
                  "
                  class="shadow-6 col-auto"
                  @click="onClose"
                />
                <WdStripeBadge
                  stripe-id="8wM2aW0nf0TRgCY6or"
                  name="Essen"
                  amount="15"
                  color="primary-800"
                  icon="lunch"
                  class="col"
                  @click="onClose"
                />
              </q-btn-group>
              <div class="text-center">
                <p class="text-body2 q-pt-xs text-secondary-800">
                  <a
                    href="https://billing.stripe.com/p/login/aEU9AA29o9vv7JucMM"
                    target="_blank"
                    >Monatliche Zahlungen verwalten.</a
                  >
                  <span class="text-grey-7"> *Jederzeit kündbar. </span>
                </p>
              </div>
            </div>
            <div class="text-body2 q-pt-md q-pb-md">
              Das Geld wird für die Infrastruktur, Lizenzen und potentielle neue Features benötigt.
            </div>
            <q-card class="text-body2 bg-secondary-900 text-white q-my-lg">
            <q-card-section>
              <h5 class="q-mb-md q-mt-none">Ich haue gerne selber in die Tasten!</h5>
              <p><b>Super</b>, aktive Unterstützung ist sehr willkommen, zum Beispiel:
                <ul>
                  <li>Hütteninfos reviewen und anpassen (als Editor)</li>
                  <li>Entwicklung von Frontend (<a href="https://quasar.dev/" target="_blank">Quasar</a>)
                    oder Backend (<a href="https://www.djangoproject.com/" target="_blank">Django</a>)</li>
                  <li>Unterstützung bei Design-Aufgaben</li>
                  <li>...</li>
                </ul>
              </p>
              Bitte trete mit uns in <a @click="toFeedback">Kontakt</a>!
            </q-card-section>
            </q-card>
          </div>
        </q-scroll-area>
      </q-card-section>
      <q-separator />
      <q-card-actions>
        <q-space />
        <q-btn
          label="Schliessen"
          color="secondary-700"
          flat
          @click="onClose()"
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
