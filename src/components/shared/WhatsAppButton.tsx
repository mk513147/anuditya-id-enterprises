import { MessageCircle } from 'lucide-react'
import type { ComponentProps } from 'react'
import { Button } from '@/components/ui/button'
import { waMessages, whatsappUrl } from '@/lib/whatsapp'

type Props = Omit<ComponentProps<typeof Button>, 'asChild'> & {
  /** Pre-filled message. Defaults to a generic greeting. */
  message?: string
  label?: string
  iconOnly?: boolean
}

export function WhatsAppButton({
  message = waMessages.general(),
  label = 'WhatsApp',
  iconOnly = false,
  variant = 'whatsapp',
  ...props
}: Props) {
  return (
    <Button asChild variant={variant} {...props}>
      <a
        href={whatsappUrl(message)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={iconOnly ? `${label} (opens WhatsApp)` : undefined}
      >
        <MessageCircle aria-hidden />
        {!iconOnly && label}
      </a>
    </Button>
  )
}
