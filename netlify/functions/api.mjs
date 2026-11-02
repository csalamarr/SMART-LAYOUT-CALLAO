// SmartLayout CALLAO · servicio de datos en Netlify (Functions v2 + Netlify Blobs)
// GET  /api/data?key=daily|abc|layouts   → datos publicados (gzip)
// GET  /api/data?key=meta                → fecha de actualización de cada paquete
// PUT  /api/data?key=…  (Authorization: Bearer ADMIN_KEY) → publicar
// POST /api/data?key=capsync-run (Authorization) → sincronizar ahora el Módulo 5 desde OneDrive
import { getStore } from '@netlify/blobs';
import { handle } from './handler.mjs';
import { runCapSync } from './lib/capsync.mjs';

export default async (req) => {
  const store = getStore({ name: 'smartlayout-callao', consistency: 'strong' });
  const env = { CAP_BACKUS_URL: Netlify.env.get('CAP_BACKUS_URL'), CAP_MKP_URL: Netlify.env.get('CAP_MKP_URL') };
  return handle(req, store, Netlify.env.get('ADMIN_KEY'), { capSync: () => runCapSync(store, env, fetch, { force: true }) });
};

export const config = { path: '/api/data' };
