import React, { useEffect, useMemo, useState } from 'react'
import { NumericFormat, type NumberFormatValues } from 'react-number-format'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

type CurrencyInputProps = {
  label?: string
  value: number | null
  onChange: (value: number | null) => void

  locale?: string // ex: 'pt-BR', 'en-US', 'ko-KR', 'ja-JP'
  currency?: string // ex: 'BRL', 'USD', 'KRW', 'JPY'
  decimals?: number // se não passar, usa padrão do currency (JPY/KRW = 0)

  className?: string
  disabled?: boolean
  fullWidth?: boolean

  allowNegative?: boolean
  min?: number
  max?: number

  // repassa props pro TextField
  error?: boolean
  helperText?: React.ReactNode
  placeholder?: string
}

function getCurrencyFractionDigits(locale: string, currency: string) {
  try {
    const parts = new Intl.NumberFormat(locale, { style: 'currency', currency }).resolvedOptions()
    return parts.maximumFractionDigits ?? 2
  } catch {
    return ['JPY', 'KRW'].includes(currency) ? 0 : 2
  }
}

function getSeparators(locale: string) {
  const parts = new Intl.NumberFormat(locale).formatToParts(1000.1)
  const group = parts.find(p => p.type === 'group')?.value ?? ','
  const decimal = parts.find(p => p.type === 'decimal')?.value ?? '.'
  return { group, decimal }
}

function getCurrencyPrefix(locale: string, currency: string) {
  const parts = new Intl.NumberFormat(locale, { style: 'currency', currency }).formatToParts(0)
  const currencyPartIndex = parts.findIndex(p => p.type === 'currency')
  if (currencyPartIndex === -1) return { prefix: '', suffix: '' }

  const firstIntegerIndex = parts.findIndex(p => p.type === 'integer')
  const lastIntegerIndex = parts.map(p => p.type).lastIndexOf('integer')

  if (firstIntegerIndex !== -1) {
    const prefix = parts
      .slice(0, firstIntegerIndex)
      .filter(part => part.type !== 'decimal' && part.type !== 'fraction')
      .map(p => p.value)
      .join('')
    const suffix = parts
      .slice(lastIntegerIndex + 1)
      .filter(part => part.type !== 'decimal' && part.type !== 'fraction')
      .map(p => p.value)
      .join('')
    return { prefix, suffix }
  }

  const safeParts = parts.filter(part => part.type !== 'decimal' && part.type !== 'fraction')
  return { prefix: safeParts.map(p => p.value).join(''), suffix: '' }
}

export default function CurrencyInput({
  label,
  value,
  onChange,
  locale = 'pt-BR',
  currency = 'BRL',
  decimals,
  disabled,
  fullWidth = true,
  className,

  allowNegative = false,
  min,
  max,

  error,
  helperText,
  placeholder
}: CurrencyInputProps) {
  const coerceToNumber = (v: unknown): number | null => {
    if (typeof v === 'number' && Number.isFinite(v)) return v
    if (typeof v === 'string') {
      const n = Number(v)
      if (Number.isFinite(n)) return n
    }
    return null
  }

  const { group, decimal } = useMemo(() => getSeparators(locale), [locale])

  const fractionDigits = useMemo(() => {
    if (typeof decimals === 'number') return decimals
    return getCurrencyFractionDigits(locale, currency)
  }, [decimals, locale, currency])

  const computedPlaceholder = useMemo(() => {
    if (placeholder) return placeholder
    return ''
  }, [placeholder])

  const numericString = useMemo(() => {
    const n = coerceToNumber(value as unknown)
    if (n == null || n === 0) return ''
    try {
      return n.toFixed(fractionDigits)
    } catch {
      return ''
    }
  }, [value, fractionDigits])

  const [rawValue, setRawValue] = useState<string>(numericString)
  const [lastValidValue, setLastValidValue] = useState<number | null>(value ?? null)

  useEffect(() => {
    setRawValue(prev => (prev === numericString ? prev : numericString))
    setLastValidValue(value ?? null)
  }, [numericString, value])

  const { prefix, suffix } = useMemo(
    () => getCurrencyPrefix(locale, currency),
    [locale, currency]
  )

  const adornments = useMemo(() => {
    const trimmedPrefix = prefix.trim()
    const trimmedSuffix = suffix.trim()

    return {
      start: trimmedPrefix || prefix || '',
      end: trimmedSuffix || suffix || ''
    }
  }, [prefix, suffix])

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
        {adornments.start ? (
          <span className='pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground'>
            {adornments.start}
          </span>
        ) : null}
        <NumericFormat
          value={rawValue}
          valueIsNumericString
          thousandSeparator={group}
          decimalSeparator={decimal}
          decimalScale={fractionDigits}
          fixedDecimalScale={fractionDigits > 0}
          allowNegative={allowNegative}
          isAllowed={(vals: NumberFormatValues) => {
            const v = vals.floatValue
            if (v == null) return true
            if (!allowNegative && v < 0) return false
            if (typeof min === 'number' && v < min) return false
            if (typeof max === 'number' && v > max) return false
            return true
          }}
          customInput={Input as React.ComponentType<any>}
          disabled={disabled}
          aria-invalid={error || undefined}
          placeholder={computedPlaceholder}
          inputMode='decimal'
          className={cn('text-right', adornments.start && 'pl-10', adornments.end && 'pr-10')}
          onValueChange={(vals: NumberFormatValues) => {
            const nextRaw = vals.value ?? ''
            setRawValue(nextRaw)

            if (vals.floatValue == null) {
              onChange(null)
              return
            }

            setLastValidValue(vals.floatValue)
            onChange(vals.floatValue)
          }}
        />
        {adornments.end ? (
          <span className='pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground'>
            {adornments.end}
          </span>
        ) : null}
      </div>
      {resolvedHelperText ? (
        <p className={cn('text-xs', error ? 'text-destructive' : 'text-muted-foreground')}>{resolvedHelperText}</p>
      ) : null}
    </div>
  )
}