'use client'

import { useEffect, useMemo, useState } from 'react'
import { differenceInCalendarDays, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { DateRange } from 'react-day-picker'
import { CalendarIcon } from 'lucide-react'

import { Calendar } from '@/components/ui/calendar'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DATE_PERIOD_LABELS,
  DATE_PERIOD_PRESET_OPTIONS,
  detectDatePeriodPreset,
  getDateRangeForPreset,
  parseDateInput,
  type DatePeriodPreset,
} from '@/lib/date-period-presets'
import { cn } from '@/lib/utils'

interface DatePeriodFilterProps {
  fromDate: string
  toDate: string
  onChange: (from: string, to: string) => void
  triggerClassName?: string
}

function toDateRange(from: string, to: string): DateRange | undefined {
  if (!from && !to) return undefined
  return {
    from: parseDateInput(from),
    to: parseDateInput(to),
  }
}

function getDisplayLabel(fromDate: string, toDate: string, preset: DatePeriodPreset): string {
  if (preset === 'custom' && fromDate && toDate) {
    const from = parseDateInput(fromDate)
    const to = parseDateInput(toDate)
    if (from && to) {
      return `${format(from, 'dd/MM/yy', { locale: ptBR })} – ${format(to, 'dd/MM/yy', { locale: ptBR })}`
    }
  }

  return DATE_PERIOD_LABELS[preset]
}

export default function DatePeriodFilter({
  fromDate,
  toDate,
  onChange,
  triggerClassName,
}: DatePeriodFilterProps) {
  const activePreset = useMemo(
    () => detectDatePeriodPreset(fromDate, toDate),
    [fromDate, toDate],
  )
  const [customDialogOpen, setCustomDialogOpen] = useState(false)
  const [draftRange, setDraftRange] = useState<DateRange | undefined>(() => toDateRange(fromDate, toDate))

  useEffect(() => {
    if (!customDialogOpen) {
      setDraftRange(toDateRange(fromDate, toDate))
    }
  }, [customDialogOpen, fromDate, toDate])

  const displayLabel = getDisplayLabel(fromDate, toDate, activePreset)
  const selectedDays = draftRange?.from && draftRange?.to
    ? differenceInCalendarDays(draftRange.to, draftRange.from) + 1
    : null

  const handlePresetChange = (value: string) => {
    const preset = value as DatePeriodPreset

    if (preset === 'custom') {
      setDraftRange(toDateRange(fromDate, toDate))
      setCustomDialogOpen(true)
      return
    }

    const range = getDateRangeForPreset(preset)
    onChange(range.from, range.to)
  }

  const handleApplyCustomRange = () => {
    if (!draftRange?.from || !draftRange?.to) return

    onChange(
      format(draftRange.from, 'yyyy-MM-dd'),
      format(draftRange.to, 'yyyy-MM-dd'),
    )
    setCustomDialogOpen(false)
  }

  return (
    <>
      <Select value={activePreset} onValueChange={handlePresetChange}>
        <SelectTrigger className={cn('h-10 w-full rounded-full sm:w-auto xl:w-48', triggerClassName)}>
          <div className="flex min-w-0 items-center gap-2">
            <CalendarIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
            <SelectValue placeholder="Período">
              <span className="truncate">{displayLabel}</span>
            </SelectValue>
          </div>
        </SelectTrigger>
        <SelectContent align="start">
          {DATE_PERIOD_PRESET_OPTIONS.map((preset) => (
            <SelectItem key={preset} value={preset}>
              {DATE_PERIOD_LABELS[preset]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Dialog open={customDialogOpen} onOpenChange={setCustomDialogOpen}>
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[720px]">
          <DialogHeader className="space-y-1 border-b px-6 py-5 text-left">
            <DialogTitle>Período personalizado</DialogTitle>
            <DialogDescription>
              {selectedDays
                ? `${selectedDays} ${selectedDays === 1 ? 'dia selecionado' : 'dias selecionados'}`
                : 'Selecione a data inicial e a data final'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-center overflow-x-auto p-4 sm:p-6">
            <Calendar
              mode="range"
              defaultMonth={draftRange?.from ?? draftRange?.to}
              selected={draftRange}
              onSelect={setDraftRange}
              numberOfMonths={2}
              disabled={(date) => date > new Date() || date < new Date('1900-01-01')}
            />
          </div>

          {draftRange?.from && draftRange?.to ? (
            <div className="border-t px-6 py-3 text-sm text-muted-foreground">
              {format(draftRange.from, "d 'de' MMMM", { locale: ptBR })}
              {' – '}
              {format(draftRange.to, "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </div>
          ) : null}

          <DialogFooter className="gap-3 border-t px-6 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCustomDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleApplyCustomRange}
              disabled={!draftRange?.from || !draftRange?.to}
            >
              Aplicar período
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
