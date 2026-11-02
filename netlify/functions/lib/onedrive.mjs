// Lectura de carpetas y archivos compartidos de OneDrive ("Cualquier persona con el vínculo")
const isPersonal = u => /1drv\.ms|onedrive\.live\.com/i.test(u);
export function sharesBase(url) {
  const b64 = Buffer.from(url.trim(), 'utf8').toString('base64').replace(/=+$/, '').replace(/\//g, '_').replace(/\+/g, '-');
  return 'https://api.onedrive.com/v1.0/shares/u!' + b64;
}
export const sharesUrl = url => sharesBase(url) + '/root/content';
export function candidates(url) {
  const u = url.trim(); const out = [];
  if (isPersonal(u)) out.push(sharesUrl(u));
  if (/sharepoint\.com/i.test(u) || isPersonal(u)) out.push(u + (u.includes('?') ? '&' : '?') + 'download=1');
  if (/onedrive\.live\.com\/(redir|view|edit)/i.test(u)) out.push(u.replace(/\/(redir|view|edit)(\.aspx)?/i, '/download'));
  out.push(u);
  return [...new Set(out)];
}
const isXlsx = b => b[0] === 0x50 && b[1] === 0x4b;
export async function downloadShared(url, fetchImpl = fetch) {
  const errs = [];
  for (const c of candidates(url)) {
    try {
      const r = await fetchImpl(c, { redirect: 'follow', headers: { 'user-agent': 'SmartLayout-CALLAO/1.0' } });
      if (!r.ok) { errs.push(r.status); continue; }
      const b = Buffer.from(await r.arrayBuffer());
      if (isXlsx(b)) return b;
      errs.push('no es xlsx');
    } catch (e) { errs.push(e.message); }
  }
  throw new Error('No se pudo descargar (' + errs.join(', ') + '). Verifica que el enlace sea "Cualquier persona con el vínculo puede ver".');
}
/**
 * Lista los Excel de un enlace compartido. Si el enlace es una carpeta devuelve todos sus .xlsx;
 * si es un archivo devuelve ese único archivo.
 * → [{ name, size, modified, sig, get(): Promise<Buffer> }]
 */
export async function listShared(url, fetchImpl = fetch) {
  url = url.trim();
  if (isPersonal(url)) {
    let items = null;
    try {
      const r = await fetchImpl(sharesBase(url) + '/root/children?$top=999', { headers: { 'user-agent': 'SmartLayout-CALLAO/1.0', accept: 'application/json' } });
      if (r.ok) { const j = await r.json(); if (Array.isArray(j.value)) items = j.value; }
    } catch (e) { /* no es carpeta o no accesible: se intenta como archivo */ }
    if (items && items.length) {
      const xs = items.filter(it => it.file && /\.xls[xm]$/i.test(it.name) && !/^~\$/.test(it.name));
      if (!xs.length) throw new Error('La carpeta no contiene archivos Excel (.xlsx).');
      return xs.map(it => ({ name: it.name, size: it.size, modified: it.lastModifiedDateTime || '', sig: it.name + ':' + it.size + ':' + (it.lastModifiedDateTime || ''),
        async get() {
          const dl = it['@content.downloadUrl'] || it['@microsoft.graph.downloadUrl'];
          const r = await fetchImpl(dl || (sharesBase(url) + '/items/' + it.id + '/content'), { redirect: 'follow' });
          if (!r.ok) throw new Error(it.name + ': HTTP ' + r.status);
          const b = Buffer.from(await r.arrayBuffer()); if (!isXlsx(b)) throw new Error(it.name + ': no es un .xlsx'); return b;
        } }));
    }
  }
  // enlace a un archivo (o carpeta empresarial no listable)
  let buf;
  try { buf = await downloadShared(url, fetchImpl); }
  catch (e) {
    if (/sharepoint\.com\/:f:/i.test(url)) throw new Error('Las carpetas de OneDrive empresarial (SharePoint) requieren inicio de sesión. Comparte el archivo Excel individual o usa "Carpeta local" en admin.html.');
    throw e;
  }
  const crypto = await import('node:crypto');
  const h = crypto.createHash('sha1').update(buf).digest('hex').slice(0, 16);
  return [{ name: 'archivo compartido', size: buf.length, modified: '', sig: 'file:' + h, get: async () => buf }];
}
