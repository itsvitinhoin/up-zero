import { useEffect, useRef, useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

export const DebouncedInput = ({
  value: initialValue,
  onChange,
  debounce = 250,
  label,
  helperText,
  error,
  className,
  ...props
}: {
  value: string | number
  onChange: (value: string | number) => void
  debounce?: number
  label?: string
  helperText?: string
  error?: boolean
  className?: string
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'>) => {
  const [value, setValue] = useState(initialValue)
  const cbRef = useRef(onChange)

  useEffect(() => {
    cbRef.current = onChange
  }, [onChange])

  useEffect(() => {
    setValue(initialValue)
  }, [initialValue])

  const firstRun = useRef(true)
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false
      return
    }
    const t = setTimeout(() => cbRef.current(value), debounce)
    return () => clearTimeout(t)
  }, [value, debounce])

  return (
    <div className={cn('space-y-2', className)}>
      {label && <Label>{label}</Label>}
      <Input
        {...props}
        value={value}
        onChange={e => setValue((e.target as HTMLInputElement).value)}
        aria-invalid={error || undefined}
      />
      {helperText ? (
        <p className={cn('text-xs', error ? 'text-destructive' : 'text-muted-foreground')}>{helperText}</p>
      ) : null}
    </div>
  )
}