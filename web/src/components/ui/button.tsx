import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva } from 'class-variance-authority'
import type { VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  "relative isolate overflow-hidden inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive:
          'bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60',
        outline:
          'border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost:
          'hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2 has-[>svg]:px-3',
        xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: 'h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5',
        lg: 'h-10 rounded-md px-6 has-[>svg]:px-4',
        icon: 'size-9',
        'icon-xs': "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        'icon-sm': 'size-8',
        'icon-lg': 'size-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : 'button'
  const { onClick, disabled, ...restProps } = props

  const handleClick = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      onClick?.(event)
      if (event.defaultPrevented || disabled || variant === 'link') return
      if (event.button !== 0) return

      const target = event.currentTarget
      const rect = target.getBoundingClientRect()
      const rippleSize = Math.max(rect.width, rect.height) * 2
      const isKeyboardClick = event.clientX === 0 && event.clientY === 0
      const clientX = isKeyboardClick
        ? rect.left + rect.width / 2
        : event.clientX
      const clientY = isKeyboardClick
        ? rect.top + rect.height / 2
        : event.clientY
      const x = clientX - rect.left - rippleSize / 2
      const y = clientY - rect.top - rippleSize / 2

      const ripple = document.createElement('span')
      ripple.className = 'button-ripple'
      ripple.style.width = `${rippleSize}px`
      ripple.style.height = `${rippleSize}px`
      ripple.style.left = `${x}px`
      ripple.style.top = `${y}px`
      const duration = Math.round(
        Math.min(900, Math.max(420, rippleSize * 0.9)),
      )
      ripple.style.animationDuration = `${duration}ms`

      target.insertBefore(ripple, target.firstChild)

      const cleanup = () => ripple.remove()
      ripple.addEventListener('animationend', cleanup, { once: true })
      window.setTimeout(cleanup, duration + 80)
    },
    [onClick, disabled, variant],
  )

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={disabled}
      onClick={handleClick}
      {...restProps}
    />
  )
}

export { Button, buttonVariants }
