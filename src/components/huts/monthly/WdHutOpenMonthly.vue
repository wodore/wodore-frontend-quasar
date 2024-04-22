<script setup lang="ts">
import { ref, computed, withDefaults } from 'vue';
import { useQuasar } from 'quasar';
const $q = useQuasar();
//import { HutTypeSchema, OpenMonthlySchema } from '@/clients/wodore_v1';
//import { storeToRefs } from 'pinia';
//import { useI18n } from 'vue-i18n';
//import { useHutTypesStore } from '../../stores/huts/hut-types-store';
//import HutType from './HutType.vue';
//const { t } = useI18n();
import { schemasWodore } from 'src/clients';
import { TypeMonths, monthList } from './index';

interface Props {
  open_monthly?: schemasWodore['HutSchemaDetails']['open_monthly'];
  type_open?: schemasWodore['HutSchemaDetails']['type_open'];
  type_closed?: schemasWodore['HutSchemaDetails']['type_closed'];
}

const props = withDefaults(defineProps<Props>(), {});
//const { hutTypesRecords } = storeToRefs(useHutTypesStore());

const isMobile = computed(() => $q.platform.is.mobile);
const hutAnswerIcons = ref<Record<schemasWodore['AnswerEnum'], string[]>>({
  yes: [getOpenIcon()],
  no: [getClosedIcon()],
  maybe: [getOpenIcon(), getClosedIcon()],
  unknown: [getUnknownIcon()],
});

function isMonthOpen(
  month: TypeMonths,
): schemasWodore['AnswerEnum'] | undefined {
  if (props.open_monthly) {
    return props.open_monthly['month_' + month] as schemasWodore['AnswerEnum'];
  }
  return undefined;
}
function monthOpenIcon(month: TypeMonths): string[] {
  const res = isMonthOpen(month);
  const selector: schemasWodore['AnswerEnum'] =
    res === undefined ? 'unknown' : res;
  return hutAnswerIcons.value[selector];
}

function getClosedIcon(): string {
  if (isMobile.value) {
    return props.type_closed
      ? 'img:' + props.type_closed.symbol
      : getUnknownIcon();
  } else {
    return props.type_closed
      ? 'img:' + props.type_closed.symbol_simple
      : getUnknownIcon();
  }
}

function getOpenIcon(): string {
  if (isMobile.value) {
    return 'img:' + props.type_open?.symbol;
  } else {
    return 'img:' + props.type_open?.symbol_simple;
  }
}

function getUnknownIcon(): string {
  if (isMobile.value) {
    return 'img:https://api.wodore.com/media/huts/types/symbols/detailed/unknown.png';
  } else {
    return 'img:https://api.wodore.com/media/huts/types/symbols/simple/unknown.png';
  }
}
</script>
<style scoped>
.monthly {
  border-radius: 5px;
}
</style>
<template>
  <div v-if="props.open_monthly">
    <div class="text-subtitle1 text-accent">{{ $t('hut_type') }}</div>
    <div class="row monthly overflow-hidden" v-if="!$q.platform.is.mobile">
      <div v-for="m in monthList" :key="m" class="col-md-2 col-sm-1 col-2">
        <WdMonthly :icons="monthOpenIcon(m)" :month="m" />
      </div>
    </div>
    <q-scroll-area
      style="height: 55px"
      class="monthly overflow-hidden"
      v-if="$q.platform.is.mobile"
      :horizontal-thumb-style="{ height: '3px' }"
    >
      <div style="height: 50px; width: 700px">
        <div class="row monthly overflow-hidden">
          <div v-for="m in monthList" :key="m" class="col-1">
            <WdMonthly :icons="monthOpenIcon(m)" :month="m" />
          </div>
        </div>
      </div>
    </q-scroll-area>
  </div>
</template>
