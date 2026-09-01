/**
 * Turn a Firebase Storage failure into something the owner can act on.
 *
 * The two that actually happen in this app are a bucket with no CORS rule for
 * the origin the app is served from, and rules that reject the write — and a
 * generic "try again when you are online" hides both of them behind advice that
 * will never help.
 */
export function photoErrorKey(err) {
  const code = err?.code || '';
  const message = String(err?.message || '');
  if (code === 'storage/unauthorized' || /unauthorized|permission/i.test(message))
    return 'gallery.errUnauthorized';
  if (code === 'storage/unauthenticated') return 'gallery.errSignedOut';
  if (code === 'storage/quota-exceeded') return 'gallery.errQuota';
  if (code === 'storage/retry-limit-exceeded' || !navigator.onLine) return 'gallery.errOffline';
  if (code === 'storage/unknown' || /cors|network|failed to fetch/i.test(message))
    return 'gallery.errBlocked';
  return 'gallery.errUnknown';
}

export const photoErrorDetail = (err) =>
  [err?.code, err?.message].filter(Boolean).join(' — ').slice(0, 400);
