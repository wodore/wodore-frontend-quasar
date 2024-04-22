<script setup lang="ts">
import { ref, defineProps, withDefaults } from 'vue';
//import { HutTypeSchema, OpenMonthlySchema } from '@/clients/wodore_v1';
//import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
//import { useHutTypesStore } from '../../stores/huts/hut-types-store';
//import HutType from './HutType.vue';
const { t } = useI18n();
import { schemasWodore } from 'src/clients';

interface Props {
  open_monthly?: schemasWodore['HutSchemaDetails']['open_monthly'];
  type_open?: schemasWodore['HutSchemaDetails']['type_open'];
  type_closed?: schemasWodore['HutSchemaDetails']['type_closed'];
}

//const { hutTypesRecords } = storeToRefs(useHutTypesStore());

const props = withDefaults(defineProps<Props>(), {});
const months = ref([
  ['01', t('jan')],
  ['02', t('feb')],
  ['03', t('mar')],
  ['04', t('apr')],
  ['05', t('may')],
  ['06', t('jun')],
  ['07', t('jul')],
  ['08', t('aug')],
  ['09', t('sep')],
  ['10', t('oct')],
  ['01', t('nov')],
  ['12', t('dec')],
]);

const unknown_type_icon = ref('wd-question-mark');
//watch(
//  () => hutTypesRecords,
//  (hutTypes) => {
//    if (hutTypes.value['unknown']) {
//      unknown_type_icon.value = 'img:' + hutTypes.value['unknown'].symbol;
//    } else {
//      unknown_type_icon.value = 'fa-solid fa-question';
//    }
//  },
//  { immediate: true },
//);
function get_closed() {
  return props.type_closed
    ? 'img:' + props.type_closed.symbol
    : unknown_type_icon.value;
  //: 'fa-solid fa-question';
}

const months_hut = ref({
  yes: ['img:' + props.type_open?.symbol],
  no: [get_closed()],
  maybe: [get_closed(), 'img:' + props.type_open?.symbol],
  unknown: [unknown_type_icon.value],
});
</script>
<style scoped></style>
<template>
  <div v-if="props.open_monthly">
    <div class="text-subtitle1 text-accent">{{ $t('hut_type') }}</div>
    <q-scroll-area style="height: 70px" class="q-ma-xs q-mt-md">
      <q-markup-table dense flat separator="vertical">
        <thead>
          <tr>
            <th v-for="m in months" :key="m[0]" class="text-center">
              {{ m[1] }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="months">
            <td v-for="m in months" :key="m[0]" class="text-center">
              <q-icon
                v-for="img in months_hut[
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
    </q-scroll-area>
  </div>
</template>
