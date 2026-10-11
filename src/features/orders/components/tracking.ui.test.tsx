import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ApprovalBadge } from '@/components/admin/StatusBadge'
import { formatTrackingCode, isWellFormedTrackingCode, normalizeTrackingCode } from '@/lib/trackingCode'
import { TrackingCodeReveal } from '../admin/TrackingCodeReveal'
import { TrackOrderForm } from './TrackOrderForm'

describe('public tracking form', () => {
  const html = renderToStaticMarkup(<TrackOrderForm initialValue="JOB-2026-0003" onSubmit={() => {}} />)

  it('asks for the order number AND the tracking code', () => {
    expect(html).toContain('id="jt-ref"')
    expect(html).toContain('id="jt-code"')
    expect(html).toContain('Tracking code')
  })

  it('the code field is not offered to the browser for autofill/saving', () => {
    expect(html).toMatch(/id="jt-code"[^>]*autoComplete="off"/)
    expect(html).toMatch(/<form[^>]*autoComplete="off"/)
  })

  it('is a POST-less, script-handled form with no action URL (so nothing is put in a URL)', () => {
    expect(html).not.toMatch(/action=|method="get"/i)
  })
})

describe('tracking code helpers', () => {
  it('normalise, validate and format the 25-character code', () => {
    expect(normalizeTrackingCode(' abcde-fghjk lmnpq_rstuv.wxyz2 ')).toBe('ABCDEFGHJKLMNPQRSTUVWXYZ2')
    expect(isWellFormedTrackingCode('abcde-fghjk-lmnpq-rstuv-wxyz2')).toBe(true)
    expect(isWellFormedTrackingCode('ABCDE-FGHJK-LMNPQ-RSTUV-WXYZ1')).toBe(false) // 1 is not in the alphabet
    expect(isWellFormedTrackingCode('ABCDE-FGHJK-LMNPQ-RSTUV-WXYZ')).toBe(false)
    expect(formatTrackingCode('abcdefghjklmnpqrstuvwxyz2')).toBe('ABCDE-FGHJK-LMNPQ-RSTUV-WXYZ2')
  })
})

describe('admin tracking code display', () => {
  it('shows the code once, with the warning that it cannot be shown again', () => {
    const html = renderToStaticMarkup(<TrackingCodeReveal orderNo="JOB-2026-0010" code="ABCDE-FGHJK-LMNPQ-RSTUV-WXYZ2" />)
    expect(html).toContain('ABCDE-FGHJK-LMNPQ-RSTUV-WXYZ2')
    expect(html).toContain('It is shown only now.')
    expect(html).not.toMatch(/href=/)
  })
})

describe('student review badge', () => {
  it.each([
    ['pending', 'Pending review'],
    ['approved', 'Approved'],
    ['rejected', 'Rejected'],
  ] as const)('%s shows text, not just colour', (status, text) => {
    expect(renderToStaticMarkup(<ApprovalBadge status={status} />)).toContain(text)
  })
})
