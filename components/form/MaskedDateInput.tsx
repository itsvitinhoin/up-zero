import { useEffect, useMemo, useState, forwardRef } from 'react'
import AppReactDatepicker from '@/libs/styles/AppReactDatepicker'
import { PatternFormat as PF } from 'react-number-format'
import FormInput from '@/components/form/FormInput'

const CustomTextField = FormInput

type Props = {
  label: string
  value?: string
  onChange: (value: string) => void
  min?: string
  max?: string
  placeholder?: string
  className?: string
}

type MaskedTextFieldProps = React.ComponentProps<typeof CustomTextField> & {
  onCalendarClick?: () => void
}

const MaskedTextField = forwardRef<HTMLInputElement, MaskedTextFieldProps>(function MaskedTextField(
  { onCalendarClick, InputProps, className, ...rest },
  ref
) {
  return (
    <CustomTextField
      {...rest}
      size='small'
      className={`w-35 ${className ?? ''}`}
      InputProps={{
        endAdornment: (
          <button
            type='button'
            onClick={e => {
              e.preventDefault()
              e.stopPropagation()
              onCalendarClick?.()
            }}
            className='inline-flex h-7 w-7 items-center justify-center rounded-md p-1 text-muted-foreground hover:bg-muted'
          >
            <i className='tabler-calendar' />
          </button>
        ),
        ...InputProps
      }}
      getInputRef={ref}
    />
  )
})

const parseDate = (s?: string | null): Date | undefined => {
  if (!s || s.includes('_')) return undefined
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!match) return undefined
  const [, y, m, d] = match
  const date = new Date(`${y}-${m}-${d}T00:00:00`)
  return isNaN(date.getTime()) ? undefined : date
}

const formatDate = (d: Date | null): string => {
  if (!d) return ''
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).toISOString().slice(0, 10)
}

const MaskedDateInput = ({ label, value, onChange, min, max, placeholder = 'YYYY-MM-DD', className }: Props) => {
  const [open, setOpen] = useState(false)
  const [inputValue, setInputValue] = useState(value ?? '')

  useEffect(() => {
    const next = value ?? ''
    if (next !== inputValue) setInputValue(next)
  }, [value, inputValue])

  const minDate = useMemo(() => parseDate(min), [min])
  const maxDate = useMemo(() => parseDate(max), [max])
  const selected = useMemo(() => parseDate(value) ?? null, [value])

  const CustomInput = useMemo(
    () =>
      forwardRef<HTMLInputElement, any>((params, ref) => (
        <MaskedTextField
          {...params}
          label={label}
          placeholder={placeholder}
          className={className}
          onCalendarClick={() => setOpen(true)}
          ref={ref}
        />
      )),
    [label, placeholder, className]
  )

  const commitValue = (str: string) => {
    if (!str || str === '____-__-__') {
      if ((value ?? '') !== '') onChange('')
      setInputValue('')
      return
    }

    if (!str.includes('_') && /^\d{4}-\d{2}-\d{2}$/.test(str)) {
      const parsed = parseDate(str)
      if (parsed) {
        if (str !== value) onChange(str)
        setInputValue(str)
      }
    }
  }

  return (
    <AppReactDatepicker
      open={open}
      onCalendarClose={() => setOpen(false)}
      onClickOutside={() => setOpen(false)}
      selected={selected}
      onChange={(date: Date | null) => {
        const str = formatDate(date)
        setInputValue(str)
        onChange(str)
        setOpen(false)
      }}
      minDate={minDate}
      maxDate={maxDate}
      dateFormat='yyyy-MM-dd'
      preventOpenOnFocus
      shouldCloseOnSelect
      customInput={
        <PF
          value={inputValue}
          format='####-##-##'
          mask='_'
          type='text'
          allowEmptyFormatting={false}
          customInput={CustomInput}
          onValueChange={(vals: any) => {
            const nextValue = vals.formattedValue as string
            setInputValue(nextValue)

            if (!nextValue || nextValue === '____-__-__') {
              if ((value ?? '') !== '') onChange('')
              return
            }

            if (!nextValue.includes('_') && /^\d{4}-\d{2}-\d{2}$/.test(nextValue)) {
              if (nextValue !== value) onChange(nextValue)
            }
          }}
          onBlur={() => commitValue(inputValue)}
        />
      }
    />
  )
}

export default MaskedDateInput