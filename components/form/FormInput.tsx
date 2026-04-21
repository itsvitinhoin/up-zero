import { forwardRef } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

type FormInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string
  error?: boolean
  helperText?: string
  fullWidth?: boolean
  select?: boolean
  children?: React.ReactNode
  InputProps?: {
    endAdornment?: React.ReactNode
  }
}

const FormInput = forwardRef<HTMLInputElement, FormInputProps>(
  ({ label, error, helperText, fullWidth = false, className, select = false, children, InputProps, ...props }, ref) => {
    const baseClassName = cn(
      'file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
      'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
      'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
      error ? 'border-destructive' : '',
      InputProps?.endAdornment ? 'pr-10' : '',
      className || ''
    )

    return (
      <div className={`space-y-2 ${fullWidth ? 'w-full' : ''}`}>
        {label && <Label htmlFor={props.id}>{label}</Label>}
        <div className="relative">
          {select ? (
            <select
              ref={ref as React.Ref<HTMLSelectElement>}
              className={baseClassName}
              aria-invalid={error}
              {...(props as React.SelectHTMLAttributes<HTMLSelectElement>)}
            >
              {children}
            </select>
          ) : (
            <Input
              ref={ref}
              className={baseClassName}
              aria-invalid={error}
              {...props}
            />
          )}
          {InputProps?.endAdornment && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              {InputProps.endAdornment}
            </div>
          )}
        </div>
        {(error || helperText) && (
          <p className={`text-sm flex items-center gap-1 ${error ? 'text-destructive' : 'text-muted-foreground'}`}>
            {error && <AlertCircle className="h-3 w-3" />}
            {helperText}
          </p>
        )}
      </div>
    )
  }
)

FormInput.displayName = 'FormInput'

export default FormInput
