// ============================================================================
// BNS Studio OS — Edge Function: Stripe webhook (PREDISPOSTA, non attiva)
// Riceve gli eventi di pagamento Stripe e aggiorna fatture/pagamenti.
// Richiede: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET nelle secrets Supabase.
// Deploy: supabase functions deploy stripe-webhook
// Finché le chiavi non sono configurate, questa funzione NON viene richiamata:
// l'app registra i pagamenti manualmente (vedi InvoiceDetailPage).
// ============================================================================

// deno-lint-ignore-file no-explicit-any
Deno.serve(async (req: Request) => {
  const signature = req.headers.get('stripe-signature');
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

  if (!webhookSecret) {
    return new Response(
      JSON.stringify({ error: 'Stripe non configurato', configured: false }),
      { status: 501, headers: { 'content-type': 'application/json' } },
    );
  }
  if (!signature) {
    return new Response('Missing signature', { status: 400 });
  }

  // TODO (produzione): verificare la firma con la libreria Stripe e gestire
  // gli eventi payment_intent.succeeded / invoice.paid aggiornando le tabelle
  // payments e invoices tramite il service role client.
  return new Response(JSON.stringify({ received: true }), {
    headers: { 'content-type': 'application/json' },
  });
});
