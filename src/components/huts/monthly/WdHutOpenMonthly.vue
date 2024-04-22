<script setup lang="ts">
import { ref, defineProps, withDefaults } from 'vue';
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

const unknown_type_icon = ref('wd-question-mark');
const hutAnswerIcons = ref<Record<schemasWodore['AnswerEnum'], string[]>>({
  yes: ['img:' + props.type_open?.symbol],
  no: [getClosedIcon()],
  maybe: ['img:' + props.type_open?.symbol, getClosedIcon()],
  unknown: [unknown_type_icon.value],
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
  return props.type_closed
    ? 'img:' + props.type_closed.symbol
    : unknown_type_icon.value;
  //: 'fa-solid fa-question';
}
</script>
<style scoped></style>
<template>
  <div v-if="props.open_monthly">
    <div class="text-subtitle1 text-accent">{{ $t('hut_type') }}</div>
    <div class="row q-gutter-xs">
      <div v-for="m in monthList" :key="m" class="col-auto">
        <WdMonthly :icons="monthOpenIcon(m)" :month="m" />
      </div>
    </div>

    <!-- <div class="text-subtitle1 text-accent">{{ $t('hut_type') }}</div>
    <q-scroll-area style="height: 70px" class="q-ma-xs q-mt-md">
      <q-markup-table dense flat separator="vertical">
        <thead>
          <tr>
            <th v-for="m in monthNames" :key="m[0]" class="text-center">
              {{ m[1] }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="monthNames">
            <td v-for="m in monthNames" :key="m[0]" class="text-center">
              <q-icon
                v-for="img in hutAnswerIcons[
                  props.open_monthly['month_' + m[0]] as
                    | 'yes'
                    | 'maybe'
                    | 'no'
                    | 'unknown'
                ]"
                :key="img"
                :name="img"
                size="20px"
              />
            </td>
          </tr>
        </tbody>
      </q-markup-table>
    </q-scroll-area> -->
  </div>
</template>
