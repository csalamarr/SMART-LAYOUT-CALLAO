// SmartLayout CALLAO · servicio de datos en Netlify (Functions v2 + Netlify Blobs)
// GET  /api/data?key=daily|abc|layouts   → datos publicados (gzip)
// GET  /api/data?key=meta                → fecha de actualización de cada paquete
// PUT  /api/data?key=…  (Authorization: Bearer ADMIN_KEY) → publicar
import { getStore } from '@netlify/blobs';
import { handle } from './handler.mjs';

export default async (req) => {
  const store = getStore({ name: 'smartlayout-callao', consistency: 'strong' });
  return handle(req, store, Netlify.env.get('ADMIN_KEY'));
};

export const config = { path: '/api/data' };
