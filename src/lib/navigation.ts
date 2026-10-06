export interface NavItem {
  label: string
  to: string
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Home', to: '/' },
  { label: 'Student Form', to: '/student-form' },
  { label: 'File Upload', to: '/file-upload' },
  { label: 'Job Status', to: '/job-status' },
  { label: 'Services', to: '/services' },
  { label: 'Advertisement', to: '/advertisement' },
  { label: 'Feedback', to: '/feedback' },
  { label: 'Login', to: '/login' },
]

export const FOOTER_LINKS: NavItem[] = [
  ...NAV_ITEMS.filter((n) => n.to !== '/login'),
  { label: 'Contact', to: '/#contact' },
]

export interface AdminNavItem extends NavItem {
  /** Key into lib/icons.ts */
  icon: string
}

export const ADMIN_NAV: AdminNavItem[] = [
  { label: 'Dashboard', to: '/admin', icon: 'dashboard' },
  { label: 'Schools', to: '/admin/schools', icon: 'school' },
  { label: 'Students', to: '/admin/students', icon: 'users' },
  { label: 'Orders', to: '/admin/orders', icon: 'orders' },
  { label: 'Files', to: '/admin/files', icon: 'files' },
  { label: 'Advertisements', to: '/admin/advertisements', icon: 'megaphone' },
  { label: 'Feedback', to: '/admin/feedback', icon: 'message' },
  { label: 'Services', to: '/admin/services', icon: 'settings' },
]
