import type { ServiceCategory } from '@/types'

export const SERVICE_CATEGORIES: { id: ServiceCategory; label: string }[] = [
  { id: 'id-cards', label: 'ID Cards' },
  { id: 'school-materials', label: 'School Materials' },
  { id: 'design-printing', label: 'Design & Printing' },
]

export const isServiceCategory = (v: string | null): v is ServiceCategory =>
  SERVICE_CATEGORIES.some((c) => c.id === v)
