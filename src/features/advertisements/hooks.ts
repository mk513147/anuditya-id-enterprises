import { useQuery } from '@tanstack/react-query'
import { advertisementRepository } from '@/services'

export const usePublicAdvertisements = () =>
  useQuery({ queryKey: ['advertisements', 'public'], queryFn: () => advertisementRepository.listPublic() })
