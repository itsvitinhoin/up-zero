import {
  endOfMonth,
  endOfYear,
  format,
  startOfDay,
  startOfMonth,
  startOfYear,
  subDays,
  subMonths,
  subYears,
} from 'date-fns'

export type DatePeriodPreset =
  | 'all'
  | 'yesterday'
  | '7d'
  | '14d'
  | '30d'
  | 'this_month'
  | 'last_month'
  | 'this_year'
  | 'last_year'
  | 'custom'

export const DATE_PERIOD_PRESET_OPTIONS: DatePeriodPreset[] = [
  'all',
  'yesterday',
  '7d',
  '14d',
  '30d',
  'this_month',
  'last_month',
  'this_year',
  'last_year',
  'custom',
]

export const DATE_PERIOD_LABELS: Record<DatePeriodPreset, string> = {
  all: 'Todos os Períodos',
  yesterday: 'Ontem',
  '7d': '7 dias',
  '14d': '14 dias',
  '30d': '30 dias',
  this_month: 'Este mês',
  last_month: 'Mês passado',
  this_year: 'Este ano',
  last_year: 'Ano passado',
  custom: 'Período personalizado',
}

function formatDateISO(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

export function getDateRangeForPreset(preset: DatePeriodPreset): { from: string; to: string } {
  const today = startOfDay(new Date())

  switch (preset) {
    case 'all':
      return { from: '', to: '' }
    case 'yesterday': {
      const day = subDays(today, 1)
      const value = formatDateISO(day)
      return { from: value, to: value }
    }
    case '7d':
      return { from: formatDateISO(subDays(today, 6)), to: formatDateISO(today) }
    case '14d':
      return { from: formatDateISO(subDays(today, 13)), to: formatDateISO(today) }
    case '30d':
      return { from: formatDateISO(subDays(today, 29)), to: formatDateISO(today) }
    case 'this_month':
      return { from: formatDateISO(startOfMonth(today)), to: formatDateISO(today) }
    case 'last_month': {
      const previousMonth = subMonths(today, 1)
      return {
        from: formatDateISO(startOfMonth(previousMonth)),
        to: formatDateISO(endOfMonth(previousMonth)),
      }
    }
    case 'this_year':
      return { from: formatDateISO(startOfYear(today)), to: formatDateISO(today) }
    case 'last_year': {
      const previousYear = subYears(today, 1)
      return {
        from: formatDateISO(startOfYear(previousYear)),
        to: formatDateISO(endOfYear(previousYear)),
      }
    }
    case 'custom':
      return { from: '', to: '' }
  }
}

const MATCHABLE_PRESETS: DatePeriodPreset[] = [
  'yesterday',
  '7d',
  '14d',
  '30d',
  'this_month',
  'last_month',
  'this_year',
  'last_year',
]

export function detectDatePeriodPreset(from: string, to: string): DatePeriodPreset {
  if (!from && !to) return 'all'

  for (const preset of MATCHABLE_PRESETS) {
    const range = getDateRangeForPreset(preset)
    if (range.from === from && range.to === to) return preset
  }

  return 'custom'
}

export function parseDateInput(value: string): Date | undefined {
  if (!value) return undefined
  const parsed = new Date(`${value}T00:00:00`)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}
