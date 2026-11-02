// Descarga de archivos compartidos de OneDrive / SharePoint ("Cualquier persona con el vínculo")
export function sharesUrl(url) {
  const b64 = Buffer.from(url.trim(), 'utf8').toString('base64').replace(/=+$/, '').replace(/\//g, '_').replace(/\+/g, '-');
  return 'https://api.onedrive.com/v1.0/shares/u!' + b64 + '/root/content';
}
export function candidates(url) {
  const u = url.trim(); const out = [];
  if (/1drv\.ms|onedrive\.live\.com/i.test(u)) out.push(sharesUrl(u));
  if (/sharepoint\.com/i.test(u) || /1drv\.ms|onedrive\.live\.com/i.test(u)) out.push(u + (u.includes('?') ? '&' : '?') + 'download=1');
  if (/onedrive\.live\.com\/(redir|view|edit)/i.test(u)) out.push(u.replace(/\/(redir|view|edit)(\.aspx)?/i, '/download'));
  out.push(u);
  return [...new Set(out)];
}
export async function downloadShared(url, fetchImpl = fetch) {
  const errs = [];
  for (const c of candidates(url)) {
    try {
      const r = await fetchImpl(c, { redirect: 'follow', headers: { 'user-agent': 'SmartLayout-CALLAO/1.0' } });
      if (!r.ok) { errs.push(r.status); continue; }
      const b = Buffer.from(await r.arrayBuffer());
      if (b[0] === 0x50 && b[1] === 0x4b) return b; // archivo .xlsx (zip)
      errs.push('no es xlsx');
    } catch (e) { errs.push(e.message); }
  }
  throw new Error('No se pudo descargar el archivo (' + errs.join(', ') + '). Verifica que el enlace sea "Cualquier persona con el vínculo puede ver".');
}
