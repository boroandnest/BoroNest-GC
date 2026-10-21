import { verifyLocalSignedUrl, getObject } from '@/lib/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Serves local-disk objects for signed URLs issued by lib/storage.getSignedUrl.
// No session check here by design: the HMAC signature + expiry IS the authorization,
// and it is only ever issued after the caller's access check.
export async function GET(request) {
  const signed = verifyLocalSignedUrl(new URL(request.url).searchParams);
  if (!signed) return Response.json({ error: 'Link expired or invalid' }, { status: 403 });
  let buf;
  try { buf = await getObject(signed.key, 'local'); } catch { return Response.json({ error: 'Not found' }, { status: 404 }); }
  return new Response(buf, {
    headers: {
      'Content-Type': signed.contentType,
      'Content-Disposition': signed.disposition,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}
