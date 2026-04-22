import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-primary text-primary-foreground [a&]:hover:bg-primary/90',
        secondary:
          'border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90',
        destructive:
          'border-transparent bg-destructive text-white [a&]:hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60',
        outline:
          'text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground',
        emerald:
          'border border-emerald-100 bg-emerald-50 text-emerald-600 dark:bg-emerald-950/35 dark:text-emerald-300 dark:border-emerald-900',
        amber:
          'border border-amber-100 bg-amber-50 text-amber-600 dark:bg-amber-950/35 dark:text-amber-300 dark:border-amber-900',
        blue:
          'border border-blue-100 bg-blue-50 text-blue-600 dark:bg-blue-950/35 dark:text-blue-300 dark:border-blue-900',
        sky:
          'border border-sky-100 bg-sky-50 text-sky-600 dark:bg-sky-950/35 dark:text-sky-300 dark:border-sky-900',
        rose:
          'border border-rose-100 bg-rose-50 text-rose-600 dark:bg-rose-950/35 dark:text-rose-300 dark:border-rose-900',
        violet:
          'border border-violet-100 bg-violet-50 text-violet-600 dark:bg-violet-950/35 dark:text-violet-300 dark:border-violet-900',
        slate:
          'border border-slate-100 bg-slate-50 text-slate-600 dark:bg-slate-900/60 dark:text-slate-300 dark:border-slate-800',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<'span'> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'span'

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
