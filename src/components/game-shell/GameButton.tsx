'use client'

import type { ButtonHTMLAttributes } from 'react'

type Variant = 'accent' | 'ghost'

const VARIANTS: Record<Variant, string> = {
  accent: 'bg-accent text-stone-900 shadow-sm hover:shadow-md',
  ghost: 'bg-surface text-fg hover:bg-white/10',
}

/**
 * Shared button with the template's micro-interactions (hover/press scale).
 * Motion is disabled automatically under prefers-reduced-motion via `.btn-press`.
 */
export function GameButton({
  variant = 'accent',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={`btn-press rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
    />
  )
}
