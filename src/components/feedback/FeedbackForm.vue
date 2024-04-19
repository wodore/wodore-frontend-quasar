<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useQuasar } from 'quasar';
import getImageUrl from 'src/services/imageService';

const $q = useQuasar();
const router = useRouter();

const email = ref<string>('');
const urls = ref<Array<{ value: string; id: number; placeholder: string }>>([]);
const feedback = ref<string>('');
function onSubmit() {
  console.debug(`Submitted form for '${email.value}'`, feedback);
  router.go(-1);
  $q.notify({
    color: 'positive',
    textColor: 'black',
    icon: 'eva-checkmark-circle',
    message: 'Submitted',
  });
  onReset();
}

function onClose() {
  if (email.value || feedback.value) {
    $q.dialog({
      dark: true,
      title: 'Confirm',
      message: 'Do you want to close it and dismiss the data?',
      cancel: true,
      persistent: true,
    }).onOk(() => {
      router.go(-1);
    });
  } else {
    router.go(-1);
  }
}
function onReset() {
  email.value = '';
  feedback.value = '';
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

const imgPath =
  'https://cdn.pixabay.com/photo/2014/05/11/11/12/mailbox-341744_1280.jpg';

const headerImg = getImageUrl(imgPath, {
  focal: '0.5,0.45',
  size: '800x300',
  quality: 50,
  //filters: ['grayscale()'],
});
console.log(headerImg);
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

.card {
  border: 2px solid rgba($black, 0.607);
  border-radius: 0 !important;
}
</style>

<template>
  <!-- lazy-rules
                :rules="[
                  (val) => (val && val.length > 0) || 'Please type something',
                ]" -->
  <q-card class="card" style="min-width: 400px; width: 500px; max-width: 700px">
    <q-form @submit="onSubmit" @reset="onReset" class="fit">
      <q-img :src="headerImg">
        <div class="card-header absolute-bottom text-white text-h5"></div>
        <div
          class="absolute-bottom text-accent-400 text-h4 text-center card-header__text"
        >
          Feedback
        </div>
      </q-img>
      <q-card-section
        style="min-height: 200px; height: 500px; max-height: 600px"
        class="scroll"
      >
        <div class="col no-wrap items-center">
          <!-- <div class="text-h4 text-accent-700">Feedback</div> -->
          <div class="q-gutter-md q-pt-md">
            <q-input
              v-model="email"
              outlined
              placeholder="name@domain.com"
              type="email"
            >
              <template v-slot:prepend> <q-icon name="eva-at" /> </template
            ></q-input>

            <q-input
              v-model="feedback"
              placeholder="Feedback Text"
              outlined
              type="textarea"
            >
              <template v-slot:prepend>
                <q-icon name="eva-file-text-outline" /> </template
            ></q-input>
            <q-input
              v-for="(url, idx) in urls"
              :key="url.id"
              v-model="url.value"
              dense
              outlined
              :placeholder="url.placeholder"
              type="url"
            >
              <template v-slot:prepend> <q-icon name="eva-link" /> </template>
              <template v-slot:append>
                <q-icon
                  name="eva-close"
                  @click="removeUrl(idx)"
                  class="cursor-pointer"
                />
              </template>
            </q-input>
            <q-btn
              v-if="urls.length < 4"
              @click="addUrl()"
              color="black"
              label="URL"
              flat
              icon="eva-plus-square-outline"
            />
          </div>
        </div>
      </q-card-section>
      <!-- <q-separator /> -->
      <q-card-actions>
        <q-btn
          label="Close"
          color="secondary-700"
          flat
          @click="onClose()"
          class="q-ml-sm"
        />
        <q-btn
          label="Reset"
          type="reset"
          color="secondary-700"
          flat
          class="q-ml-sm"
        />
        <q-space />
        <q-btn label="Submit" flat type="submit" color="accent" />
      </q-card-actions>
    </q-form>
  </q-card>
</template>
