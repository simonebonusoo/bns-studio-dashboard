// ============================================================================
// BnsStudio — Edge Function: integrazione GitHub (§3-4)
//
// Flusso GitHub App (sicuro):
//   • App ID + private key vivono SOLO qui come secret (mai nel frontend/DB).
//   • Si firma un JWT RS256 (iss = app_id) → si ottiene un installation token
//     a vita breve → si chiama l'API GitHub. Il token NON viene mai persistito.
//
// Secret richiesti (Supabase): GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY (PKCS#8,
//   cioè "BEGIN PRIVATE KEY"; convertire l'eventuale PKCS#1 con:
//   openssl pkcs8 -topk8 -nocrypt -in app.pem -out app.pkcs8.pem).
// Deploy: supabase functions deploy github
//
// Auth: richiede il JWT utente Supabase (Authorization: Bearer ...). L'org e il
// ruolo admin sono derivati server-side col service role, mai fidandosi del client.
// ============================================================================
// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } });

const APP_ID = Deno.env.get('GITHUB_APP_ID');
const PRIVATE_KEY = Deno.env.get('GITHUB_APP_PRIVATE_KEY');
const isConfigured = Boolean(APP_ID && PRIVATE_KEY);

// ─────────────── GitHub App: JWT RS256 + installation token ───────────────

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----(BEGIN|END)[^-]+-----/g, '').replace(/\s+/g, '');
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

const b64url = (data: Uint8Array | string) => {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

async function appJwt(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify({ iat: now - 60, exp: now + 540, iss: APP_ID }));
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(PRIVATE_KEY!),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${header}.${payload}`)),
  );
  return `${header}.${payload}.${b64url(sig)}`;
}

async function gh(path: string, token: string, init: RequestInit = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'BnsStudio-Dashboard',
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`GitHub ${path} → ${res.status} ${await res.text()}`);
  return res.json();
}

async function installationToken(installationId: number): Promise<string> {
  const jwt = await appJwt();
  const data = await gh(`/app/installations/${installationId}/access_tokens`, jwt, { method: 'POST' });
  return data.token as string;
}

// ─────────────── Auth utente → org + admin ───────────────

async function resolveMember(req: Request) {
  const authHeader = req.headers.get('Authorization') ?? '';
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const { data: userRes } = await admin.auth.getUser(authHeader.replace('Bearer ', ''));
  const user = userRes?.user;
  if (!user) return null;
  const { data: member } = await admin
    .from('members')
    .select('id, organization_id, role')
    .eq('profile_id', user.id)
    .is('deleted_at', null)
    .maybeSingle();
  return member ? { admin, member } : null;
}

// ─────────────── Handler ───────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const action = new URL(req.url).searchParams.get('action') ?? (await req.clone().json().catch(() => ({}))).action;

  // Stato di configurazione: non richiede auth, non espone secret.
  if (action === 'status') return json({ configured: isConfigured });
  if (!isConfigured) return json({ error: 'GitHub non configurato', configured: false }, 501);

  const ctx = await resolveMember(req);
  if (!ctx) return json({ error: 'Non autorizzato' }, 401);
  const { admin, member } = ctx;
  const isAdmin = ['owner', 'admin'].includes(member.role);

  try {
    const body = await req.json().catch(() => ({}));

    if (action === 'connect') {
      if (!isAdmin) return json({ error: 'Solo gli admin possono collegare GitHub' }, 403);
      const installationId = Number(body.installation_id);
      if (!installationId) return json({ error: 'installation_id mancante' }, 400);
      const jwt = await appJwt();
      const inst = await gh(`/app/installations/${installationId}`, jwt);
      const { data, error } = await admin.from('github_connections').upsert(
        {
          organization_id: member.organization_id,
          installation_id: installationId,
          account_login: inst.account?.login,
          account_type: inst.account?.type,
          account_avatar_url: inst.account?.avatar_url,
          status: 'connected',
          error_message: null,
          connected_by: member.id,
          connected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'organization_id' },
      ).select().single();
      if (error) throw error;
      return json({ connection: data });
    }

    if (action === 'disconnect') {
      if (!isAdmin) return json({ error: 'Solo gli admin possono disconnettere GitHub' }, 403);
      const { error } = await admin
        .from('github_connections')
        .update({ status: 'revoked', updated_at: new Date().toISOString() })
        .eq('organization_id', member.organization_id);
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === 'list_repos') {
      const { data: conn } = await admin
        .from('github_connections')
        .select('installation_id, status')
        .eq('organization_id', member.organization_id)
        .maybeSingle();
      if (!conn || conn.status !== 'connected' || !conn.installation_id) {
        return json({ error: 'Nessuna connessione GitHub attiva' }, 409);
      }
      const token = await installationToken(conn.installation_id);
      const data = await gh('/installation/repositories?per_page=100', token);
      const repos = (data.repositories ?? []).map((r: any) => ({
        repo_id: r.id,
        full_name: r.full_name,
        owner: r.owner?.login,
        name: r.name,
        private: r.private,
        default_branch: r.default_branch,
        html_url: r.html_url,
        open_issues: r.open_issues_count,
        last_pushed_at: r.pushed_at,
      }));
      return json({ repositories: repos });
    }

    return json({ error: `Azione sconosciuta: ${action}` }, 400);
  } catch (err) {
    console.error('[github] errore', err);
    return json({ error: String(err instanceof Error ? err.message : err) }, 500);
  }
});
