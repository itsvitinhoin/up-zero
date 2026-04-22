import { forwardRef, useState, useEffect } from 'react'
import { NumericFormat, type NumberFormatValues } from 'react-number-format'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

type Props = {
  label?: string
  value?: number | null
  onChange: (value: number | null) => void
  error?: boolean
  helperText?: string
  placeholder?: string
  className?: string
  inputClassName?: string
  fullWidth?: boolean
  min?: number
  max?: number
  disabled?: boolean
}

const IntegerInput = forwardRef<HTMLInputElement, Props>(
  ({ 
    label, 
    value, 
    onChange, 
    error, 
    helperText, 
    placeholder = '', 
    className, 
    inputClassName,
    fullWidth = false,
    min = 0,
    max,
    disabled = false
  }, ref) => {
    const [rawValue, setRawValue] = useState<string>(
      value != null && value !== 0 ? String(value) : ''
    )

    useEffect(() => {
      const nextValue = value != null && value !== 0 ? String(value) : ''
      setRawValue(prev => prev === nextValue ? prev : nextValue)
    }, [value])

    const handleValueChange = (values: NumberFormatValues) => {
      const { value: strValue, floatValue } = values
      setRawValue(strValue ?? '')
      onChange(floatValue ?? null)
    }

    return (
      <div className={cn(label || helperText ? 'space-y-2' : 'space-y-0', fullWidth && 'w-full', className)}>
        {label ? <Label>{label}</Label> : null}
        <NumericFormat
          value={rawValue}
          valueIsNumericString
          customInput={Input as React.ComponentType<any>}
          onValueChange={handleValueChange}
          placeholder={placeholder}
          getInputRef={ref}
          disabled={disabled}
          allowNegative={false}
          decimalScale={0}
          fixedDecimalScale={false}
          thousandSeparator={false}
          isAllowed={(vals: NumberFormatValues) => {
            const v = vals.floatValue
            if (v == null) return true
            if (typeof min === 'number' && v < min) return false
            if (typeof max === 'number' && v > max) return false
            return true
          }}
          className={cn('text-right', inputClassName)}
          aria-invalid={error || undefined}
        />
        {helperText ? (
          <p className={cn('text-xs', error ? 'text-destructive' : 'text-muted-foreground')}>{helperText}</p>
        ) : null}
      </div>
    )
  }
)

IntegerInput.displayName = 'IntegerInput'

export default IntegerInput
