import { useQuery } from '@tanstack/react-query';
import { getAnalytics } from '@/services/analytics';
import { queryKeys } from './useEntities';

export function useAnalytics() {
  return useQuery({
    queryKey: queryKeys.analytics,
    queryFn: getAnalytics,
    staleTime: 15_000,
  });
}
