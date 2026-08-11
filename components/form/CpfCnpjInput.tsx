import { forwardRef, useMemo } from 'react'
import { PatternFormat } from 'react-number-format'
import FormInput from '@/components/form/FormInput'

type Props = {
  label?: string
  value?: string
  onChange: (value: string) => void
  onBlur?: React.FocusEventHandler<HTMLInputElement>
  name?: string
  disabled?: boolean
  error?: boolean
  helperText?: string
  placeholder?: string
  className?: string
  fullWidth?: boolean
}

function digitsOnly(value?: string): string {
  return (value ?? '').replace(/\D/g, '').slice(0, 14)
}

const CpfCnpjInput = forwardRef<HTMLInputElement, Props>(
  (
    {
      label,
      value,
      onChange,
      onBlur,
      name,
      disabled,
      error,
      helperText,
      placeholder,
      className,
      fullWidth = false,
    },
    ref,
  ) => {
    const digits = digitsOnly(value)
    const isCnpj = digits.length > 11

    const format = useMemo(
      () => (isCnpj ? '##.###.###/####-##' : '###.###.###-##'),
      [isCnpj],
    )

    const resolvedPlaceholder =
      placeholder ?? (isCnpj ? '__.___.___/____-__' : '___.___.___-__')

    return (
      <PatternFormat
        value={digits}
        format={format}
        mask="_"
        allowEmptyFormatting={false}
        customInput={FormInput}
        onValueChange={(values) => onChange(digitsOnly(values.value))}
        onBlur={onBlur}
        name={name}
        disabled={disabled}
        label={label}
        placeholder={resolvedPlaceholder}
        fullWidth={fullWidth}
        className={className}
        error={error}
        helperText={helperText}
        getInputRef={ref}
      />
    )
  },
)

CpfCnpjInput.displayName = 'CpfCnpjInput'

export default CpfCnpjInput
