<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useDialogPluginComponent } from 'quasar';

defineEmits(useDialogPluginComponent.emitsObject);

const { dialogRef, onDialogHide, onDialogOK } = useDialogPluginComponent();
const { t } = useI18n();

interface Props {
  errorCode: string;
  persistent?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  persistent: false,
});

const title = computed(() => {
  try {
    return t(`error.${props.errorCode}.title`);
  } catch {
    return t('error.generic.title');
  }
});

const code = computed(() => {
  try {
    return t(`error.${props.errorCode}.code`);
  } catch {
    return 'UNKNOWN_ERROR';
  }
});

const description = computed(() => {
  try {
    return t(`error.${props.errorCode}.description`);
  } catch {
    return t('error.generic.description');
  }
});

const hasHint = computed(() => {
  try {
    const hint = t(`error.${props.errorCode}.hint`);
    return hint !== `error.${props.errorCode}.hint`;
  } catch {
    return false;
  }
});

const hint = computed(() => {
  return t(`error.${props.errorCode}.hint`);
});
</script>

<template>
  <q-dialog ref="dialogRef" :persistent="persistent" @hide="onDialogHide">
    <q-card>
      <q-card-section class="bg-warning text-white">
        <div class="text-h6">
          <q-icon name="wd-alert-triangle-outline" size="sm" class="q-mr-sm" />
          {{ title }}
        </div>
      </q-card-section>

      <q-card-section>
        <div class="text-caption text-grey-7 q-mb-sm">
          {{ $t('error.code') }}:
          <b
            ><code>{{ code }}</code></b
          >
        </div>
        <p>{{ description }}</p>
        <p v-if="hasHint" class="text-caption text-grey-7 q-mt-md">
          {{ hint }}
        </p>
      </q-card-section>

      <q-card-actions v-if="!persistent" align="right">
        <q-btn flat color="primary" :label="$t('error.close')" @click="onDialogOK" v-close-popup />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>
