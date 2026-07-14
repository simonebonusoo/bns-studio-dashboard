import { useMemo, useState } from 'react';
import { Github, Plus, Link2Off, ExternalLink, Loader2, GitBranch, Lock, Globe } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useList, useCreate, useRemove } from '@/hooks/useEntities';
import { useAuth } from '@/stores/auth';
import { githubService } from '@/services/githubService';
import type { GithubRepo, ProjectRepository } from '@/types';
import { toast } from 'sonner';

/**
 * Sezione "Repository" nel dettaglio progetto (§4): collega uno o più repository
 * GitHub al progetto. La lista repository accessibili arriva dall'Edge Function
 * (installation token a vita breve); i link sono righe `project_repositories`.
 */
export function ProjectRepositories({ projectId }: { projectId: string }) {
  const can = useAuth((s) => s.can);
  const canManage = can('projects.write');
  const { data: all } = useList<ProjectRepository>('projectRepositories', { retry: false });
  const create = useCreate<ProjectRepository>('projectRepositories');
  const remove = useRemove('projectRepositories');

  const linked = useMemo(
    () => (all ?? []).filter((r) => r.projectId === projectId).sort((a, b) => a.fullName.localeCompare(b.fullName)),
    [all, projectId],
  );

  const [pickerOpen, setPickerOpen] = useState(false);
  const [available, setAvailable] = useState<GithubRepo[]>([]);
  const [loading, setLoading] = useState(false);

  const openPicker = async () => {
    setPickerOpen(true);
    setLoading(true);
    try {
      setAvailable(await githubService.listRepos());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'GitHub non connesso');
      setPickerOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const link = async (repo: GithubRepo) => {
    if (linked.some((l) => l.repoId === repo.repoId)) {
      toast.info('Repository già collegato');
      return;
    }
    await create.mutateAsync({
      projectId,
      repoId: repo.repoId,
      fullName: repo.fullName,
      owner: repo.owner,
      name: repo.name,
      private: repo.private,
      defaultBranch: repo.defaultBranch ?? null,
      htmlUrl: repo.htmlUrl ?? null,
      openIssues: repo.openIssues ?? null,
      lastPushedAt: repo.lastPushedAt ?? null,
    } as Partial<ProjectRepository>);
    toast.success(`${repo.fullName} collegato`);
  };

  const unlink = async (repo: ProjectRepository) => {
    await remove.mutateAsync(repo.id);
    toast.success('Repository scollegato');
  };

  const availableToLink = available.filter((repo) => !linked.some((l) => l.repoId === repo.repoId));

  return (
    <Card>
      <CardHeader
        title="Repository GitHub"
        subtitle={linked.length ? `${linked.length} collegati` : 'Nessun repository collegato'}
        icon={<Github className="h-4 w-4" />}
        action={
          canManage ? (
            <Button variant="secondary" size="sm" onClick={openPicker}>
              <Plus className="h-4 w-4" /> Collega
            </Button>
          ) : undefined
        }
      />

      {linked.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-fg-subtle">
          Collega i repository del progetto. Richiede la connessione GitHub nelle Impostazioni.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {linked.map((repo) => (
            <li key={repo.id} className="flex items-center gap-3 px-4 py-3">
              <Github className="h-4 w-4 shrink-0 text-fg-subtle" />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                  {repo.fullName}
                  {repo.private ? (
                    <Lock className="h-3 w-3 text-fg-subtle" aria-label="Privato" />
                  ) : (
                    <Globe className="h-3 w-3 text-fg-subtle" aria-label="Pubblico" />
                  )}
                </p>
                {repo.defaultBranch && (
                  <p className="flex items-center gap-1 text-xs text-fg-subtle">
                    <GitBranch className="h-3 w-3" /> {repo.defaultBranch}
                  </p>
                )}
              </div>
              {repo.htmlUrl && (
                <a href={repo.htmlUrl} target="_blank" rel="noopener noreferrer" aria-label="Apri su GitHub"
                  className="press rounded-md p-1.5 text-fg-subtle hover:bg-surface-2 hover:text-fg">
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
              {canManage && (
                <button onClick={() => unlink(repo)} aria-label="Scollega"
                  className="press rounded-md p-1.5 text-fg-subtle hover:bg-surface-2 hover:text-danger">
                  <Link2Off className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <Modal open={pickerOpen} onClose={() => setPickerOpen(false)} title="Collega un repository">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-fg-subtle">
            <Loader2 className="h-4 w-4 animate-spin" /> Carico i repository da GitHub…
          </div>
        ) : availableToLink.length === 0 ? (
          <p className="py-8 text-center text-sm text-fg-subtle">Nessun repository disponibile da collegare.</p>
        ) : (
          <ul className="max-h-[50vh] divide-y divide-border overflow-y-auto">
            {availableToLink.map((repo) => (
              <li key={repo.repoId} className="flex items-center gap-3 py-2.5">
                <Github className="h-4 w-4 shrink-0 text-fg-subtle" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{repo.fullName}</p>
                  <p className="text-xs text-fg-subtle">{repo.private ? 'Privato' : 'Pubblico'}{repo.defaultBranch ? ` · ${repo.defaultBranch}` : ''}</p>
                </div>
                <Button size="sm" variant="secondary" onClick={() => link(repo)} loading={create.isPending}>
                  <Plus className="h-4 w-4" /> Collega
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </Card>
  );
}
