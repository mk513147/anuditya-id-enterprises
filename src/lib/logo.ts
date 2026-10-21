import logoCompact from '@/assets/branding/anuditya-id-solutions-compact.svg'
import logoFull from '@/assets/branding/anuditya-id-solutions-logo.svg'
import logoSymbol from '@/assets/branding/anuditya-symbol.svg'

/** The name the official logo artwork shows. */
export const LOGO_NAME = 'Anuditya ID Solutions'

/**
 * The official logo files (vectorised from the supplied artwork; see src/assets/branding/README.md). The intrinsic sizes
 * are passed to <img>, so the browser reserves the right space before the file arrives (no layout shift) and the
 * aspect ratio is always preserved.
 */
export const LOGO_ASSETS = {
  full: { src: logoFull, width: 1600, height: 368 },
  compact: { src: logoCompact, width: 1532, height: 318 },
  symbol: { src: logoSymbol, width: 320, height: 320 },
} as const
