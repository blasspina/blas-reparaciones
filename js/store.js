/* =========================================================================
   BLAS REPARACIONES · Utilidades + Almacenamiento (localStorage / IndexedDB)
   ========================================================================= */
'use strict';

const U = {
  uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
  },
  $(sel, root = document) { return root.querySelector(sel); },
  $$(sel, root = document) { return Array.from(root.querySelectorAll(sel)); },

  esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },

  norm(s) {
    return String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  },

  money(n) {
    const v = Math.round(Number(n) || 0);
    return '$ ' + v.toLocaleString('es-AR');
  },

  /** Interpreta números en formato AR/US: "84.100", "84,100.50", "$ 1.234,56", 84100 */
  parseNumber(v) {
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    let s = String(v ?? '').replace(/[^\d.,-]/g, '');
    if (!s || !/\d/.test(s)) return 0;
    const lastDot = s.lastIndexOf('.');
    const lastComma = s.lastIndexOf(',');
    if (lastDot > -1 && lastComma > -1) {
      if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.');
      else s = s.replace(/,/g, '');
    } else if (lastComma > -1) {
      if (/^-?\d{1,3}(,\d{3})+$/.test(s)) s = s.replace(/,/g, '');
      else s = s.replace(/,/g, '.');
    } else if (lastDot > -1) {
      if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    }
    const n = parseFloat(s);
    return isFinite(n) ? n : 0;
  },

  parseMoney(v) { return Math.round(U.parseNumber(v)); },

  pad8(n) { return String(Math.max(0, parseInt(n, 10) || 0)).padStart(8, '0'); },

  debounce(fn, ms = 200) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  },

  fmtDate(ts, withTime = false) {
    if (!ts) return '';
    const d = new Date(ts);
    const opts = { day: '2-digit', month: '2-digit', year: '2-digit' };
    if (withTime) Object.assign(opts, { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleString('es-AR', opts);
  },

  fechaOrden(f) {
    if (!f) return '';
    return [f.d, f.m, f.a].filter(Boolean).join('/');
  },

  toast(msg, type = 'ok', ms = 3200) {
    const wrap = document.getElementById('toasts');
    if (!wrap) return;
    const el = document.createElement('div');
    const colors = {
      ok: 'bg-gray-900 text-white',
      success: 'bg-emerald-600 text-white',
      error: 'bg-red-600 text-white',
      warn: 'bg-amber-500 text-gray-900'
    };
    el.className = `toast pointer-events-auto px-4 py-3 rounded-xl shadow-lg text-sm font-medium max-w-sm ${colors[type] || colors.ok}`;
    el.textContent = msg;
    wrap.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 300);
    }, ms);
  },

  async copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
      ta.remove();
      return ok;
    }
  },

  openModal(id) {
    const d = document.getElementById(id);
    if (d && !d.open) d.showModal();
    U.icons();
  },
  closeModal(id) {
    const d = document.getElementById(id);
    if (d && d.open) d.close();
  },

  confirm(message, { title = 'Confirmar', okText = 'Aceptar', cancelText = 'Cancelar', danger = false } = {}) {
    return new Promise(resolve => {
      const dlg = document.getElementById('modalConfirm');
      U.$('#confirmTitle').textContent = title;
      U.$('#confirmMsg').textContent = message;
      const ok = U.$('#confirmOk');
      const cancel = U.$('#confirmCancel');
      ok.textContent = okText;
      cancel.textContent = cancelText;
      ok.className = `btn ${danger ? 'btn-danger' : 'btn-primary'}`;
      const done = (val) => {
        ok.onclick = null; cancel.onclick = null; dlg.onclose = null;
        if (dlg.open) dlg.close();
        resolve(val);
      };
      ok.onclick = () => done(true);
      cancel.onclick = () => done(false);
      dlg.onclose = () => done(false);
      dlg.showModal();
    });
  },

  icons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
  },

  readFileAsDataURL(file) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = () => rej(r.error);
      r.readAsDataURL(file);
    });
  },

  /** Redimensiona una imagen (dataURL) a un máximo de px para ahorrar almacenamiento */
  resizeImage(dataUrl, max = 400, mime = 'image/png') {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const ctx = c.getContext('2d');
        if (mime === 'image/jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); }
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, w, h);
        res(c.toDataURL(mime, 0.9));
      };
      img.onerror = () => rej(new Error('Imagen inválida'));
      img.src = dataUrl;
    });
  },

  /** Normaliza un teléfono argentino al formato internacional de WhatsApp (549 + área + número) */
  waPhone(tel) {
    const prefix = String((Store.config.countryPrefix || '549')).replace(/\D/g, '');
    let d = String(tel || '').replace(/\D/g, '');
    if (!d) return '';
    if (d.startsWith('00')) d = d.slice(2);
    if (prefix.startsWith('54')) {
      if (d.startsWith('549') && d.length >= 12) return d;
      if (d.startsWith('54') && d.length >= 11) return '549' + d.slice(2).replace(/^0/, '');
      d = d.replace(/^0/, '');
      if (d.length === 12) {
        for (const i of [2, 3, 4]) {
          if (d.substr(i, 2) === '15') { d = d.slice(0, i) + d.slice(i + 2); break; }
        }
      }
      return prefix + d;
    }
    if (d.startsWith(prefix)) return d;
    return prefix + d.replace(/^0/, '');
  },

  openWA(phone, text) {
    const num = phone ? U.waPhone(phone) : '';
    const url = `https://wa.me/${num}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener');
  },

  downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  },

  slug(s) {
    return U.norm(s).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40) || 'cliente';
  }
};

/* ---------------------------- IndexedDB (kv) ---------------------------- */
const IDB = (() => {
  let dbp = null;
  function open() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      if (!('indexedDB' in window)) return rej(new Error('IndexedDB no disponible'));
      const req = indexedDB.open('blasrep_db', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('kv');
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
    return dbp;
  }
  async function get(key) {
    try {
      const db = await open();
      return await new Promise((res, rej) => {
        const r = db.transaction('kv', 'readonly').objectStore('kv').get(key);
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
    } catch (e) {
      const raw = localStorage.getItem('blasrep_kv_' + key);
      return raw ? JSON.parse(raw) : undefined;
    }
  }
  async function set(key, val) {
    try {
      const db = await open();
      await new Promise((res, rej) => {
        const tx = db.transaction('kv', 'readwrite');
        tx.objectStore('kv').put(val, key);
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      });
    } catch (e) {
      localStorage.setItem('blasrep_kv_' + key, JSON.stringify(val));
    }
  }
  return { get, set };
})();

/* ------------------------------- Store ---------------------------------- */
const Store = (() => {
  const KEY = 'blasrep_data_v1';
  const DEFAULT_CONFIG = {
    nextNumber: 251,
    logo: '',
    qrMode: 'auto',
    qrImage: '',
    qrTarget: 'https://wa.me/5492255551419',
    address: 'AV.29 E/ PASEO 113 Y 113 BIS. N°1423',
    whatsapp: '2255 551419',
    instagram: 'BLAS.REPARACIONES',
    countryPrefix: '549',
    envio: 10000,
    ganancia: 30000,
    redondeoPsicologico: true,
    updatedAt: 0
  };

  const data = { config: { ...DEFAULT_CONFIG }, orders: [], stock: [] };
  let priceLists = [];
  const listeners = {};

  function on(evt, fn) { (listeners[evt] = listeners[evt] || []).push(fn); }
  function emit(evt, payload) {
    (listeners[evt] || []).forEach(fn => { try { fn(payload); } catch (e) { console.error(e); } });
  }

  function normOrder(o) {
    const toArr = v => Array.isArray(v) ? v.filter(x => x !== null && x !== undefined) : Object.values(v || {});
    return {
      ...o,
      senaMetodo: o.senaMetodo || 'Efectivo',
      pagos: toArr(o.pagos),
      patron: toArr(o.patron).map(Number),
      historial: toArr(o.historial),
      repuestos: toArr(o.repuestos),
      fecha: o.fecha || { d: '', m: '', a: '' }
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return;
      const p = JSON.parse(raw);
      data.config = { ...DEFAULT_CONFIG, ...(p.config || {}) };
      data.orders = (p.orders || []).map(normOrder);
      data.stock = p.stock || [];
    } catch (e) {
      console.error('Error leyendo datos locales', e);
    }
  }

  function persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) {
      U.toast('El almacenamiento local está lleno. Exportá un respaldo y reducí el tamaño del logo/QR.', 'error', 6000);
    }
  }

  function list(col) { return data[col].filter(x => !x.deleted); }
  function raw(col) { return data[col]; }
  function get(col, id) { return data[col].find(x => x.id === id && !x.deleted) || null; }

  function upsert(col, item) {
    item.updatedAt = Date.now();
    if (col === 'orders') item = normOrder(item);
    const idx = data[col].findIndex(x => x.id === item.id);
    if (idx > -1) data[col][idx] = item; else data[col].push(item);
    persist();
    if (window.Sync) Sync.pushItem(col, item);
    emit(col);
    return item;
  }

  function remove(col, id) {
    const it = data[col].find(x => x.id === id);
    if (!it) return;
    it.deleted = true;
    it.updatedAt = Date.now();
    persist();
    if (window.Sync) Sync.pushItem(col, it);
    emit(col);
  }

  function setConfig(patch, { forceNumber = false } = {}) {
    Object.assign(data.config, patch, { updatedAt: Date.now() });
    persist();
    if (window.Sync) Sync.pushConfig(data.config, forceNumber);
    emit('config');
  }

  function applyRemote(col, arr) {
    const merged = mergeArrays(data[col], arr);
    data[col] = col === 'orders' ? merged.map(normOrder) : merged;
    persist();
    emit(col);
  }

  function applyRemoteConfig(cfg) {
    data.config = { ...DEFAULT_CONFIG, ...cfg };
    persist();
    emit('config');
  }

  function mergeArrays(a, b) {
    const map = new Map();
    [...(a || []), ...(b || [])].forEach(it => {
      if (!it || !it.id) return;
      const prev = map.get(it.id);
      if (!prev || (it.updatedAt || 0) >= (prev.updatedAt || 0)) map.set(it.id, it);
    });
    return Array.from(map.values());
  }

  function nextFreeNumber() {
    const used = new Set(list('orders').map(o => o.numero));
    let n = Math.max(data.config.nextNumber || 1, 1);
    while (used.has(n)) n++;
    return n;
  }

  /* ---- Listas de precios (IndexedDB) ---- */
  async function loadPriceLists() {
    priceLists = (await IDB.get('priceLists')) || [];
    emit('priceLists');
  }
  function getPriceLists() { return priceLists.filter(l => !l.deleted); }
  function rawPriceLists() { return priceLists; }
  async function savePriceList(listObj) {
    listObj.updatedAt = Date.now();
    const idx = priceLists.findIndex(l => l.id === listObj.id);
    if (idx > -1) priceLists[idx] = listObj; else priceLists.push(listObj);
    await IDB.set('priceLists', priceLists);
    if (window.Sync) Sync.pushPriceList(listObj);
    emit('priceLists');
  }
  async function removePriceList(id) {
    const l = priceLists.find(x => x.id === id);
    if (!l) return;
    l.deleted = true;
    l.items = [];
    l.updatedAt = Date.now();
    await IDB.set('priceLists', priceLists);
    if (window.Sync) Sync.pushPriceList(l);
    emit('priceLists');
  }
  async function applyRemotePriceLists(arr) {
    const merged = mergeArrays(priceLists, arr);
    priceLists = merged.map(l => ({ ...l, items: Array.isArray(l.items) ? l.items : Object.values(l.items || {}) }));
    await IDB.set('priceLists', priceLists);
    emit('priceLists');
  }

  /* ---- Respaldo JSON ---- */
  function exportJSON() {
    return {
      app: 'blas-reparaciones',
      version: 1,
      exportedAt: new Date().toISOString(),
      config: data.config,
      orders: data.orders,
      stock: data.stock,
      priceLists
    };
  }

  async function importJSON(obj, mode = 'merge') {
    if (!obj || typeof obj !== 'object' || (!obj.orders && !obj.stock && !obj.config)) {
      throw new Error('El archivo no es un respaldo válido de BLAS REPARACIONES');
    }
    if (mode === 'replace') {
      data.config = { ...DEFAULT_CONFIG, ...(obj.config || {}), updatedAt: Date.now() };
      data.orders = (obj.orders || []).map(normOrder);
      data.stock = obj.stock || [];
      priceLists = obj.priceLists || [];
    } else {
      data.orders = mergeArrays(data.orders, obj.orders || []).map(normOrder);
      data.stock = mergeArrays(data.stock, obj.stock || []);
      priceLists = mergeArrays(priceLists, obj.priceLists || []);
      if (obj.config) {
        const nn = Math.max(data.config.nextNumber || 0, obj.config.nextNumber || 0);
        if ((obj.config.updatedAt || 0) > (data.config.updatedAt || 0)) data.config = { ...DEFAULT_CONFIG, ...obj.config };
        data.config.nextNumber = nn;
        data.config.updatedAt = Date.now();
      }
    }
    persist();
    await IDB.set('priceLists', priceLists);
    if (window.Sync) await Sync.pushAll();
    ['orders', 'stock', 'config', 'priceLists'].forEach(emit);
  }

  load();

  return {
    DEFAULT_CONFIG,
    get config() { return data.config; },
    on, emit, list, raw, get, upsert, remove, setConfig,
    applyRemote, applyRemoteConfig, mergeArrays, nextFreeNumber,
    loadPriceLists, getPriceLists, rawPriceLists, savePriceList, removePriceList, applyRemotePriceLists,
    exportJSON, importJSON
  };
})();
