import { forwardRef } from 'react'
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

const ZipcodeInput = forwardRef<HTMLInputElement, Props>(
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
      placeholder = '_____-___',
      className,
      fullWidth = false,
    },
    ref,
  ) => {
    const handleValueChange = (values: { value: string }) => {
      onChange(values.value)
    }

    return (
      <PatternFormat
        value={value ?? ''}
        format='#####-###'
        mask='_'
        allowEmptyFormatting={false}
        customInput={FormInput}
        onValueChange={handleValueChange}
        onBlur={onBlur}
        name={name}
        disabled={disabled}
        label={label}
        placeholder={placeholder}
        fullWidth={fullWidth}
        className={className}
        error={error}
        helperText={helperText}
        getInputRef={ref}
      />
    )
  },
)

ZipcodeInput.displayName = 'ZipcodeInput'

export default ZipcodeInput