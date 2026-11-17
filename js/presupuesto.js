/* =========================================================================
   BLAS REPARACIONES · Presupuestador Inteligente (Excel / CSV / PDF)
   ========================================================================= */
'use strict';

const Presupuesto = (() => {
  const NAME_KEYS = ['descripcion', 'producto', 'articulo', 'detalle', 'modelo', 'nombre', 'repuesto', 'item', 'description', 'product', 'name'];
  const EXTRA_KEYS = ['marca', 'modelo', 'compat', 'linea', 'categoria', 'rubro'];
  const PRICE_KEYS = ['precio', 'costo', 'price', 'importe', 'valor', 'unitario', 'p.unit', 'p. unit', 'neto', 'cost', 'lista'];
  const MAX_RESULTS = 80;

  let index = [];
  let results = [];
  let manualCost = 0;
  let toBoletaTarget = null;

  /* --------------------------------- Cálculo -------------------------------- */
  function calc(cost) {
    const c = Math.round(Number(cost) || 0);
    const envio = Math.round(Number(Store.config.envio) || 0);
    const ganancia = Math.round(Number(Store.config.ganancia) || 0);
    const sum = c + envio + ganancia;
    let final = sum > 0 ? Math.ceil(sum / 1000) * 1000 : 0;
    if (Store.config.redondeoPsicologico && final >= 10000 && final % 10000 === 0) {
      final -= 1000;
    }
    return { cost: c, envio, ganancia, sum, final };
  }

  /* ------------------------------ Parse helpers ----------------------------- */
  function cellNumber(v) {
    if (typeof v === 'number') return isFinite(v) ? v : NaN;
    const s = String(v ?? '').trim();
    if (!s) return NaN;
    if (!/^(US\$|U\$S|USD|ARS|\$)?\s*-?[\d.,]+\s*(ARS|USD)?$/i.test(s)) return NaN;
    return U.parseNumber(s);
  }

  function hasLetters(s) { return /[a-záéíóúñ]/i.test(String(s)); }

  function cleanName(s) {
    return String(s ?? '').replace(/\s+/g, ' ').replace(/^[-–•·|:;,.\s]+|[-–•·|:;,\s]+$/g, '').trim().slice(0, 220);
  }

  function extractRows(rows) {
    const out = [];
    let headerRow = -1, nameCol = -1, priceCol = -1;
    const extraCols = [];

    for (let r = 0; r < Math.min(rows.length, 40); r++) {
      const cells = (rows[r] || []).map(c => U.norm(c));
      const pc = cells.findIndex(c => c && c.length < 40 && PRICE_KEYS.some(k => c.includes(k)));
      const nc = cells.findIndex((c, i) => i !== pc && c && c.length < 40 && NAME_KEYS.some(k => c.includes(k)));
      if (pc > -1 && nc > -1) {
        headerRow = r; priceCol = pc; nameCol = nc;
        cells.forEach((c, i) => {
          if (i !== nc && i !== pc && c && c.length < 40 && EXTRA_KEYS.some(k => c.includes(k))) extraCols.push(i);
        });
        break;
      }
    }

    for (let r = headerRow + 1; r < rows.length; r++) {
      const row = rows[r] || [];
      if (!row.length) continue;
      let name = '';
      let cost = NaN;
      if (headerRow > -1) {
        cost = cellNumber(row[priceCol]);
        const parts = [row[nameCol], ...extraCols.map(i => row[i])]
          .map(v => String(v ?? '').trim()).filter(Boolean);
        name = parts.join(' ');
        if (!hasLetters(name)) {
          name = row.filter((v, i) => i !== priceCol && typeof v === 'string' && hasLetters(v)).join(' ');
        }
      } else {
        const nums = [];
        const texts = [];
        row.forEach(v => {
          const n = cellNumber(v);
          if (!isNaN(n)) nums.push(n);
          else if (hasLetters(v)) texts.push(String(v).trim());
        });
        const positives = nums.filter(n => n > 0);
        cost = positives.length ? positives[positives.length - 1] : NaN;
        name = texts.join(' ');
      }
      name = cleanName(name);
      if (name.length >= 2 && hasLetters(name) && cost > 0) out.push({ n: name, c: Math.round(cost * 100) / 100 });
    }
    return out;
  }

  function detectDelimiter(text) {
    const sample = text.split(/\r?\n/).slice(0, 15).join('\n');
    const counts = { ';': (sample.match(/;/g) || []).length, ',': (sample.match(/,/g) || []).length, '\t': (sample.match(/\t/g) || []).length };
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  }

  async function parseSheet(file) {
    if (typeof XLSX === 'undefined') throw new Error('SheetJS no está disponible (sin conexión al CDN).');
    const ext = file.name.split('.').pop().toLowerCase();
    let wb;
    if (ext === 'csv' || ext === 'txt') {
      const text = await file.text();
      wb = XLSX.read(text, { type: 'string', FS: detectDelimiter(text), raw: false });
    } else {
      const buf = await file.arrayBuffer();
      wb = XLSX.read(buf, { type: 'array' });
    }
    const out = [];
    wb.SheetNames.forEach(sn => {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, raw: true, defval: '' });
      out.push(...extractRows(rows));
    });
    return out;
  }

  const PRICE_RE = /(?:US\$|U\$S|\$)?\s?\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?(?!\d)|(?:US\$|U\$S|\$)\s?\d+(?:[.,]\d{1,2})?(?!\d)|(?<![\w.,])\d+[.,]\d{2}(?![\w.,])|(?<![\w.,])\d{3,}(?![\w.,])/g;

  function parsePdfLine(text) {
    const matches = [...text.matchAll(PRICE_RE)];
    if (!matches.length) return null;
    const m = matches[matches.length - 1];
    const cost = U.parseNumber(m[0]);
    const name = cleanName(text.slice(0, m.index) + ' ' + text.slice(m.index + m[0].length));
    if (!(cost > 0) || name.length < 3 || !hasLetters(name)) return null;
    return { n: name, c: Math.round(cost * 100) / 100 };
  }

  async function parsePDF(file) {
    if (typeof pdfjsLib === 'undefined') throw new Error('PDF.js no está disponible (sin conexión al CDN).');
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
    const out = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const tc = await page.getTextContent();
      const lines = [];
      tc.items.forEach(it => {
        if (!it.str || !it.str.trim()) return;
        const x = it.transform[4];
        const y = it.transform[5];
        const tol = Math.max(2, (it.height || 8) * 0.45);
        let line = lines.find(l => Math.abs(l.y - y) <= tol);
        if (!line) { line = { y, items: [] }; lines.push(line); }
        line.items.push({ x, str: it.str, w: it.width || 0 });
      });
      lines.sort((a, b) => b.y - a.y);
      lines.forEach(l => {
        l.items.sort((a, b) => a.x - b.x);
        const text = l.items.map(i => i.str.trim()).join(' ');
        const parsed = parsePdfLine(text);
        if (parsed) out.push(parsed);
      });
    }
    return out;
  }

  async function handleFile(file) {
    if (!file) return;
    const status = U.$('#plStatus');
    status.innerHTML = `<span class="spinner spinner-dark"></span> Procesando <b>${U.esc(file.name)}</b>…`;
    status.classList.remove('hidden');
    try {
      const ext = file.name.split('.').pop().toLowerCase();
      const items = ext === 'pdf' ? await parsePDF(file) : await parseSheet(file);
      if (!items.length) throw new Error('No se detectaron filas con nombre y precio en el archivo.');
      const listObj = {
        id: U.uid(),
        name: file.name.replace(/\.[^.]+$/, ''),
        fileName: file.name,
        type: ext,
        items,
        loadedAt: Date.now()
      };
      await Store.savePriceList(listObj);
      status.innerHTML = `<span class="text-emerald-700 font-medium">✔ ${items.length.toLocaleString('es-AR')} productos importados de ${U.esc(file.name)}</span>`;
      U.toast(`Lista cargada: ${items.length} productos`, 'success');
      U.$('#pSearch').focus();
    } catch (e) {
      console.error(e);
      status.innerHTML = `<span class="text-red-600 font-medium">✖ ${U.esc(e.message)}</span>`;
      U.toast(e.message, 'error', 5000);
    }
  }

  /* --------------------------------- Índice --------------------------------- */
  function buildIndex() {
    index = [];
    Store.getPriceLists().forEach(l => {
      (l.items || []).forEach(it => {
        const nn = U.norm(it.n);
        index.push({ n: it.n, c: Number(it.c) || 0, nn, nc: nn.replace(/[\s\-_/.]+/g, ''), list: l.name });
      });
    });
    renderLists();
    search();
  }

  function renderLists() {
    const lists = Store.getPriceLists();
    const box = U.$('#plList');
    if (!lists.length) {
      box.innerHTML = '<p class="text-sm text-gray-500">Todavía no cargaste listas. Subí un Excel, CSV o PDF de tu proveedor.</p>';
    } else {
      box.innerHTML = lists.map(l => `
        <div class="flex items-center gap-3 p-2.5 rounded-xl border border-gray-200 bg-gray-50">
          <div class="w-9 h-9 shrink-0 rounded-lg grid place-items-center ${l.type === 'pdf' ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-700'}">
            <i data-lucide="${l.type === 'pdf' ? 'file-text' : 'file-spreadsheet'}" class="w-5 h-5"></i>
          </div>
          <div class="min-w-0 flex-1">
            <div class="font-semibold text-sm truncate">${U.esc(l.name)}</div>
            <div class="text-xs text-gray-500">${(l.items || []).length.toLocaleString('es-AR')} productos · ${U.fmtDate(l.loadedAt, true)}</div>
          </div>
          <button class="icon-btn text-red-600 hover:bg-red-50" data-del-list="${l.id}" title="Eliminar lista" aria-label="Eliminar lista"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
        </div>`).join('');
    }
    U.$('#pIndexCount').textContent = index.length
      ? `${index.length.toLocaleString('es-AR')} productos en ${lists.length} lista(s)`
      : 'Sin listas cargadas';
    U.icons();
  }

  /* -------------------------------- Búsqueda -------------------------------- */
  function search() {
    const q = U.$('#pSearch').value;
    const tokens = U.norm(q).split(' ').filter(Boolean);
    const box = U.$('#pResults');
    const info = U.$('#pResultsInfo');
    if (!tokens.length) {
      results = [];
      info.textContent = index.length ? 'Escribí un modelo o repuesto para buscar (ej: "A30 modulo", "G15").' : '';
      box.innerHTML = index.length ? '' : emptyState();
      U.icons();
      return;
    }
    const all = [];
    for (const it of index) {
      if (tokens.every(t => it.nn.includes(t) || it.nc.includes(t))) {
        all.push(it);
      }
    }
    all.sort((a, b) => a.n.length - b.n.length || a.c - b.c);
    results = all.slice(0, MAX_RESULTS);
    info.textContent = all.length
      ? `${all.length.toLocaleString('es-AR')} resultado(s)${all.length > MAX_RESULTS ? ` · mostrando ${MAX_RESULTS}, refiná la búsqueda` : ''}`
      : 'Sin resultados. Probá con menos palabras o usá la calculadora manual.';
    box.innerHTML = results.map((it, i) => resultCard(it, i)).join('');
    U.icons();
  }

  function emptyState() {
    return `<div class="text-center py-10 px-4 text-gray-500">
      <i data-lucide="file-spreadsheet" class="w-12 h-12 mx-auto mb-3 text-gray-300"></i>
      <p class="font-semibold text-gray-700">Cargá una lista de precios para empezar</p>
      <p class="text-sm mt-1">Se guarda en el dispositivo para no tener que subirla cada vez.</p>
    </div>`;
  }

  function resultCard(it, i) {
    const r = calc(it.c);
    return `
      <article class="p-3.5 sm:p-4 rounded-2xl border border-gray-200 bg-white hover:border-gray-300 transition">
        <div class="flex items-start gap-3">
          <div class="min-w-0 flex-1">
            <h3 class="font-semibold text-gray-900 leading-snug break-words">${U.esc(it.n)}</h3>
            <div class="text-[11px] text-gray-400 mt-0.5 truncate">${U.esc(it.list)}</div>
          </div>
          <div class="text-right shrink-0">
            <div class="text-[11px] uppercase tracking-wide text-gray-500">Precio final</div>
            <div class="text-xl sm:text-2xl font-extrabold text-gray-900">${U.money(r.final)}</div>
          </div>
        </div>
        <div class="mt-2 text-xs sm:text-sm text-gray-600 flex flex-wrap gap-x-2 gap-y-1">
          <span>Costo <b class="text-gray-800">${U.money(r.cost)}</b></span>
          <span class="text-gray-400">+</span><span>${U.money(r.envio)} envío</span>
          <span class="text-gray-400">+</span><span>${U.money(r.ganancia)} ganancia</span>
          <span class="text-gray-400">=</span><span>${U.money(r.sum)}</span>
          <span class="text-gray-400">→</span><span class="font-semibold text-emerald-700">${U.money(r.final)}</span>
        </div>
        <div class="mt-3 grid grid-cols-2 gap-2">
          <button class="btn btn-wa btn-sm" data-copy="${i}"><i data-lucide="message-circle" class="w-4 h-4"></i><span>Copiar presupuesto</span></button>
          <button class="btn btn-secondary btn-sm" data-boleta="${i}"><i data-lucide="file-input" class="w-4 h-4"></i><span>Pasar a boleta</span></button>
        </div>
      </article>`;
  }

  /* ---------------------------- Textos / Detección -------------------------- */
  const BRANDS = [
    ['samsung', 'Samsung'], ['motorola', 'Motorola'], ['moto ', 'Motorola'], ['iphone', 'Apple'], ['apple', 'Apple'],
    ['xiaomi', 'Xiaomi'], ['redmi', 'Xiaomi'], ['poco', 'Xiaomi'], ['huawei', 'Huawei'], ['honor', 'Honor'],
    ['lg ', 'LG'], ['nokia', 'Nokia'], ['tcl', 'TCL'], ['alcatel', 'Alcatel'], ['zte', 'ZTE'], ['oppo', 'Oppo'],
    ['realme', 'Realme'], ['vivo ', 'Vivo'], ['infinix', 'Infinix'], ['tecno', 'Tecno'], ['nubia', 'Nubia'], ['sony', 'Sony']
  ];
  const PARTS = [
    [['modulo', 'pantalla', 'display', 'lcd', 'oled', 'incell', 'amoled'], 'Cambio de módulo / pantalla', 'Módulo'],
    [['bateria', 'batery', 'battery'], 'Cambio de batería', 'Batería'],
    [['pin de carga', 'pin carga', 'conector de carga', 'placa de carga', 'flex de carga', 'placa carga', 'pin'], 'Cambio de pin / placa de carga', 'Pin de carga'],
    [['tapa', 'carcasa'], 'Cambio de tapa trasera', 'Tapa trasera'],
    [['camara'], 'Cambio de cámara', 'Cámara'],
    [['vidrio', 'glass', 'touch', 'tactil'], 'Cambio de vidrio / táctil', 'Vidrio / Táctil'],
    [['parlante', 'altavoz', 'speaker', 'auricular'], 'Cambio de parlante / auricular', 'Parlante / Auricular'],
    [['microfono'], 'Cambio de micrófono', 'Micrófono'],
    [['flex'], 'Cambio de flex', 'Flex']
  ];
  const PART_WORDS = ['modulo', 'pantalla', 'display', 'lcd', 'oled', 'incell', 'amoled', 'bateria', 'pin', 'carga', 'de', 'con', 'sin', 'marco', 'c/marco', 's/marco', 'tapa', 'camara', 'vidrio', 'glass', 'touch', 'flex', 'placa', 'conector', 'original', 'orig', 'premium', 'calidad', 'negro', 'blanco', 'azul', 'para', 'compatible'];

  function cleanProductName(raw) {
    let s = String(raw || '').trim();
    s = s.replace(/^[A-Z0-9]{1,5}-[A-Z0-9-]+\s+/i, '');
    s = s.replace(/(?:US\$|U\$S|USD|ARS|\$)\s*[\d.,]+/gi, ' ');
    s = s.replace(/\b(sileo|disponible|sin\s+stock|en\s+stock|hay\s+stock|agotado|link|consultar)\b/gi, ' ');
    s = s.replace(/(?:\s+\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|\s+\d{4,})+\s*$/g, '');
    s = s
      .replace(/\bmodulo\b/gi, 'Módulo')
      .replace(/\bbateria\b/gi, 'Batería')
      .replace(/\bcamara\b/gi, 'Cámara')
      .replace(/\btactil\b/gi, 'Táctil');
    s = s.replace(/\s+/g, ' ').replace(/^[-–•·|:;,.\s/]+|[-–•·|:;,.\s/]+$/g, '').trim();
    return s || String(raw || '').trim();
  }

  function detect(name, query) {
    const cleaned = cleanProductName(name);
    const n = ' ' + U.norm(cleaned + ' ' + (query || '')) + ' ';
    let marca = '';
    for (const [k, v] of BRANDS) { if (n.includes(' ' + k) || n.includes(k + ' ')) { marca = v; break; } }
    let falla = '';
    let tipo = '';
    for (const [keys, label, shortName] of PARTS) {
      if (keys.some(k => n.includes(k))) { falla = label; tipo = shortName; break; }
    }
    if (!falla) falla = 'Cambio de ' + cleaned;

    const brandWords = BRANDS.map(b => b[0].trim());
    const source = query && /\d/.test(query) ? query : cleaned;
    const tokens = String(source).split(/\s+/).filter(Boolean);
    const modelTokens = [];
    const suffix = /^(plus|pro|max|ultra|lite|mini|prime|power|play|neo|5g|4g|s|e|note|fe|edge)$/i;
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      const tn = U.norm(t);
      if (brandWords.includes(tn) || PART_WORDS.includes(tn)) continue;
      if (/\d/.test(t) && /^[a-z0-9+\-]+$/i.test(tn)) {
        const prev = tokens[i - 1] && U.norm(tokens[i - 1]);
        if (prev && /^(note|moto|galaxy|redmi|mi|poco|iphone|g|e|a|edge)$/.test(prev) && !modelTokens.length) modelTokens.push(tokens[i - 1]);
        modelTokens.push(t);
        while (tokens[i + 1] && suffix.test(tokens[i + 1])) { modelTokens.push(tokens[i + 1]); i++; }
        break;
      }
    }
    const modelo = modelTokens.join(' ').toUpperCase();
    return { marca, modelo, falla, tipo, cleaned };
  }

  function waText(name, final) {
    const c = Store.config;
    const q = U.$('#pSearch') ? U.$('#pSearch').value.trim() : '';
    const d = detect(name, q);
    const cleanLabel = (q && /\d/.test(q) && d.modelo && d.tipo)
      ? [d.tipo, d.marca, d.modelo].filter(Boolean).join(' ')
      : d.cleaned;
    return [
      '¡Hola! 👋 Te paso el presupuesto de *BLAS REPARACIONES* 🔧',
      '',
      `📱 *${cleanLabel}*`,
      `💲 Precio final: *${U.money(final)}*`,
      '',
      '✔️ Incluye repuesto, envío y mano de obra.',
      '✔️ Garantía de 30 días sobre la falla reparada.',
      '',
      c.address ? `📍 ${c.address}` : '',
      c.instagram ? `📷 Instagram: ${c.instagram}` : ''
    ].filter((l, i, arr) => !(l === '' && arr[i - 1] === '')).join('\n').trim();
  }

  function openToBoleta(name, final, baseCost = 0) {
    const q = U.$('#pSearch').value;
    const d = detect(name, q);
    const envio = Number(Store.config.envio) || 0;
    const costoInterno = baseCost > 0 ? Math.round(Number(baseCost) + envio) : 0;
    const gananciaInterna = Math.max(0, Math.round(final - costoInterno));
    toBoletaTarget = { name: d.cleaned, final, baseCost, envio, costoInterno, gananciaInterna };
    U.$('#tbModelo').value = d.modelo;
    U.$('#tbMarca').value = d.marca;
    U.$('#tbFalla').value = d.falla;
    U.$('#tbTotal').value = U.money(final);
    U.$('#tbRepuesto').textContent = d.cleaned;
    U.openModal('modalToBoleta');
  }

  /** Busca coincidencias en las listas de precios cargadas a partir de modelo/falla de la boleta */
  function matchForOrder({ modelo = '', marca = '', falla = '' } = {}) {
    if (!index.length) return [];
    const brandWords = BRANDS.map(b => b[0].trim());
    const modelTokens = U.norm(modelo)
      .split(/[\s/_-]+/)
      .filter(t => t && t.length >= 2 && !brandWords.includes(t) && !PART_WORDS.includes(t));
    if (!modelTokens.length) return [];

    const fallaNorm = U.norm(falla);
    let partKeys = [];
    for (const [keys] of PARTS) {
      if (keys.some(k => fallaNorm.includes(k))) { partKeys = keys; break; }
    }
    if (!partKeys.length && fallaNorm) {
      const stop = ['cambio', 'reparar', 'reparacion', 'arreglar', 'arreglo', 'roto', 'rota', 'falla', 'equipo', 'celular', 'para', 'del', 'con', 'sin'];
      partKeys = fallaNorm.split(/\s+/).filter(w => w.length >= 3 && !stop.includes(w));
    }

    const marcaNorm = U.norm(marca);
    const matches = [];
    for (const it of index) {
      const allModelPresent = modelTokens.every(t => it.nn.includes(t) || it.nc.includes(t));
      if (!allModelPresent) continue;
      if (partKeys.length && !partKeys.some(k => it.nn.includes(k))) continue;

      let score = 10;
      modelTokens.forEach(t => {
        const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`).test(it.nn)) score += 25;
      });
      if (marcaNorm && it.nn.includes(marcaNorm)) score += 8;
      if (partKeys.length && partKeys.some(k => it.nn.includes(k))) score += 12;
      matches.push({ it, score });
    }

    matches.sort((a, b) => b.score - a.score || a.it.n.length - b.it.n.length || a.it.c - b.it.c);
    return matches.slice(0, 5).map(({ it }) => {
      const r = calc(it.c);
      const costoInterno = Math.round(r.cost + r.envio);
      return {
        name: cleanProductName(it.n),
        rawName: it.n,
        cost: Math.round(r.cost),
        envio: Math.round(r.envio),
        costoInterno,
        final: r.final,
        ganancia: Math.max(0, Math.round(r.final - costoInterno)),
        list: it.list
      };
    });
  }

  /* ------------------------------ Calc manual ------------------------------- */
  function renderManual() {
    manualCost = U.parseMoney(U.$('#mCost').value);
    const r = calc(manualCost);
    U.$('#mBreakdown').innerHTML = manualCost
      ? `${U.money(r.cost)} + ${U.money(r.envio)} envío + ${U.money(r.ganancia)} ganancia = ${U.money(r.sum)}`
      : 'Ingresá el costo del repuesto';
    U.$('#mFinal').textContent = U.money(manualCost ? r.final : 0);
  }

  function renderParams() {
    const e = U.$('#pEnvio');
    const g = U.$('#pGanancia');
    const rp = U.$('#pRedondeoPsico');
    if (document.activeElement !== e) e.value = U.money(Store.config.envio);
    if (document.activeElement !== g) g.value = U.money(Store.config.ganancia);
    if (rp) rp.checked = !!Store.config.redondeoPsicologico;
  }

  /* --------------------------------- Init ----------------------------------- */
  function init() {
    if (window.pdfjsLib) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }

    const fileInput = U.$('#plFile');
    U.$('#plPick').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async () => {
      for (const f of Array.from(fileInput.files)) await handleFile(f);
      fileInput.value = '';
    });
    const drop = U.$('#plDrop');
    ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('drag'); }));
    ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('drag'); }));
    drop.addEventListener('drop', async e => {
      for (const f of Array.from(e.dataTransfer.files)) await handleFile(f);
    });

    U.$('#plList').addEventListener('click', async e => {
      const b = e.target.closest('[data-del-list]');
      if (!b) return;
      const l = Store.getPriceLists().find(x => x.id === b.dataset.delList);
      if (l && await U.confirm(`¿Eliminar la lista "${l.name}"?`, { okText: 'Eliminar', danger: true })) {
        await Store.removePriceList(l.id);
        U.toast('Lista eliminada');
      }
    });

    [['#pEnvio', 'envio'], ['#pGanancia', 'ganancia']].forEach(([sel, key]) => {
      const inp = U.$(sel);
      inp.addEventListener('focus', () => { inp.value = String(Store.config[key] || 0); requestAnimationFrame(() => inp.select()); });
      inp.addEventListener('blur', () => {
        const v = Math.max(0, U.parseMoney(inp.value));
        if (v !== Store.config[key]) Store.setConfig({ [key]: v });
        inp.value = U.money(v);
      });
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') inp.blur(); });
    });

    const rp = U.$('#pRedondeoPsico');
    if (rp) {
      rp.addEventListener('change', () => {
        Store.setConfig({ redondeoPsicologico: rp.checked });
      });
    }

    U.$('#pSearch').addEventListener('input', U.debounce(search, 150));
    U.$('#pClear').addEventListener('click', () => { U.$('#pSearch').value = ''; search(); U.$('#pSearch').focus(); });

    U.$('#pResults').addEventListener('click', async e => {
      const c = e.target.closest('[data-copy]');
      const b = e.target.closest('[data-boleta]');
      if (c) {
        const it = results[+c.dataset.copy];
        if (it && await U.copy(waText(it.n, calc(it.c).final))) U.toast('Presupuesto copiado. ¡Pegalo en WhatsApp!', 'success');
      } else if (b) {
        const it = results[+b.dataset.boleta];
        if (it) openToBoleta(it.n, calc(it.c).final, it.c);
      }
    });

    const mCost = U.$('#mCost');
    mCost.addEventListener('input', renderManual);
    U.$('#mCopy').addEventListener('click', async () => {
      if (!manualCost) { U.toast('Ingresá un costo', 'warn'); mCost.focus(); return; }
      const desc = U.$('#mDesc').value.trim() || 'Reparación';
      if (await U.copy(waText(desc, calc(manualCost).final))) U.toast('Presupuesto copiado', 'success');
    });
    U.$('#mBoleta').addEventListener('click', () => {
      if (!manualCost) { U.toast('Ingresá un costo', 'warn'); mCost.focus(); return; }
      openToBoleta(U.$('#mDesc').value.trim() || 'Reparación', calc(manualCost).final, manualCost);
    });

    U.$('#tbConfirm').addEventListener('click', () => {
      const total = U.parseMoney(U.$('#tbTotal').value) || (toBoletaTarget ? toBoletaTarget.final : 0);
      const costoInterno = toBoletaTarget ? (toBoletaTarget.costoInterno || 0) : 0;
      const gananciaInterna = Math.max(0, total - costoInterno);
      Boleta.prefill({
        modelo: U.$('#tbModelo').value.trim(),
        marca: U.$('#tbMarca').value.trim(),
        falla: U.$('#tbFalla').value.trim(),
        total,
        costoInterno,
        gananciaInterna
      });
      U.closeModal('modalToBoleta');
      U.toast('Datos y ganancia cargados en la boleta. Completá el cliente.', 'success');
    });

    Store.on('priceLists', buildIndex);
    Store.on('config', () => { renderParams(); renderManual(); if (U.$('#pSearch').value) search(); });

    renderParams();
    renderManual();
    buildIndex();
  }

  return { init, calc, matchForOrder, cleanProductName };
})();
