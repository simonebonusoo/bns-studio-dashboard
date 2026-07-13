export function normalizeWebsiteUrl(value: unknown) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  return /^[a-z][a-z\d+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
}

