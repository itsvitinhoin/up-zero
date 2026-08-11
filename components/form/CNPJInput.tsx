import { forwardRef } from 'react'
import { PatternFormat } from 'react-number-format'
import { Loader2, Search } from 'lucide-react'
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
  onLookup?: () => void
  lookupLoading?: boolean
  lookupDisabled?: boolean
  lookupTitle?: string
}

const CNPJInput = forwardRef<HTMLInputElement, Props>(
  ({
    label,
    value,
    onChange,
    onBlur,
    name,
    disabled,
    readOnly,
    error,
    helperText,
    placeholder = '__.___.___/____-__',
    className,
    fullWidth = false,
    onLookup,
    lookupLoading = false,
    lookupDisabled = false,
    lookupTitle = 'Buscar dados na ReceitaWS',
  }, ref) => {
    const handleValueChange = (values: any) => {
      const { value: rawValue } = values
      onChange(rawValue)
    }

    const canLookup = Boolean(onLookup)

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
        InputProps={canLookup ? {
          endAdornment: (
            <button
              type="button"
              onClick={onLookup}
              disabled={disabled || readOnly || lookupLoading || lookupDisabled}
              title={lookupTitle}
              aria-label={lookupTitle}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              {lookupLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </button>
          ),
        } : undefined}
        getInputRef={ref}
      />
    )
  }
)

CNPJInput.displayName = 'CNPJInput'

export default CNPJInput
