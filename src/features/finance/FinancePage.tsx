import { useState } from 'react';
import { Plus, Download } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { MetricCard } from '@/components/ui/Card';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { Badge } from '@/components/ui/Badge';
import { LoadingState } from '@/components/ui/States';
import { Modal } from '@/components/ui/Modal';
import { Input, Select, Field } from '@/components/ui/Input';
import { useList, useCreate } from '@/hooks/useEntities';
import { formatCurrency, formatDate } from '@/lib/format';
import { exportToCSV } from '@/utils/csv';
import { useAuth } from '@/stores/auth';
import type { Transaction } from '@/types';
import { toast } from 'sonner';

const EXPENSE_CATS = ['Software', 'Hosting', 'Advertising', 'Collaboratori', 'Attrezzatura', 'Formazione', 'Commissioni', 'Spese generali'];

export default function FinancePage() {
  const { data: transactions, isLoading } = useList<Transaction>('transactions');
  const create = useCreate<Transaction>('transactions');
  const can = useAuth((s) => s.can);
  const [filter, setFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ type: 'expense', category: 'Software', description: '', amount: '', date: new Date().toISOString().slice(0, 10) });

  const list = (transactions ?? []).sort((a, b) => (a.date < b.date ? 1 : -1));
  const filtered = list.filter((t) => filter === 'all' || t.type === filter);
  const income = list.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expenses = list.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  const columns: Column<Transaction>[] = [
    { key: 'date', header: 'Data', sortValue: (t) => t.date, render: (t) => formatDate(t.date) },
    { key: 'type', header: 'Tipo', render: (t) => <Badge tone={t.type === 'income' ? 'success' : 'danger'}>{t.type === 'income' ? 'Entrata' : 'Uscita'}</Badge> },
    { key: 'category', header: 'Categoria', render: (t) => t.category },
    { key: 'description', header: 'Descrizione', render: (t) => <span className="text-fg-subtle">{t.description}</span> },
    { key: 'amount', header: 'Importo', sortValue: (t) => t.amount, render: (t) => <span className={t.type === 'income' ? 'font-semibold text-success' : 'font-semibold text-danger'}>{t.type === 'income' ? '+' : '−'} {formatCurrency(t.amount)}</span> },
  ];

  const addTransaction = async () => {
    const amount = Number(form.amount);
    if (!amount || !form.description) { toast.error('Compila importo e descrizione'); return; }
    await create.mutateAsync({
      type: form.type as Transaction['type'],
      category: form.category,
      description: form.description,
      amount,
      currency: 'EUR',
      date: form.date,
    });
    toast.success('Movimento registrato');
    setOpen(false);
    setForm({ ...form, description: '', amount: '' });
  };

  if (isLoading) return <LoadingState />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Entrate e uscite"
        description={`${list.length} movimenti`}
        actions={
          <>
            <Button variant="secondary" onClick={() => exportToCSV('movimenti', list)}><Download className="h-4 w-4" /> CSV</Button>
            {can('finances.manage') && <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Movimento</Button>}
          </>
        }
      />
      <div className="grid grid-cols-3 gap-3">
        <MetricCard label="Entrate" value={formatCurrency(income)} />
        <MetricCard label="Uscite" value={formatCurrency(expenses)} />
        <MetricCard label="Saldo" value={formatCurrency(income - expenses)} />
      </div>
      <div className="flex gap-1">
        {(['all', 'income', 'expense'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${filter === f ? 'bg-accent/20 text-fg' : 'text-fg-subtle hover:bg-surface-2'}`}>
            {f === 'all' ? 'Tutti' : f === 'income' ? 'Entrate' : 'Uscite'}
          </button>
        ))}
      </div>
      <DataTable data={filtered} columns={columns} />

      <Modal open={open} onClose={() => setOpen(false)} title="Nuovo movimento" footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Annulla</Button><Button onClick={addTransaction}>Registra</Button></>}>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Tipo">
            <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="expense">Uscita</option>
              <option value="income">Entrata</option>
            </Select>
          </Field>
          <Field label="Categoria">
            <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {(form.type === 'income' ? ['Pagamento cliente', 'Vendita prodotti', 'Collaborazione', 'Altri ricavi'] : EXPENSE_CATS).map((c) => <option key={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="Descrizione" className="col-span-2">
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
          <Field label="Importo (€)">
            <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </Field>
          <Field label="Data">
            <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
