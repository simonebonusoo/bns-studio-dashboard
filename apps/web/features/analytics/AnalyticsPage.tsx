import { useState } from 'react';
import { Download } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, MetricCard } from '@/components/ui/Card';
import { DonutChart, GroupedBarChart, HBarChart, TrendChart } from '@/components/charts/Charts';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/States';
import { Button } from '@/components/ui/Button';
import { useAnalytics } from '@/hooks/useAnalytics';
import { formatCurrency } from '@/lib/format';
import { exportToCSV } from '@/utils/csv';
import { cn } from '@/lib/cn';

type Tab = 'overview' | 'operations';

export default function AnalyticsPage() {
  const { data, isLoading, isError } = useAnalytics();
  const [tab, setTab] = useState<Tab>('overview');

  if (isLoading) return <LoadingState />;
  if (isError || !data) return <ErrorState />;

  const summary = data.summary;
  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Panoramica' },
    { key: 'operations', label: 'Operazioni' },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Analytics"
        description="Metriche derivate dai dati reali del gestionale, senza duplicare le viste finanziarie operative."
        actions={<Button variant="secondary" onClick={() => exportToCSV(`analytics-${tab}`, data.monthly)}><Download className="h-4 w-4" /> Esporta</Button>}
      />

      <div className="flex gap-1 border-b border-border">
        {tabs.map((item) => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            className={cn('border-b-2 px-4 py-2 text-sm font-medium transition-colors', tab === item.key ? 'border-accent text-fg' : 'border-transparent text-fg-subtle hover:text-fg')}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard label="Ricavi incassati" value={formatCurrency(summary.income)} />
            <MetricCard label="Costi operativi" value={formatCurrency(summary.expenses)} />
            <MetricCard label="Utile netto" value={formatCurrency(summary.profit)} />
            <MetricCard label="Da ricevere" value={formatCurrency(summary.pendingPayments)} />
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <ChartCard title="Andamento economico" subtitle="Ultimi 6 mesi">
              <TrendChart
                data={data.monthly}
                currency
                series={[
                  { key: 'ricavi', color: '#b0d62e', label: 'Ricavi' },
                  { key: 'costi', color: '#f24e6b', label: 'Costi' },
                  { key: 'utile', color: '#3b76d6', label: 'Utile' },
                ]}
              />
            </ChartCard>
            <ChartCard title="Ricavi per servizio">
              {data.revenueByService.length ? <DonutChart data={data.revenueByService} currency /> : <Empty />}
            </ChartCard>
          </div>
        </div>
      )}

      {tab === 'operations' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard label="Progetti attivi" value={summary.activeProjects} />
            <MetricCard label="Progetti a rischio" value={summary.atRiskProjects} accent={summary.atRiskProjects > 0} />
            <MetricCard label="Ore registrate" value={`${summary.loggedHours}h`} />
            <MetricCard label="Saturazione media" value={`${summary.averageUtilization}%`} />
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <ChartCard title="Ore stimate vs effettive" subtitle="Progetti attivi">
              {data.estimatedVsActual.length ? (
                <GroupedBarChart
                  data={data.estimatedVsActual}
                  series={[
                    { key: 'stimate', color: '#3b76d6', label: 'Stimate' },
                    { key: 'effettive', color: '#b0d62e', label: 'Effettive' },
                  ]}
                />
              ) : <Empty />}
            </ChartCard>
            <ChartCard title="Capacità team" subtitle="Ore mese vs registrate">
              {data.teamCapacity.length ? (
                <GroupedBarChart
                  data={data.teamCapacity}
                  series={[
                    { key: 'capacita', color: '#a1a1aa', label: 'Capacità' },
                    { key: 'registrate', color: '#9b5de5', label: 'Registrate' },
                  ]}
                />
              ) : <Empty />}
            </ChartCard>
            <ChartCard title="Ore per progetto">
              {data.hoursByProject.length ? <HBarChart data={data.hoursByProject} color="#9b5de5" /> : <Empty />}
            </ChartCard>
            <ChartCard title="Progetti per stato">
              {data.projectsByStatus.length ? <DonutChart data={data.projectsByStatus} /> : <Empty />}
            </ChartCard>
          </div>
        </div>
      )}
    </div>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader title={title} subtitle={subtitle} />
      <div className="min-h-[320px] p-4">{children}</div>
    </Card>
  );
}

const Empty = () => <EmptyState title="Nessun dato" description="Non ci sono dati per questo periodo." />;
