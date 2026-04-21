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
  readOnly?: boolean
  error?: boolean
  helperText?: string
  placeholder?: string
  className?: string
  fullWidth?: boolean
}

const CNPJInput = forwardRef<HTMLInputElement, Props>(
  ({ label, value, onChange, onBlur, name, disabled, readOnly, error, helperText, placeholder = '__.___.___/____-__', className, fullWidth = false }, ref) => {
    const handleValueChange = (values: any) => {
      const { value: rawValue } = values
      onChange(rawValue)
    }

    return (
      <PatternFormat
        value={value ?? ''}
        format='##.###.###/####-##'
        mask='_'
        allowEmptyFormatting={false}
        customInput={FormInput}
        onValueChange={handleValueChange}
        onBlur={onBlur}
        name={name}
        disabled={disabled}
        readOnly={readOnly}
        label={label}
        placeholder={placeholder}
        fullWidth={fullWidth}
        className={className}
        error={error}
        helperText={helperText}
        getInputRef={ref}
      />
    )
  }
)

CNPJInput.displayName = 'CNPJInput'

export default CNPJInput
