// SmartLayout CALLAO · lógica del servicio de datos (independiente de Netlify para poder probarla)
import { timingSafeEqual } from 'node:crypto';

export const KEYS = ['daily', 'abc', 'layouts', 'capacity', 'capcfg', 'capsync'];
const PRIVATE = ['capcfg'];
const MAX = 5.8 * 1024 * 1024; // límite de cuerpo de Netlify Functions ≈ 6 MB
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, PUT, POST, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, x-file',
  'access-control-expose-headers': 'x-updated, x-size, x-file'
};
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { ...CORS, 'content-type': 'application/json', 'cache-control': 'no-store' } });
function authorized(req, adminKey) {
  if (!adminKey) return false;
  const got = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const a = Buffer.from(got), b = Buffer.from(adminKey);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** store: { get(key,{type}), getMetadata(key), getWithMetadata(key,{type}), set(key, data, {metadata}), delete(key) } */
export async function handle(req, store, adminKey, hooks = {}) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  const url = new URL(req.url);
  const key = url.searchParams.get('key') || '';

  if (req.method === 'GET') {
    if (key === 'auth') return authorized(req, adminKey) ? json({ ok: true }) : json({ ok: false, error: adminKey ? 'Clave incorrecta' : 'ADMIN_KEY no está configurada en Netlify' }, adminKey ? 401 : 500);
    if (key === 'meta') {
      const out = {};
      for (const k of KEYS) { if (PRIVATE.includes(k)) continue; const m = await store.getMetadata(k); out[k] = m ? m.metadata : null; }
      return json(out);
    }
    if (!KEYS.includes(key)) return json({ error: 'clave no válida' }, 400);
    if (PRIVATE.includes(key) && !authorized(req, adminKey)) return json({ error: 'No autorizado' }, 401);
    const r = await store.getWithMetadata(key, { type: 'arrayBuffer' });
    if (!r) return json(null, 404);
    const md = r.metadata || {};
    return new Response(r.data, { status: 200, headers: { ...CORS, 'content-type': 'application/octet-stream', 'cache-control': 'no-store', 'x-updated': md.updatedAt || '', 'x-size': String(md.size || ''), 'x-file': encodeURIComponent(md.file || '') } });
  }

  if (req.method === 'PUT' || req.method === 'POST' || req.method === 'DELETE') {
    if (!adminKey) return json({ error: 'ADMIN_KEY no está configurada en Netlify (Site configuration → Environment variables)' }, 500);
    if (!authorized(req, adminKey)) return json({ error: 'Clave de publicación incorrecta' }, 401);
    if (key === 'capsync-run' && req.method === 'POST') {
      if (!hooks.capSync) return json({ error: 'Sincronización no disponible' }, 501);
      try { return json({ ok: true, status: await hooks.capSync() }); } catch (e) { return json({ error: e.message }, 500); }
    }
    if (!KEYS.includes(key)) return json({ error: 'clave no válida' }, 400);
    if (req.method === 'DELETE') { await store.delete(key); return json({ ok: true, deleted: key }); }
    const body = await req.arrayBuffer();
    if (!body.byteLength) return json({ error: 'cuerpo vacío' }, 400);
    if (body.byteLength > MAX) return json({ error: `El paquete pesa ${(body.byteLength / 1048576).toFixed(1)} MB y supera el límite de 5.8 MB` }, 413);
    const metadata = { updatedAt: new Date().toISOString(), size: body.byteLength, file: decodeURIComponent(req.headers.get('x-file') || '') };
    await store.set(key, body, { metadata });
    return json({ ok: true, key, ...metadata });
  }
  return json({ error: 'método no permitido' }, 405);
}
