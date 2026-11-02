/* ==========================================================================
   SmartLayout CALLAO · Módulo 5 · Parser de capacidad de almacenamiento
   Código puro (sin dependencias): se usa en el navegador y en Netlify Functions.
   ========================================================================== */
var SLCap = (function () {
  'use strict';
  var MES = { ENE: 1, FEB: 2, MAR: 3, ABR: 4, MAY: 5, JUN: 6, JUL: 7, AGO: 8, SET: 9, SEP: 9, OCT: 10, NOV: 11, NOM: 11, DIC: 12 };
  function nrm(s) { return String(s == null ? '' : s).toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim(); }
  function iso(serial) { return new Date(Date.UTC(1899, 11, 30) + Math.round(serial) * 86400000).toISOString().slice(0, 10); }
  function num(v) { return typeof v === 'number' && isFinite(v) ? v : (typeof v === 'string' && v.trim() !== '' && isFinite(+v) ? +v : null); }
  function dim(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }

  /* ---------- Backus + envases: hoja "Seguimiento" ---------- */
  var BK_COLS = { dia: 'DIA', capTot: 'CAPACIDAD', capEnv: 'CAPC EERR', env: 'ENVASES', capPH: 'CAPC - PH', ph: 'TOTAL - PH', rtPH: 'RT - PH', nrPH: 'NRT - PH', hl: 'TOTAL - HL', capCA: 'CAPC - CA', ca: 'TOTAL - CA', rtCA: 'RT - CA', nrCA: 'NRT - CA' };
  function parseSeguimiento(XLSX, ws) {
    var aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
    var hr = -1, H;
    for (var i = 0; i < Math.min(30, aoa.length); i++) { H = (aoa[i] || []).map(function (x) { return nrm(x).replace(/\s*-\s*/g, ' - '); }); if (H.indexOf('TOTAL - PH') >= 0) { hr = i; break; } }
    if (hr < 0) throw new Error('La hoja "Seguimiento" no tiene la columna "TOTAL - PH".');
    var c = {};
    Object.keys(BK_COLS).forEach(function (k) { c[k] = H.indexOf(BK_COLS[k]); });
    if (c.dia < 0) c.dia = 0;
    var rows = [], seen = {};
    for (var r = hr + 1; r < aoa.length; r++) {
      var x = aoa[r]; if (!x) continue;
      var d = num(x[c.dia]); if (!d || d < 40000 || d > 80000) continue;
      var ph = c.ph >= 0 ? num(x[c.ph]) : null; if (ph === null || ph <= 0) continue;
      var g = function (k) { return c[k] >= 0 ? num(x[c[k]]) : null; };
      var day = iso(d); if (seen[day]) continue; seen[day] = 1;
      var R = function (v, k) { return v === null ? null : Math.round(v * (k || 1)) / (k || 1); };
      // [fecha, RT-PH, NRT-PH, TOTAL-PH, TOTAL-HL, RT-CA, NRT-CA, TOTAL-CA, ENVASES, CAPC-PH, CAPC-CA, CAPC-EERR]
      rows.push([day, R(g('rtPH')), R(g('nrPH')), R(ph), R(g('hl'), 10), R(g('rtCA')), R(g('nrCA')), R(g('ca')), R(g('env')), g('capPH'), g('capCA'), g('capEnv')]);
    }
    rows.sort(function (a, b) { return a[0] < b[0] ? -1 : 1; });
    return rows;
  }

  /* ---------- Marketplace: hojas "KPI WU MKP <MES> <AÑO>" ---------- */
  function sheetPeriod(name) {
    var n = nrm(name).replace(/[^A-Z0-9 ]/g, ' ');
    var m = /(ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SET|SEP|OCT|NOV|NOM|DIC)[A-Z]*\s*(\d{2,4})?\s*$/.exec(n.replace(/\s+$/, ''));
    if (!m) return null;
    return { m: MES[m[1]], y: m[2] ? (+m[2] < 100 ? 2000 + +m[2] : +m[2]) : null };
  }
  function parseMkpSheet(XLSX, ws, name) {
    var ref = ws['!ref']; if (!ref) return null;
    var rg = XLSX.utils.decode_range(ref); if (rg.e.c > 60) rg.e.c = 60; if (rg.e.r > 80) rg.e.r = 80;
    var aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, range: XLSX.utils.encode_range(rg) });
    var hi = -1; for (var i = 0; i < aoa.length; i++) if (aoa[i] && nrm(aoa[i][0]) === 'MES') { hi = i; break; }
    if (hi < 0) return null;
    var row = function (re) { for (var k = hi; k < aoa.length; k++) { var x = aoa[k]; if (x && re.test(nrm(x[0]))) return x; } return null; };
    var al = row(/^ALMACENADO/), cap = row(/^CAPACIDAD/), sk = row(/^N.?\s*SKU/), wu = row(/^WU/);
    if (!al) return null;
    var per = sheetPeriod(name), h = aoa[hi] || [], h2 = aoa[hi + 1] || [];
    var cands = []; for (var j = 2; j < Math.max(h.length, al.length); j++) [h[j], h2[j]].forEach(function (v) { var s = num(v); if (s && s > 40000 && s < 80000) cands.push(iso(s)); });
    if (per && !per.y) { // año: desde las fechas del encabezado que coincidan con el mes; si no, 2022 (inicio del registro)
      var ys = cands.filter(function (d) { return +d.slice(5, 7) === per.m; }).map(function (d) { return +d.slice(0, 4); });
      per.y = ys.length ? ys[0] : 2022;
    }
    if (!per) return null;
    var out = [], D = dim(per.y, per.m), used = {};
    for (var col = 2; col < al.length; col++) {
      var v = num(al[col]); if (v === null || v <= 0) continue;
      var day = null;
      [h2[col], h[col]].some(function (x) { var s = num(x); if (s && s > 40000 && s < 80000) { var d = iso(s); if (+d.slice(0, 4) === per.y && +d.slice(5, 7) === per.m && !used[d]) { day = d; return true; } } return false; });
      if (!day) { var dd = col - 1; if (dd > D) continue; day = per.y + '-' + ('0' + per.m).slice(-2) + '-' + ('0' + dd).slice(-2); if (used[day]) continue; }
      used[day] = 1;
      var cp = cap ? num(cap[col]) : null, s2 = sk ? num(sk[col]) : null;
      // [fecha, almacenado, capacidad, N° SKUs]
      out.push([day, Math.round(v), cp, s2]);
    }
    return { per: per, rows: out };
  }

  function parseCapacityWorkbook(XLSX, wb, name) {
    var names = wb.SheetNames;
    var seg = names.filter(function (n) { return nrm(n) === 'SEGUIMIENTO'; })[0];
    if (seg) return { kind: 'cap-bk', name: name, rows: parseSeguimiento(XLSX, wb.Sheets[seg]), sheet: seg };
    var mk = names.filter(function (n) { return /^KPI\s*WU\s*MKP/.test(nrm(n)); });
    if (mk.length) {
      var byDay = {}, sheets = [];
      mk.forEach(function (n) {
        var r = parseMkpSheet(XLSX, wb.Sheets[n], n); if (!r || !r.rows.length) return;
        sheets.push([n.trim(), r.per.y + '-' + ('0' + r.per.m).slice(-2), r.rows.length]);
        r.rows.forEach(function (x) { byDay[x[0]] = x; });
      });
      var rows = Object.keys(byDay).sort().map(function (k) { return byDay[k]; });
      return { kind: 'cap-mkp', name: name, rows: rows, sheets: sheets };
    }
    throw new Error('"' + name + '" no contiene la hoja "Seguimiento" ni hojas "KPI WU MKP".');
  }
  /* combina filas por fecha (las del segundo arreglo reemplazan a las del primero) */
  function mergeRows(a, b) {
    var m = {}; (a || []).forEach(function (r) { m[r[0]] = r; }); (b || []).forEach(function (r) { m[r[0]] = r; });
    return Object.keys(m).sort().map(function (k) { return m[k]; });
  }
  return { mergeRows: mergeRows, parseCapacityWorkbook: parseCapacityWorkbook, parseSeguimiento: parseSeguimiento, parseMkpSheet: parseMkpSheet, sheetPeriod: sheetPeriod };
})();

export { SLCap };
