import React, { useEffect, useMemo, useState } from 'react'
import { NumericFormat, type NumberFormatValues } from 'react-number-format'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

type NumberInputProps = {
  label?: string
  value: number | null
  onChange: (value: number | null) => void

  locale?: string
  decimals?: number
  fixedDecimalScale?: boolean

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

export default function NumberInput({
  label,
  value,
  onChange,
  locale = 'pt-BR',
  decimals,
  fixedDecimalScale = false,
  disabled,
  fullWidth = true,
  className,

  allowNegative = false,
  min,
  max,

  error,
  helperText,
  placeholder
}: NumberInputProps) {
  const coerceToNumber = (v: unknown): number | null => {
    if (typeof v === 'number' && Number.isFinite(v)) return v
    if (typeof v === 'string') {
      const n = Number(v)
      if (Number.isFinite(n)) return n
    }
    return null
  }

  const { group, decimal } = useMemo(() => getSeparators(locale), [locale])

  const decimalScale = typeof decimals === 'number' ? decimals : undefined
  const minFractionDigits = decimalScale ?? 0
  const maxFractionDigits = decimalScale ?? 4

  const formatDecimal = useMemo(() => {
    const formatter = new Intl.NumberFormat(locale, {
      style: 'decimal',
      minimumFractionDigits: minFractionDigits,
      maximumFractionDigits: maxFractionDigits
    })

    return (numeric: number) => formatter.format(numeric)
  }, [locale, minFractionDigits, maxFractionDigits])

  const computedPlaceholder = useMemo(() => {
    if (placeholder) return placeholder
    return formatDecimal(0)
  }, [placeholder, formatDecimal])

  const numericString = useMemo(() => {
    const n = coerceToNumber(value as unknown)
    if (n == null) return ''
    if (decimalScale != null) {
      try {
        return n.toFixed(decimalScale)
      } catch {
        return ''
      }
    }

    return String(n)
  }, [value, decimalScale])

  const [rawValue, setRawValue] = useState<string>(numericString)
  const [lastValidValue, setLastValidValue] = useState<number | null>(value ?? null)

  useEffect(() => {
    setRawValue(prev => (prev === numericString ? prev : numericString))
    setLastValidValue(value ?? null)
  }, [numericString, value])

  const resolvedHelperText = useMemo(() => {
    if (typeof helperText === 'string' && helperText.trim().length === 0) {
      return undefined
    }

    return helperText ?? undefined
  }, [helperText])

  return (
    <div className={cn('space-y-2', fullWidth && 'w-full', className)}>
      {label ? <Label>{label}</Label> : null}
      <NumericFormat
        value={rawValue}
        valueIsNumericString
        thousandSeparator={group}
        decimalSeparator={decimal}
        decimalScale={decimalScale}
        fixedDecimalScale={fixedDecimalScale && decimalScale != null}
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
        className='text-right'
        onValueChange={(vals: NumberFormatValues) => {
          const nextRaw = vals.value ?? ''
          setRawValue(nextRaw)

          if (vals.floatValue == null) {
            onChange(lastValidValue)
            return
          }

          setLastValidValue(vals.floatValue)
          onChange(vals.floatValue)
        }}
      />
      {resolvedHelperText ? (
        <p className={cn('text-xs', error ? 'text-destructive' : 'text-muted-foreground')}>{resolvedHelperText}</p>
      ) : null}
    </div>
  )
}
