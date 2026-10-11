import { AlertTriangle } from 'lucide-react'
import { SUPABASE_CONFIG_MESSAGES } from '@/lib/supabaseConfig'
import { dataSource, dataSourceProblem } from '@/services'

if (dataSourceProblem) {
  // A deployment mistake, reported once. Only the problem name is printed, never the configured values.
  console.error(`[config] Live data is selected but the Supabase settings are not usable (${dataSourceProblem}). ${SUPABASE_CONFIG_MESSAGES[dataSourceProblem]}`)
}

/**
 * A visible banner when the live data source is selected but not configured (requests fail with 'not_configured'; demo data
 * is never shown instead), or a slim label when the site deliberately runs on demo data.
 * Technical detail is shown only in development builds.
 */
export function DataSourceNotice() {
  if (dataSourceProblem) {
    return (
      <div role="alert" className="border-b border-destructive/30 bg-red-50 px-4 py-2 text-center text-sm text-destructive">
        <AlertTriangle className="mr-1 inline size-4 align-[-2px]" aria-hidden />
        Some features are unavailable right now because the site cannot connect to its database. Please try again later or contact us.
        {import.meta.env.DEV && <span className="block text-xs text-ink">Developer: {SUPABASE_CONFIG_MESSAGES[dataSourceProblem]}</span>}
      </div>
    )
  }
  if (dataSource === 'mock') {
    return (
      <div className="border-b bg-gold-100 px-4 py-1.5 text-center text-xs font-medium text-navy-900" data-testid="demo-data-notice">
        Demo mode: the data on this site is sample data held in your browser's memory and resets when the page is reloaded.
      </div>
    )
  }
  return null
}
