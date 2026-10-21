// The client IP as seen by OUR edge, never as claimed by the client.
//
// Next.js route handlers do not expose the socket address, so the IP comes from X-Forwarded-For.
// Each proxy APPENDS the address it received the connection from, so a client can forge entries at
// the LEFT but cannot forge the entry our own ingress appended at the RIGHT. TRUSTED_PROXY_HOPS is
// the number of proxies we control in front of Next (Emergent ingress = 1). We take the entry that
// the outermost trusted proxy appended: parts[len - hops].
export function serverDerivedIp(request) {
  const hops = Math.max(1, parseInt(process.env.TRUSTED_PROXY_HOPS || '1', 10) || 1);
  const parts = (request.headers.get('x-forwarded-for') || '').split(',').map(s => s.trim()).filter(Boolean);
  if (parts.length >= hops) return parts[parts.length - hops];
  return 'unknown';
}
