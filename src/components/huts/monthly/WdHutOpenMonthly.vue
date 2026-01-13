<script setup lang="ts">
import { computed, withDefaults } from 'vue';
import { useQuasar } from 'quasar';
import getImageUrl from '@services/imageService';
const $q = useQuasar();
//import { HutTypeSchema, OpenMonthlySchema } from '@/clients/wodore_v1';
//import { storeToRefs } from 'pinia';
//import { useI18n } from 'vue-i18n';
//import { useHutTypesStore } from '../../stores/huts/hut-types-store';
//import HutType from './HutType.vue';
//const { t } = useI18n();
import { schemasWodore } from '@clients/index';
import {
  TypeMonths,
  monthList,
  TypeIconText,
  TypeMonthIcons,
  iconSwitch,
  iconMaybeSwitch,
  TypeMonthIconsPath,
} from './index';

interface Props {
  open_monthly?: schemasWodore['HutSchemaDetails']['open_monthly'];
  type_open?: schemasWodore['HutSchemaDetails']['type_open'];
  type_closed?: schemasWodore['HutSchemaDetails']['type_closed'];
}

const props = withDefaults(defineProps<Props>(), {});
//const { hutTypesRecords } = storeToRefs(useHutTypesStore());

const isMobile = computed(() => $q.platform.is.mobile);
//const hutAnswerIcons = ref<Record<schemasWodore['AnswerEnum'], string[]>>({
//  yes: [getOpenIcon()],
//  no: [getClosedIcon()],
//  maybe: [getOpenIcon(), getClosedIcon()],
//  unknown: [getUnknownIcon()],
//});

function isMonthOpen(month: TypeMonths): schemasWodore['AnswerEnum'] {
  let res: schemasWodore['AnswerEnum'];
  if (props.open_monthly) {
    res = props.open_monthly['month_' + month] as schemasWodore['AnswerEnum'];
  } else {
    return 'unknown';
  }
  if (res === undefined) {
    return 'unknown';
  }
  return res;
}
function getMonthIcons(month: TypeMonths): TypeMonthIconsPath {
  const idx = parseInt(month);
  const prevMonth: TypeMonths = (idx >= 0 ? idx - 1 : 11)
    .toString()
    .padStart(2, '0') as TypeMonths;
  const nextMonth: TypeMonths = (idx >= 11 ? 0 : idx + 1)
    .toString()
    .padStart(2, '0') as TypeMonths;
  const monthAns = isMonthOpen(month);
  const prevMonthAns = isMonthOpen(prevMonth);
  const nextMonthAns = isMonthOpen(nextMonth);
  let r: TypeMonthIcons;
  if (monthAns == 'maybe') {
    r = iconMaybeSwitch[prevMonthAns][monthAns][nextMonthAns];
  } else {
    r = iconSwitch[monthAns];
  }
  return {
    main0:
      getIconAnswer(r.main0) === undefined
        ? getUnknownIcon()
        : (getIconAnswer(r.main0) as string),
    main1: getIconAnswer(r.main1),
    minor: getIconAnswer(r.minor),
  };
}

function getIconAnswer(
  answer: TypeIconText,
  size: string = '48x48',
): string | undefined {
  let img: string;
  if (answer == 'open') {
    img = getOpenIcon();
  } else if (answer == 'closed') {
    img = getClosedIcon();
  } else if (answer == 'unknown') {
    img = getUnknownIcon();
  } else {
    return undefined;
  }
  return 'img:' + getImageUrl(img, { fit: true, size: size });
}

function getClosedIcon(): string {
  if (isMobile.value) {
    if (props.type_closed?.symbol?.detailed) {
      return props.type_closed.symbol.detailed as string;
    }
  } else {
    if (props.type_closed?.symbol?.simple) {
      return props.type_closed.symbol.simple as string;
    }
  }
  return getUnknownIcon();
}

function getOpenIcon(): string {
  if (isMobile.value) {
    if (props.type_open?.symbol?.detailed) {
      return props.type_open.symbol.detailed;
    }
  } else {
    if (props.type_open?.symbol?.simple) {
      return props.type_open.symbol.simple;
    }
  }
  return getUnknownIcon();
}

function getUnknownIcon(): string {
  if (isMobile.value) {
    return 'https://hub.wodore.com/media/huts/types/symbols/detailed/unknown.png';
  } else {
    return 'https://hub.wodore.com/media/huts/types/symbols/simple/unknown.png';
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
    <!-- <pre>{{ $props.open_monthly }}</pre> -->
    <div class="text-subtitle1 text-accent q-mb-sm">{{ $t('hut_type') }}</div>

    <div class="row monthly overflow-hidden" v-if="!$q.platform.is.mobile">
      <div v-for="m in monthList" :key="m" class="col-md-2 col-sm-1 col-2">
        <WdMonthly :icons="getMonthIcons(m)" :month="m" />
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
            <WdMonthly :icons="getMonthIcons(m)" :month="m" />
          </div>
        </div>
      </div>
    </q-scroll-area>
    <div class="justify-center row q-my-sm">
      <WdHutTypeNameChip
        class="col-shrink"
        :type="type_open"
        v-if="type_open"
        :name="type_open.name as string"
        color="grey-5"
        color2="grey-4"
      />
      <WdHutTypeNameChip
        v-if="type_closed"
        class="col-shrink"
        :type="type_closed"
        :name="type_closed.name as string"
        color="grey-5"
        color2="grey-4"
      />
    </div>
  </div>
</template>
