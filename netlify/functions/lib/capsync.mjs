// Sincronización del Módulo 5: OneDrive → procesar → publicar en Netlify Blobs (paquete "capacity")
import * as XLSX from 'xlsx';
import { gzipSync, gunzipSync } from 'node:zlib';
import { SLCap } from './capacity.mjs';
import { downloadShared } from './onedrive.mjs';

async function readJson(store, key) {
  const b = await store.get(key, { type: 'arrayBuffer' });
  if (!b) return null;
  try { return JSON.parse(gunzipSync(Buffer.from(b)).toString('utf8')); } catch { return null; }
}
export async function runCapSync(store, env = {}, fetchImpl = fetch) {
  const cfg = (await readJson(store, 'capcfg')) || {};
  const urls = { bk: cfg.bk || env.CAP_BACKUS_URL || '', mkp: cfg.mkp || env.CAP_MKP_URL || '' };
  const prev = (await readJson(store, 'capacity')) || {};
  const out = { v: 1, at: new Date().toISOString(), bk: prev.bk || null, mkp: prev.mkp || null, src: prev.src || {} };
  const status = { at: out.at, results: {} };
  for (const k of ['bk', 'mkp']) {
    if (!urls[k]) { status.results[k] = { ok: false, error: 'Sin enlace configurado' }; continue; }
    try {
      const buf = await downloadShared(urls[k], fetchImpl);
      const wb = XLSX.read(buf, { type: 'buffer', cellDates: false, dense: true });
      const r = SLCap.parseCapacityWorkbook(XLSX, wb, k === 'bk' ? 'Seguimiento Cap Almacenamiento (OneDrive)' : 'Seguimiento Cap Almacenamiento MKP (OneDrive)');
      if ((k === 'bk' && r.kind !== 'cap-bk') || (k === 'mkp' && r.kind !== 'cap-mkp')) throw new Error('El archivo no corresponde (' + r.kind + ')');
      out[k] = r.rows; out.src[k] = { via: 'onedrive', at: out.at, last: r.rows.length ? r.rows[r.rows.length - 1][0] : null, n: r.rows.length, sheets: r.sheets ? r.sheets.length : undefined };
      status.results[k] = { ok: true, n: r.rows.length, last: out.src[k].last };
    } catch (e) { status.results[k] = { ok: false, error: e.message }; }
  }
  const okAny = Object.values(status.results).some(x => x.ok);
  if (okAny) {
    const body = gzipSync(Buffer.from(JSON.stringify(out)));
    await store.set('capacity', body, { metadata: { updatedAt: out.at, size: body.length, file: 'Sincronización OneDrive' } });
  }
  const sb = gzipSync(Buffer.from(JSON.stringify(status)));
  await store.set('capsync', sb, { metadata: { updatedAt: out.at, size: sb.length, file: okAny ? 'ok' : 'error' } });
  return status;
}
