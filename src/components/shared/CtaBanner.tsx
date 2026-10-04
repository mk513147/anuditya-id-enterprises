import { CallButton } from '@/components/shared/CallButton'
import { Reveal } from '@/components/shared/Reveal'
import { WhatsAppButton } from '@/components/shared/WhatsAppButton'
import { Button } from '@/components/ui/button'
import { useQuote } from '@/features/quote/useQuote'
import { BUSINESS } from '@/lib/business'
import { waMessages } from '@/lib/whatsapp'

interface Props {
  title?: string
  text?: string
  /** Pre-filled WhatsApp message. */
  message?: string
  /** Show the Get a Quote button (default true). */
  showQuote?: boolean
  /** Show a Call button (default false). */
  showCall?: boolean
}

/** Closing call-to-action: opens the quote dialog or WhatsApp. Defaults match the homepage. */
export function CtaBanner({
  title = 'Need ID Cards or Printing for Your School?',
  text = `Get a quotation from ${BUSINESS.name}.`,
  message = waMessages.quote('ID card'),
  showQuote = true,
  showCall = false,
}: Props) {
  const { openQuote } = useQuote()
  return (
    <section aria-labelledby="cta-title" className="container-page section-y">
      <Reveal>
        <div className="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-navy-950 via-navy-900 to-royal-700 px-6 py-10 text-center text-white shadow-card-hover sm:px-12 sm:py-16">
          <div aria-hidden className="absolute -left-10 -top-10 size-48 rounded-full bg-gold-400/20 blur-3xl" />
          <div aria-hidden className="absolute -bottom-16 -right-10 size-56 rounded-full bg-royal-500/40 blur-3xl" />
          <div className="relative mx-auto max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-gold-400">{BUSINESS.tagline}</p>
            <h2 id="cta-title" className="mt-3 text-balance text-2xl font-extrabold text-white sm:text-4xl">
              {title}
            </h2>
            <p className="mt-3 text-base text-white/80 sm:text-lg">{text}</p>
            <div className="mt-7 flex flex-col justify-center gap-3 min-[480px]:flex-row">
              {showQuote && (
                <Button variant="gold" size="lg" onClick={() => openQuote()}>
                  Get a Quote
                </Button>
              )}
              {showCall && <CallButton variant="gold" size="lg" label={`Call ${BUSINESS.phone}`} />}
              <WhatsAppButton size="lg" label="WhatsApp Us" message={message} />
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  )
}
