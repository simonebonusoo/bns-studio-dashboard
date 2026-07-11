import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from '@tanstack/react-query';
import { repositories } from '@/services/repository';
import type { BaseRow } from '@/services/repository';
import { toast } from 'sonner';

type RepoKey = keyof typeof repositories;

export const queryKeys = {
  list: (entity: RepoKey) => [entity, 'list'] as const,
  detail: (entity: RepoKey, id: string) => [entity, 'detail', id] as const,
  dashboard: ['dashboard'] as const,
  analytics: ['analytics'] as const,
};

/** Lista di un'entità (con filtro opzionale lato client). */
export function useList<T extends BaseRow>(
  entity: RepoKey,
  options?: Partial<UseQueryOptions<T[]>>,
) {
  return useQuery<T[]>({
    queryKey: queryKeys.list(entity),
    queryFn: () => repositories[entity].list() as unknown as Promise<T[]>,
    ...options,
  });
}

export function useDetail<T extends BaseRow>(entity: RepoKey, id: string | undefined) {
  return useQuery<T | undefined>({
    queryKey: queryKeys.detail(entity, id ?? ''),
    queryFn: () => repositories[entity].get(id!) as unknown as Promise<T | undefined>,
    enabled: !!id,
  });
}

function invalidate(qc: ReturnType<typeof useQueryClient>, entity: RepoKey) {
  qc.invalidateQueries({ queryKey: [entity] });
  qc.invalidateQueries({ queryKey: queryKeys.dashboard });
  qc.invalidateQueries({ queryKey: queryKeys.analytics });
}

function mutationErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return 'Operazione non riuscita';
}

export function useCreate<T extends BaseRow>(entity: RepoKey) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<T>) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (repositories[entity].create as any)(data) as Promise<T>,
    onSuccess: () => invalidate(qc, entity),
    onError: (error) => {
      console.error(`[BnsStudio] CREATE ${entity} fallita:`, error);
      toast.error(mutationErrorMessage(error));
    },
  });
}

export function useUpdate<T extends BaseRow>(entity: RepoKey) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<T> }) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (repositories[entity].update as any)(id, patch) as Promise<T>,
    onSuccess: () => invalidate(qc, entity),
    onError: (error) => {
      console.error(`[BnsStudio] UPDATE ${entity} fallita:`, error);
      toast.error(mutationErrorMessage(error));
    },
  });
}

export function useRemove(entity: RepoKey) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => repositories[entity].remove(id),
    onSuccess: () => invalidate(qc, entity),
    onError: (error) => {
      console.error(`[BnsStudio] DELETE ${entity} fallita:`, error);
      toast.error(mutationErrorMessage(error));
    },
  });
}

export function useHardDelete(entity: RepoKey) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => repositories[entity].hardDelete(id),
    onSuccess: () => invalidate(qc, entity),
    onError: (error) => {
      console.error(`[BnsStudio] HARD DELETE ${entity} fallita:`, error);
      toast.error(mutationErrorMessage(error));
    },
  });
}
