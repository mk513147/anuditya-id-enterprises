import { Phone } from 'lucide-react'
import type { ComponentProps } from 'react'
import { Button } from '@/components/ui/button'
import { BUSINESS, telHref } from '@/lib/business'

type Props = Omit<ComponentProps<typeof Button>, 'asChild'> & { label?: string; iconOnly?: boolean }

export function CallButton({ label = 'Call', iconOnly = false, variant = 'navy', ...props }: Props) {
  return (
    <Button asChild variant={variant} {...props}>
      <a href={telHref} aria-label={iconOnly ? `${label} ${BUSINESS.phone}` : undefined}>
        <Phone aria-hidden />
        {!iconOnly && label}
      </a>
    </Button>
  )
}
