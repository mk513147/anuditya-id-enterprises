import { describe, expect, it } from 'vitest'
import { validateSupabaseConfig } from '@/lib/supabaseConfig'
import { resolveDataSource } from './runtime'

describe('data source selection', () => {
  it.each([
    // requested, production, configured → expected
    ['supabase', true, true, 'supabase'],
    ['supabase', true, false, 'supabase'], // misconfigured production: live mode, requests fail clearly
    ['supabase', false, false, 'supabase'],
    ['mock', true, true, 'mock'], // explicit opt-in only
    ['mock', false, false, 'mock'],
    [' MOCK ', false, true, 'mock'],
    [undefined, true, false, 'supabase'], // production never falls back to demo data on its own
    [undefined, true, true, 'supabase'],
    ['', true, false, 'supabase'],
    [undefined, false, true, 'supabase'],
    [undefined, false, false, 'mock'], // local dev and tests work without credentials
    ['demo', true, true, 'supabase'], // unknown values fail closed
    ['mocks', false, false, 'supabase'],
  ] as const)('requested=%j production=%s configured=%s → %s', (requested, production, configured, expected) => {
    expect(resolveDataSource({ requested, production, configured })).toBe(expected)
  })
})

describe('public Supabase settings', () => {
  it('requires the bare project URL: a path such as /rest/v1 is refused', () => {
    expect(validateSupabaseConfig('https://abc.supabase.co/rest/v1/', 'sb_publishable_abc')).toEqual({ ok: false, reason: 'url_has_path' })
    expect(validateSupabaseConfig('https://abc.supabase.co/rest/v1', 'sb_publishable_abc')).toEqual({ ok: false, reason: 'url_has_path' })
    expect(validateSupabaseConfig('https://abc.supabase.co?x=1', 'sb_publishable_abc')).toEqual({ ok: false, reason: 'url_has_path' })
    expect(validateSupabaseConfig('https://user:pw@abc.supabase.co', 'sb_publishable_abc')).toEqual({ ok: false, reason: 'url_has_path' })
    expect(validateSupabaseConfig(' https://abc.supabase.co/ ', 'sb_publishable_abc')).toEqual({ ok: true, url: 'https://abc.supabase.co', key: 'sb_publishable_abc' })
  })

  it('still refuses a secret key', () => {
    expect(validateSupabaseConfig('https://abc.supabase.co', 'sb_secret_abc')).toEqual({ ok: false, reason: 'privileged_key' })
  })
})
