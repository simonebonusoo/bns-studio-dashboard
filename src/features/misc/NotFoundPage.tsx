import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';

export default function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <p className="text-6xl font-bold text-accent">404</p>
      <h1 className="text-xl font-semibold">Pagina non trovata</h1>
      <p className="max-w-sm text-sm text-fg-subtle">La pagina che cerchi non esiste o è stata spostata.</p>
      <Link to="/"><Button>Torna alla dashboard</Button></Link>
    </div>
  );
}
