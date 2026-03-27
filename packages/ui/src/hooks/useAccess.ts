import { useQuery } from '@tanstack/react-query'
import { checkBetaAccess } from '@odie/db'
import { useAuth } from '../components/auth/AuthProvider'

export const accessKeys = {
  all: ['access'] as const,
  byUser: (userId: string) => ['access', userId] as const,
}

export function useAccess() {
  const { user } = useAuth()

  const { data, isLoading, isFetching } = useQuery({
    queryKey: accessKeys.byUser(user?.id ?? ''),
    queryFn: checkBetaAccess,
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 min — access status rarely changes
    retry: false, // fail closed — don't retry on error
    refetchOnWindowFocus: true, // Override global false — re-check access on wake from sleep
  })

  return {
    hasAccess: data === true,
    isLoading,
    isFetching,
  }
}
