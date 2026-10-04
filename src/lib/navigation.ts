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

export const ADMIN_NAV: NavItem[] = [
  { label: 'Dashboard', to: '/admin' },
  { label: 'Students', to: '/admin/students' },
  { label: 'Orders', to: '/admin/orders' },
  { label: 'Files', to: '/admin/files' },
  { label: 'Advertisements', to: '/admin/advertisements' },
  { label: 'Feedback', to: '/admin/feedback' },
  { label: 'Services', to: '/admin/services' },
]
