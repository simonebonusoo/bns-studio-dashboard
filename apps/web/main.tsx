import { StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { LoadingState } from '@/components/ui/States';
import { IS_DEMO } from '@/config/env';
import { seedDatabase } from '@/data/seed';
import { AppProviders } from '@/app/providers/AppProviders';
import { ErrorBoundary } from '@/components/feedback/ErrorBoundary';
import { router } from '@/app/router';
import { useAuth } from '@/stores/auth';
import '@/styles/index.css';

async function bootstrap() {
  if (IS_DEMO) {
    // In modalità demo popola IndexedDB alla prima apertura.
    await seedDatabase();
  }

  // Ripristina il membro/ruolo dalla sessione persistita (solo memberId è salvato):
  // senza questo, dopo un refresh i permessi risultano vuoti e la sidebar si svuota.
  await useAuth.getState().hydrate();

  const root = createRoot(document.getElementById('root')!);
  root.render(
    <StrictMode>
      <ErrorBoundary>
        <AppProviders>
          <Suspense fallback={<LoadingState label="Avvio BNS Studio OS…" />}>
            <RouterProvider router={router} />
          </Suspense>
        </AppProviders>
      </ErrorBoundary>
    </StrictMode>,
  );
}

void bootstrap();
