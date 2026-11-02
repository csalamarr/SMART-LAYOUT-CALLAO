// Sincronización del Módulo 5: carpetas OneDrive → procesar todos los Excel → publicar (paquete "capacity")
import * as XLSX from 'xlsx';
import { gzipSync, gunzipSync } from 'node:zlib';
import { SLCap } from './capacity.mjs';
import { listShared } from './onedrive.mjs';

async function readJson(store, key) {
  const b = await store.get(key, { type: 'arrayBuffer' });
  if (!b) return null;
  try { return JSON.parse(gunzipSync(Buffer.from(b)).toString('utf8')); } catch { return null; }
}
const LBL = { bk: 'Seguimiento Backus', mkp: 'Seguimiento Marketplace' };
export async function runCapSync(store, env = {}, fetchImpl = fetch, opts = {}) {
  const cfg = (await readJson(store, 'capcfg')) || {};
  const urls = { bk: (cfg.bk || env.CAP_BACKUS_URL || '').trim(), mkp: (cfg.mkp || env.CAP_MKP_URL || '').trim() };
  const prev = (await readJson(store, 'capacity')) || {};
  const at = new Date().toISOString();
  const out = { v: 1, at, bk: prev.bk || null, mkp: prev.mkp || null, src: prev.src || {} };
  const status = { at, results: {} };
  // 1) listar los Excel de cada enlace (carpeta o archivo)
  const lists = {};
  for (const k of ['bk', 'mkp']) {
    if (!urls[k]) { status.results[k] = { ok: false, error: 'Sin enlace configurado' }; continue; }
    try { lists[k] = await listShared(urls[k], fetchImpl); }
    catch (e) { status.results[k] = { ok: false, error: e.message }; }
  }
  // 2) procesar solo si algo cambió (nombre, tamaño o fecha de modificación de algún archivo)
  let changed = false;
  for (const k of Object.keys(lists)) {
    const sig = lists[k].map(f => f.sig).sort().join('|');
    const ps = out.src[k] && out.src[k].via === 'onedrive' ? out.src[k].sig : null;
    if (!opts.force && ps === sig && out[k]) { status.results[k] = { ok: true, unchanged: true, n: out[k].length, last: out.src[k].last, files: out.src[k].files }; continue; }
    changed = true;
    const files = lists[k].slice().sort((a, b) => (a.modified || '') < (b.modified || '') ? -1 : 1); // el más reciente manda
    const got = { bk: [], mkp: [] }, used = { bk: [], mkp: [] }, skipped = [];
    for (const f of files) {
      try {
        const wb = XLSX.read(await f.get(), { type: 'buffer', cellDates: false, dense: true });
        const r = SLCap.parseCapacityWorkbook(XLSX, wb, f.name);
        const kk = r.kind === 'cap-bk' ? 'bk' : 'mkp';
        got[kk] = SLCap.mergeRows(got[kk], r.rows); used[kk].push(f.name);
        if (r.sheets) used[kk + 'Sheets'] = (used[kk + 'Sheets'] || 0) + r.sheets.length;
      } catch (e) { skipped.push(f.name + ': ' + e.message); }
    }
    let any = false;
    for (const kk of ['bk', 'mkp']) {
      if (!got[kk].length) continue; any = true;
      out[kk] = SLCap.mergeRows(out[kk], got[kk]); // se conserva el histórico ya publicado
      out.src[kk] = { via: 'onedrive', at, last: out[kk][out[kk].length - 1][0], n: out[kk].length, files: used[kk], sheets: used[kk + 'Sheets'], sig: kk === k ? lists[k].map(f => f.sig).sort().join('|') : (out.src[kk] && out.src[kk].sig) };
    }
    status.results[k] = any && got[k].length
      ? { ok: true, n: out[k].length, last: out.src[k].last, files: used[k], skipped: skipped.length ? skipped : undefined }
      : { ok: false, error: 'Ningún Excel válido en ' + LBL[k] + (skipped.length ? ' (' + skipped.join(' · ') + ')' : '') };
  }
  const okAny = Object.values(status.results).some(x => x.ok);
  if (changed && okAny) {
    out.at = at;
    const body = gzipSync(Buffer.from(JSON.stringify(out)));
    await store.set('capacity', body, { metadata: { updatedAt: at, size: body.length, file: 'Sincronización OneDrive' } });
  }
  status.changed = changed;
  const sb = gzipSync(Buffer.from(JSON.stringify(status)));
  await store.set('capsync', sb, { metadata: { updatedAt: at, size: sb.length, file: okAny ? 'ok' : 'error' } });
  return status;
}
