import { useQuery } from '@tanstack/react-query'
import { checkBetaAccess } from '@odie/db'
import { useAuth } from '../components/auth/AuthProvider'

export const accessKeys = {
  byUser: (userId: string) => ['access', userId] as const,
}

export function useAccess() {
  const { user } = useAuth()

  const { data, isLoading } = useQuery({
    queryKey: accessKeys.byUser(user?.id ?? ''),
    queryFn: checkBetaAccess,
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 min — access status rarely changes
    retry: false, // fail closed — don't retry on error
  })

  return {
    hasAccess: data === true,
    isLoading,
  }
}
