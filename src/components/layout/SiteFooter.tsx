import { MessageCircle, Phone } from 'lucide-react'
import { InstagramIcon } from '@/components/shared/InstagramIcon'
import { Link } from 'react-router-dom'
import { Logo } from '@/components/shared/Logo'
import { BUSINESS, instagramHref, telHref } from '@/lib/business'
import { FOOTER_LINKS } from '@/lib/navigation'
import { whatsappUrl } from '@/lib/whatsapp'

const YEAR = new Date().getFullYear()

export function SiteFooter() {
  const contact = [
    { icon: Phone, label: 'Phone', value: BUSINESS.phone, href: telHref },
    { icon: MessageCircle, label: 'WhatsApp', value: BUSINESS.whatsapp, href: whatsappUrl() },
    { icon: InstagramIcon, label: 'Instagram', value: `@${BUSINESS.instagram}`, href: instagramHref },
  ]
  return (
    <footer id="contact" className="bg-navy-950 text-white/80">
      <div className="container-page grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-3 lg:py-16">
        <div className="space-y-4">
          <Logo variant="light" />
          <p className="max-w-xs text-sm leading-relaxed">
            ID cards, lanyards, school diaries, magazines and printing — for schools, colleges and organisations.
          </p>
          <p className="font-display text-sm font-semibold text-gold-400">{BUSINESS.tagline}</p>
        </div>

        <nav aria-label="Footer">
          <h2 className="mb-4 font-display text-sm font-bold uppercase tracking-wider text-white">Quick Links</h2>
          <ul className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
            {FOOTER_LINKS.map((l) => (
              <li key={l.to}>
                <Link to={l.to} className="inline-block py-1.5 transition-colors hover:text-gold-400">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <h2 className="mb-4 font-display text-sm font-bold uppercase tracking-wider text-white">Contact</h2>
          <ul className="space-y-3 text-sm">
            {contact.map(({ icon: Icon, label, value, href }) => (
              <li key={label}>
                <a
                  href={href}
                  {...(href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  className="group flex items-center gap-3 transition-colors hover:text-gold-400"
                >
                  <span className="grid size-9 place-items-center rounded-lg bg-white/10 group-hover:bg-white/15">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span>
                    <span className="block text-xs text-white/50">{label}</span>
                    {value}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <p className="container-page py-5 text-center text-xs text-white/50">
          © {YEAR} {BUSINESS.name}. All rights reserved.
        </p>
      </div>
    </footer>
  )
}
