import { Outlet } from 'react-router-dom'

/** Placeholder shell — sidebar + mobile nav arrive with the admin phase. */
export function AdminLayout() {
  return (
    <div className="min-h-svh bg-surface">
      <Outlet />
    </div>
  )
}
