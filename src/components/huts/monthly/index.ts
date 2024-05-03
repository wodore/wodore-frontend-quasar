import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { schemasWodore } from '@clients/index';
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

export type TypeIconText = 'closed' | 'open' | 'unknown' | undefined;
export type TypeMonthIcons = {
  main0: TypeIconText;
  main1?: TypeIconText;
  minor?: TypeIconText;
};
export type TypeMonthIconsPath = {
  main0: string;
  main1?: string;
  minor?: string;
};

export type TypeIconSwitch = Record<
  schemasWodore['AnswerEnum'],
  Record<'maybe', Record<schemasWodore['AnswerEnum'], TypeMonthIcons>>
>;
export const iconSwitch: Record<schemasWodore['AnswerEnum'], TypeMonthIcons> = {
  yes: { main0: 'open' },
  no: { main0: 'closed' },
  maybe: { main0: 'open', main1: 'closed' },
  unknown: { main0: 'unknown' },
};
// prev: {current : {next: {values}}}
export const iconMaybeSwitch: TypeIconSwitch = {
  yes: {
    maybe: {
      yes: { main0: 'open', minor: 'closed' },
      no: { main0: 'open', main1: 'closed' },
      maybe: { main0: 'open', minor: 'closed' },
      unknown: { main0: 'open', minor: 'closed' },
    },
  },
  no: {
    maybe: {
      yes: { main0: 'closed', main1: 'open' },
      no: { main0: 'closed', minor: 'open' },
      maybe: { main0: 'closed', minor: 'open' },
      unknown: { main0: 'closed', minor: 'open' },
    },
  },
  maybe: {
    maybe: {
      yes: { main0: 'open', minor: 'closed' },
      no: { main0: 'closed', minor: 'open' },
      maybe: { main0: 'open', minor: 'closed' },
      unknown: { main0: 'open', minor: 'closed' },
    },
  },
  unknown: {
    maybe: {
      yes: { main0: 'open', minor: 'closed' },
      no: { main0: 'closed', minor: 'open' },
      maybe: { main0: 'open', minor: 'closed' },
      unknown: { main0: 'open', minor: 'closed' },
    },
  },
};
