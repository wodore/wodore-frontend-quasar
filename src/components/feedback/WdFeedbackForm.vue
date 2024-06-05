<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useQuasar } from 'quasar';
import getImageUrl from 'src/services/imageService';
import { clientWodore } from '@clients/index';

const $q = useQuasar();
const router = useRouter();

const anoymDefaultEmail = `anonym@${process.env.DOMAIN}`;
const message = reactive<{
  email: string;
  subject: string;
  message: string;
  get_updates: boolean;
  urls: Array<string>;
}>({
  email: '',
  subject: '',
  message: '',
  get_updates: false,
  urls: [],
});
//const email = ref<string>('');
//const subject = ref<string>('');
const urls = ref<Array<{ value: string; id: number; placeholder: string }>>([]);
//const message = ref<string>('');
function onSubmit() {
  console.debug(`Submitted form for '${message.email}'`, message.message);
  message.urls = urls.value.map((url) => url.value);
  if (message.email == anoymDefaultEmail) {
    message.get_updates = false;
  }
  clientWodore
    .POST('/v1/feedback/', {
      body: message,
    })
    .then(() => {
      $q.notify({
        color: 'positive',
        textColor: 'black',
        icon: 'wd-checkmark',
        message: 'Nachricht gesendet',
      });
      router.go(-1);
      setTimeout(() => {
        onReset();
      }, 200);
    })
    .catch(() => {
      $q.notify({
        color: 'negative',
        textColor: 'black',
        icon: 'wd-close',
        message: 'Nachricht konnte nicht gesendet werden',
      });
    });
}

const anonymous = ref(false);
function onClose() {
  if (message.email || message.message) {
    $q.dialog({
      dark: true,
      title: 'Bist du sicher?',
      message: 'Deine Eingaben gehen verloren! Schliessen?',
      persistent: true,
      ok: {
        label: 'Ja',
        flat: true,
      },
      cancel: {
        label: 'Nein',
        flat: true,
      },
    }).onOk(() => {
      router.go(-1);
    });
  } else {
    router.go(-1);
  }
}
function onReset() {
  message.email = '';
  message.message = '';
}

function addUrl() {
  const len = urls.value.length;
  const id = len > 0 ? urls.value[len - 1].id + 1 : 0;
  console.log(urls.value);
  console.log(id);
  urls.value.push({
    value: '',
    id: id,
    placeholder: `URL ${id + 1}`,
  });
}
function removeUrl(idx: number) {
  urls.value.splice(idx, 1);
}
function toSupport() {
  router.replace({ name: 'support' });
}

const imgPath =
  'https://cdn.pixabay.com/photo/2014/05/11/11/12/mailbox-341744_1280.jpg';

const headerImg = getImageUrl(imgPath, {
  focal: '0.5,0.45',
  size: '800x300',
  quality: 50,
  //filters: ['grayscale()'],
});
console.log(headerImg);
let origEmail = '';
function setAnonym(value: boolean) {
  if (value) {
    origEmail = message.email;
    message.email = anoymDefaultEmail;
    anonymous.value = true;
  } else {
    message.email = origEmail;
    anonymous.value = false;
  }
}
//onBeforeUnmount(() => onClose());
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
.anonym_icon {
  cursor: pointer;
  pointer-events: all;
}
</style>

<template>
  <!-- lazy-rules
                :rules="[
                  (val) => (val && val.length > 0) || 'Please type something',
                ]" -->
  <q-card
    :class="{ 'card--desktop': $q.screen.gt.xs, 'card--mobile': $q.screen.xs }"
  >
    <!-- style="min-width: 400px; width: 500px; max-width: 700px" -->
    <q-form @submit="onSubmit" @reset="onReset" class="fit">
      <div>
        <q-img :src="headerImg" style="height: 140px" class="shadow-4">
          <div class="card-header absolute-bottom text-white text-h5"></div>
          <div
            class="absolute-bottom text-accent-400 text-h4 text-center card-header__text"
          >
            Rückmeldung
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
              <b>Sag, was du denkst!</b> Jede Rückmeldung, egal ob positiv oder
              negativ, hilft weiter.
            </p>
            <p class="text-body2">
              Jegliche
              <a class="link" @click="toSupport">Unterstützung</a>
              für das Projekt ist willkommen.
            </p>
            <!-- <div class="text-h4 text-accent-700">Feedback</div> -->
            <div class="q-gutter-md q-pt-md">
              <q-input
                v-model="message.subject"
                dense
                aria-label="Betreff"
                outlined
                counter
                placeholder="Betreff"
                maxlength="60"
              >
                <template v-slot:prepend>
                  <q-icon name="wd-subject" />
                </template>
              </q-input>
              <q-input
                dense
                v-model="message.email"
                outlined
                aria-label="E-Mail"
                placeholder="name@domain.com"
                type="email"
                maxlength="100"
                :rules="[(val) => !!val || 'E-Mail fehlt']"
                :disable="anonymous"
              >
                <template v-slot:prepend> <q-icon name="wd-at" /> </template>

                <template v-slot:append>
                  <IconMdiAnonymousCircleOff
                    v-if="anonymous"
                    @click="setAnonym(false)"
                    class="anonym_icon"
                  />
                  <IconMdiAnonymousCircle
                    v-else
                    @click="setAnonym(true)"
                    class="anonym_icon"
                  />
                  <!-- <q-icon
                  :name="isPwd ? 'visibility_off' : 'visibility'"
                  class="cursor-pointer"
                  @click="isPwd = !isPwd"
                /> -->
                </template>
              </q-input>

              <q-input
                v-model="message.message"
                autogrow
                counter
                aria-label="Nachricht"
                placeholder="Nachricht"
                dense
                outlined
                type="textarea"
                maxlength="10000"
                :rules="[(val) => !!val || 'Nachricht fehlt']"
              >
                <template v-slot:prepend>
                  <q-icon name="wd-text-outline" /> </template
              ></q-input>
              <q-input
                v-for="(url, idx) in urls"
                :key="url.id"
                v-model="url.value"
                dense
                outlined
                maxlength="300"
                :placeholder="url.placeholder"
              >
                <!-- :rules="[(val) => !!val || 'URL fehlt']" -->
                <template v-slot:prepend> <q-icon name="wd-link" /> </template>
                <template v-slot:after>
                  <q-icon
                    name="wd-close"
                    @click="removeUrl(idx)"
                    class="cursor-pointer"
                  />
                </template>
              </q-input>
              <div class="">
                <q-btn
                  v-if="urls.length < 4"
                  @click="addUrl()"
                  class="text-grey-8 float-right"
                  label="URL"
                  flat
                  icon="wd-add-outline"
                />
              </div>
              <div>
                <q-checkbox
                  v-if="!anonymous"
                  v-model="message.get_updates"
                  checked-icon="wd-bell"
                  unchecked-icon="wd-bell-outline"
                  color="accent"
                  size="lg"
                >
                  Halte mich auf dem Laufenden.<br />
                  <span class="text-caption"
                    >Bei wichtigen Updates erhältst du eine E-Mail.
                  </span>
                </q-checkbox>
              </div>
            </div>
          </div>
        </q-scroll-area>
      </q-card-section>
      <q-separator />
      <q-card-actions>
        <q-btn
          label="Schliessen"
          color="secondary-700"
          flat
          @click="onClose()"
          class="q-ml-sm"
        />
        <q-btn
          label="Zurücksetzen"
          type="reset"
          color="secondary-700"
          flat
          class="q-ml-sm"
        />
        <q-space />
        <q-btn label="Senden" flat type="submit" color="accent" />
      </q-card-actions>
    </q-form>
  </q-card>
</template>
