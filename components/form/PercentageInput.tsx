import React, { useEffect, useMemo, useState } from 'react'
import { NumericFormat } from 'react-number-format'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

type PercentageInputProps = {
  label?: string
  value: number | null
  onChange: (value: number | null) => void

  locale?: string
  decimals?: number

  className?: string
  disabled?: boolean
  fullWidth?: boolean

  allowNegative?: boolean
  min?: number
  max?: number

  error?: boolean
  helperText?: React.ReactNode
  placeholder?: string
}

function getSeparators(locale: string) {
  const parts = new Intl.NumberFormat(locale).formatToParts(1000.1)
  const group = parts.find(p => p.type === 'group')?.value ?? ','
  const decimal = parts.find(p => p.type === 'decimal')?.value ?? '.'
  return { group, decimal }
}

export default function PercentageInput({
  label,
  value,
  onChange,
  locale = 'pt-BR',
  decimals = 2,
  disabled,
  fullWidth = true,
  className,

  allowNegative = true,
  min,
  max,

  error,
  helperText,
  placeholder
}: PercentageInputProps) {
  const coerceToNumber = (v: unknown): number | null => {
    if (typeof v === 'number' && Number.isFinite(v)) return v
    if (typeof v === 'string') {
      const n = Number(v)
      if (Number.isFinite(n)) return n
    }
    return null
  }

  const { group, decimal } = useMemo(() => getSeparators(locale), [locale])

  const percentDigits = decimals

  const formatPercent = useMemo(() => {
    const formatter = new Intl.NumberFormat(locale, {
      style: 'decimal',
      minimumFractionDigits: percentDigits,
      maximumFractionDigits: percentDigits
    })

    return (numeric: number) => formatter.format(numeric)
  }, [locale, percentDigits])

  const computedPlaceholder = useMemo(() => {
    if (placeholder) return placeholder
    return ''
  }, [placeholder])

  const percentString = useMemo(() => {
    const n = coerceToNumber(value as unknown)
    if (n == null) return ''
    try {
      return (n * 100).toFixed(percentDigits)
    } catch {
      return ''
    }
  }, [value, percentDigits])

  const [rawValue, setRawValue] = useState<string>(percentString)
  const [lastValidValue, setLastValidValue] = useState<number | null>(value ?? null)

  useEffect(() => {
    setRawValue(prev => (prev === percentString ? prev : percentString))
    setLastValidValue(value ?? null)
  }, [percentString, value])

  const resolvedHelperText = useMemo(() => {
    if (typeof helperText === 'string' && helperText.trim().length === 0) {
      return undefined
    }

    return helperText ?? undefined
  }, [helperText])

  return (
    <div className={cn('space-y-2', fullWidth && 'w-full', className)}>
      {label ? <Label>{label}</Label> : null}
      <div className='relative'>
        <NumericFormat
          value={rawValue}
          valueIsNumericString
          thousandSeparator={group}
          decimalSeparator={decimal}
          decimalScale={percentDigits}
          fixedDecimalScale={percentDigits > 0}
          allowNegative={allowNegative}
          isAllowed={vals => {
            const percentValue = vals.floatValue
            if (percentValue == null) return true
            if (!allowNegative && percentValue < 0) return false
            if (typeof min === 'number' && percentValue < min) return false
            if (typeof max === 'number' && percentValue > max) return false
            return true
          }}
          customInput={Input as React.ComponentType<any>}
          disabled={disabled}
          aria-invalid={error || undefined}
          placeholder={computedPlaceholder}
          inputMode='decimal'
          className='pr-8 text-right'
          onValueChange={(vals) => {
            const nextRaw = vals.value ?? ''
            setRawValue(nextRaw)

            if (vals.floatValue == null) {
              onChange(lastValidValue)
              return
            }

            const normalizedValue = vals.floatValue / 100
            setLastValidValue(normalizedValue)
            onChange(normalizedValue)
          }}
        />
        <span className='pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground'>%</span>
      </div>
      {resolvedHelperText ? (
        <p className={cn('text-xs', error ? 'text-destructive' : 'text-muted-foreground')}>{resolvedHelperText}</p>
      ) : null}
    </div>
  )
}
