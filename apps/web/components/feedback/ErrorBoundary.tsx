import { Component, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';

interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
  message?: string;
}

/** Error boundary applicativa: cattura errori di rendering senza esporre stack sensibili. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error) {
    // In produzione qui si invierebbe a un servizio di logging.
    console.error('[BnsStudio] Errore applicativo:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
          <h1 className="text-xl font-bold">Qualcosa è andato storto</h1>
          <p className="max-w-md text-sm text-fg-subtle">
            Si è verificato un errore imprevisto. Ricarica la pagina; se il problema persiste
            ripristina i dati demo dalle impostazioni.
          </p>
          <Button onClick={() => window.location.reload()}>Ricarica</Button>
        </div>
      );
    }
    return this.props.children;
  }
}
