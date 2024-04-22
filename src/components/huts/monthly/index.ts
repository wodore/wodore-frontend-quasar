import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
export type TypeMonths =
  | '01'
  | '02'
  | '03'
  | '04'
  | '05'
  | '06'
  | '07'
  | '08'
  | '09'
  | '10'
  | '11'
  | '12';

export const monthList: Array<TypeMonths> = [
  '01',
  '02',
  '03',
  '04',
  '05',
  '06',
  '07',
  '08',
  '09',
  '10',
  '11',
  '12',
];

export function useMonthly() {
  const { t } = useI18n();
  const monthNames = ref<Record<TypeMonths, string>>({
    '01': t('jan'),
    '02': t('feb'),
    '03': t('mar'),
    '04': t('apr'),
    '05': t('may'),
    '06': t('jun'),
    '07': t('jul'),
    '08': t('aug'),
    '09': t('sep'),
    '10': t('oct'),
    '11': t('nov'),
    '12': t('dec'),
  });

  function getMonthName(month: TypeMonths): string {
    return monthNames.value[month];
  }
  return { monthList, monthNames, getMonthName };
}
