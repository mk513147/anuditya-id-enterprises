import { useState } from 'react'
import { PlaceholderArt } from '@/components/shared/PlaceholderArt'
import type { Advertisement } from '@/types'

interface Props {
  ad: Advertisement
  /** Picks the placeholder gradient so neighbouring cards differ. */
  variant?: number
  className?: string
  iconClassName?: string
}

/**
 * The advertisement picture. Falls back to the branded placeholder when there is no image URL or the
 * image fails to load, so a broken link never leaves a hole in the layout.
 */
export function AdMedia({ ad, variant = 0, className, iconClassName }: Props) {
  const [failed, setFailed] = useState(false)
  if (ad.image && !failed) {
    return <img src={ad.image} alt={ad.title} loading="lazy" onError={() => setFailed(true)} className={className} />
  }
  return <PlaceholderArt icon={ad.icon} variant={variant} className={className} iconClassName={iconClassName} />
}
