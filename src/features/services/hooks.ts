import { useQuery } from '@tanstack/react-query'
import { serviceRepository } from '@/services'

export const usePublicServices = () =>
  useQuery({ queryKey: ['services', 'public'], queryFn: () => serviceRepository.listPublic() })
