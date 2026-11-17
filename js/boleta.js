/* =========================================================================
   BLAS REPARACIONES · Boleta Digital (Orden de Reparación)
   ========================================================================= */
'use strict';

const WA_PATH = 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z';

const QR = {
  /** Genera un QR (dataURL) con logo de WhatsApp al centro (corrección de error H) */
  dataURL(text, size = 480) {
    if (typeof qrcode !== 'function') return '';
    const qr = qrcode(0, 'H');
    qr.addData(String(text || ' '));
    qr.make();
    const n = qr.getModuleCount();
    const quiet = 2;
    const cell = Math.max(2, Math.floor(size / (n + quiet * 2)));
    const dim = cell * (n + quiet * 2);
    const c = document.createElement('canvas');
    c.width = dim; c.height = dim;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, dim, dim);
    ctx.fillStyle = '#000';
    for (let r = 0; r < n; r++) {
      for (let col = 0; col < n; col++) {
        if (qr.isDark(r, col)) ctx.fillRect((col + quiet) * cell, (r + quiet) * cell, cell, cell);
      }
    }
    const logo = dim * 0.2;
    const pad = logo * 0.18;
    const x = (dim - logo) / 2;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(dim / 2, dim / 2, logo / 2 + pad, 0, Math.PI * 2);
    ctx.fill();
    if (typeof Path2D === 'function') {
      ctx.save();
      ctx.translate(x, x);
      ctx.scale(logo / 24, logo / 24);
      ctx.fillStyle = '#000';
      ctx.fill(new Path2D(WA_PATH));
      ctx.restore();
    }
    return c.toDataURL('image/png');
  }
};

const Boleta = (() => {
  const DRAFT_KEY = 'blasrep_draft_v1';
  let currentId = null;
  let numberTouched = false;
  let currentMatches = [];
  let selectedMatchIdx = 0;

  const el = {};
  const ids = ['fNumero', 'fDia', 'fMes', 'fAnio', 'fNombre', 'fTel', 'fModelo', 'fMarca', 'fFalla',
    'fObs', 'fPass', 'fSena', 'fSaldo', 'fTotal'];

  function today() {
    const d = new Date();
    return {
      d: String(d.getDate()).padStart(2, '0'),
      m: String(d.getMonth() + 1).padStart(2, '0'),
      a: String(d.getFullYear()).slice(-2)
    };
  }

  /* --------------------------- Datos del formulario -------------------------- */
  function getData() {
    return {
      numero: parseInt(el.fNumero.value.replace(/\D/g, ''), 10) || 0,
      fecha: { d: el.fDia.value.trim(), m: el.fMes.value.trim(), a: el.fAnio.value.trim() },
      nombre: el.fNombre.value.trim(),
      tel: el.fTel.value.trim(),
      modelo: el.fModelo.value.trim(),
      marca: el.fMarca.value.trim(),
      falla: el.fFalla.value.trim(),
      observaciones: el.fObs.value.trim(),
      contrasena: el.fPass.value.trim(),
      patron: Pattern.get(),
      sena: U.parseMoney(el.fSena.value),
      senaMetodo: el.fSenaMetodo ? (el.fSenaMetodo.value || 'Efectivo') : 'Efectivo',
      total: U.parseMoney(el.fTotal.value),
      costoInterno: el.fCostoInterno ? U.parseMoney(el.fCostoInterno.value) : 0,
      gananciaInterna: el.fGananciaInterna ? U.parseMoney(el.fGananciaInterna.value) : 0
    };
  }

  function fmtMoneyField(v) { return v ? U.money(v) : ''; }

  function setData(o) {
    el.fNumero.value = U.pad8(o.numero || Store.config.nextNumber);
    const f = o.fecha || today();
    el.fDia.value = f.d || '';
    el.fMes.value = f.m || '';
    el.fAnio.value = f.a || '';
    el.fNombre.value = o.nombre || '';
    el.fTel.value = o.tel || '';
    el.fModelo.value = o.modelo || '';
    el.fMarca.value = o.marca || '';
    el.fFalla.value = o.falla || '';
    el.fObs.value = o.observaciones || '';
    el.fPass.value = o.contrasena || '';
    el.fSena.value = fmtMoneyField(o.sena);
    if (el.fSenaMetodo) el.fSenaMetodo.value = o.senaMetodo || 'Efectivo';
    el.fTotal.value = fmtMoneyField(o.total);
    if (el.fCostoInterno) el.fCostoInterno.value = fmtMoneyField(o.costoInterno);
    if (el.fGananciaInterna) el.fGananciaInterna.value = fmtMoneyField(o.gananciaInterna);
    Pattern.set(o.patron || []);
    recalc(false);
    updateProfitSuggest();
  }

  function registeredPayments() {
    if (!currentId) return 0;
    const ord = Store.get('orders', currentId);
    if (!ord || !Array.isArray(ord.pagos)) return 0;
    return ord.pagos.reduce((s, p) => s + (Number(p.monto) || 0), 0);
  }

  function recalc(updateProfit = true) {
    const total = U.parseMoney(el.fTotal.value);
    const sena = U.parseMoney(el.fSena.value);
    const pagos = registeredPayments();
    el.fSaldo.value = (total || sena || pagos) ? U.money(total - sena - pagos) : '';
    // La ganancia interna solo se recalcula cuando cambia el total o el costo (no al editar la seña)
    if (updateProfit && el.fCostoInterno && el.fGananciaInterna && document.activeElement !== el.fGananciaInterna) {
      const costo = U.parseMoney(el.fCostoInterno.value);
      if (costo > 0 && total > 0) {
        el.fGananciaInterna.value = U.money(Math.max(0, total - costo));
      }
    }
  }

  function updateProfitSuggest() {
    const box = U.$('#profitSuggestBox');
    if (!box) return;
    if (!window.Presupuesto || typeof Presupuesto.matchForOrder !== 'function') {
      box.classList.add('hidden');
      return;
    }
    currentMatches = Presupuesto.matchForOrder({
      modelo: el.fModelo ? el.fModelo.value : '',
      marca: el.fMarca ? el.fMarca.value : '',
      falla: el.fFalla ? el.fFalla.value : ''
    });
    if (!currentMatches.length) {
      box.classList.add('hidden');
      box.innerHTML = '';
      return;
    }
    if (selectedMatchIdx >= currentMatches.length) selectedMatchIdx = 0;
    const m = currentMatches[selectedMatchIdx] || currentMatches[0];
    const currentTotal = U.parseMoney(el.fTotal.value);
    const refTotal = currentTotal > 0 ? currentTotal : m.final;
    const gan = Math.max(0, refTotal - m.costoInterno);

    box.classList.remove('hidden');
    box.innerHTML = `
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0 leading-snug">
          <span class="font-bold text-blue-900">Sugerido PDF:</span>
          <span class="font-semibold text-slate-800">${U.esc(m.name)}</span>
          <div class="text-[11px] text-slate-600 mt-0.5">
            (${U.money(m.cost)} + ${U.money(m.envio)} envío) → <b class="text-emerald-700">Ganancia: ${U.money(gan)}</b>
          </div>
        </div>
        <button type="button" id="btnApplySuggest" class="btn btn-primary btn-sm shrink-0 !h-7 !px-2.5 !text-xs">Aplicar</button>
      </div>
      ${currentMatches.length > 1 ? `
        <select id="selProfitSuggest" class="input !h-7 !text-xs !py-0 !px-2 mt-1">
          ${currentMatches.map((it, idx) => `<option value="${idx}" ${idx === selectedMatchIdx ? 'selected' : ''}>${U.esc(it.name)} — Costo ${U.money(it.cost)} (Final ${U.money(it.final)})</option>`).join('')}
        </select>` : ''}`;
  }

  function updateMode() {
    const box = U.$('#boletaMode');
    const btn = U.$('#btnGuardarLabel');
    if (currentId) {
      const o = Store.get('orders', currentId);
      box.innerHTML = `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 font-semibold"><i data-lucide="pencil" class="w-3.5 h-3.5"></i>Editando orden N° ${U.pad8(o ? o.numero : 0)}</span>`;
      btn.textContent = 'Actualizar orden';
    } else {
      box.innerHTML = `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-semibold"><i data-lucide="file-plus" class="w-3.5 h-3.5"></i>Nueva orden</span>`;
      btn.textContent = 'Guardar orden';
    }
    U.icons();
  }

  /* ------------------------------- Borrador --------------------------------- */
  const saveDraft = U.debounce(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ data: getData(), currentId, numberTouched }));
    } catch (e) { /* almacenamiento lleno */ }
  }, 400);

  function restoreDraft() {
    try {
      const d = JSON.parse(localStorage.getItem(DRAFT_KEY));
      if (d && d.data) {
        currentId = d.currentId && Store.get('orders', d.currentId) ? d.currentId : null;
        numberTouched = !!d.numberTouched;
        setData(d.data);
        if (!currentId && !numberTouched) el.fNumero.value = U.pad8(Store.nextFreeNumber());
        updateMode();
        return true;
      }
    } catch (e) { /* borrador inválido */ }
    return false;
  }

  function newForm() {
    currentId = null;
    numberTouched = false;
    setData({ numero: Store.nextFreeNumber(), fecha: today() });
    updateMode();
    saveDraft();
  }

  /* --------------------------------- Config --------------------------------- */
  function applyConfig() {
    const c = Store.config;
    const img = U.$('#logoImg');
    const def = U.$('#logoDefault');
    const logoBtn = U.$('#logoBtn');
    if (logoBtn) logoBtn.classList.toggle('has-logo', !!c.logo);
    if (c.logo) { img.src = c.logo; img.hidden = false; def.hidden = true; }
    else { img.removeAttribute('src'); img.hidden = true; def.hidden = false; }

    const hImg = U.$('#headerLogoImg');
    const hDef = U.$('#headerLogoDefault');
    if (hImg && hDef) {
      if (c.logo) { hImg.src = c.logo; hImg.hidden = false; hDef.hidden = true; }
      else { hImg.removeAttribute('src'); hImg.hidden = true; hDef.hidden = false; }
    }

    U.$('#bAddress').textContent = c.address || '';
    U.$('#bWhatsapp').textContent = c.whatsapp || '';
    U.$('#bInstagram').textContent = c.instagram || '';
    const qrSrc = (c.qrMode === 'custom' && c.qrImage) ? c.qrImage : QR.dataURL(c.qrTarget || 'https://wa.me/5492255551419');
    U.$('#qrImg').src = qrSrc;
    const fLbl = U.$('#btnGanFormulaLabel');
    if (fLbl) fLbl.textContent = `Fórmula (${U.money(c.ganancia || 30000)})`;
    if (!currentId && !numberTouched) {
      el.fNumero.value = U.pad8(Store.nextFreeNumber());
    }
    updateProfitSuggest();
  }

  /* ------------------------------ Captura PNG ------------------------------- */
  async function renderCanvas() {
    if (typeof html2canvas !== 'function') throw new Error('html2canvas no está disponible (sin conexión al CDN).');
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    const source = document.getElementById('boleta');
    const values = {};
    ids.forEach(id => { values[id] = el[id].value; });
    const patternURL = Pattern.toDataURL(600);

    return html2canvas(source, {
      scale: 2.5,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
      windowWidth: 1280,
      onclone: (doc) => {
        const c = doc.getElementById('boleta');
        c.classList.add('capture');
        c.style.width = '820px';
        c.style.maxWidth = '820px';
        ids.forEach(id => {
          const node = doc.getElementById(id);
          if (!node) return;
          const div = doc.createElement('div');
          div.className = node.className + ' print-val';
          div.textContent = values[id];
          node.replaceWith(div);
        });
        const pc = doc.getElementById('patternCanvas');
        if (pc) {
          const img = doc.createElement('img');
          img.src = patternURL;
          img.className = pc.className;
          pc.replaceWith(img);
        }
        c.querySelectorAll('.no-capture').forEach(n => n.remove());
      }
    });
  }

  function canvasToBlob(canvas) {
    return new Promise((res, rej) => canvas.toBlob(b => b ? res(b) : rej(new Error('No se pudo generar la imagen')), 'image/png'));
  }

  async function getBlob() {
    const canvas = await renderCanvas();
    return canvasToBlob(canvas);
  }

  function fileName() {
    const d = getData();
    return `Orden_${U.pad8(d.numero)}_${U.slug(d.nombre)}.png`;
  }

  async function withBusy(btn, fn) {
    const prev = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Generando…'; }
    try { return await fn(); }
    catch (e) { console.error(e); U.toast(e.message || 'Error inesperado', 'error'); }
    finally { if (btn) { btn.disabled = false; btn.innerHTML = prev; U.icons(); } }
  }

  async function downloadPNG(btn) {
    await withBusy(btn, async () => {
      const blob = await getBlob();
      U.downloadBlob(blob, fileName());
      U.toast('Imagen descargada', 'success');
    });
  }

  async function copyImage(btn) {
    await withBusy(btn, async () => {
      if (!navigator.clipboard || typeof ClipboardItem === 'undefined') {
        const blob = await getBlob();
        U.downloadBlob(blob, fileName());
        U.toast('Tu navegador no permite copiar imágenes; se descargó el PNG.', 'warn');
        return;
      }
      const blobPromise = getBlob();
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blobPromise })]);
        U.toast('Imagen copiada. Pegala con Ctrl+V o mantené presionado en el chat.', 'success');
      } catch (e) {
        const blob = await blobPromise;
        U.downloadBlob(blob, fileName());
        U.toast('No se pudo copiar al portapapeles; se descargó el PNG.', 'warn');
      }
    });
  }

  async function shareImage(btn) {
    await withBusy(btn, async () => {
      const blob = await getBlob();
      const file = new File([blob], fileName(), { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: 'Orden de reparación', text: summaryText() });
        } catch (e) {
          if (e.name !== 'AbortError') throw e;
        }
      } else {
        U.downloadBlob(blob, fileName());
        U.toast('Compartir no está disponible; se descargó el PNG para adjuntarlo.', 'warn');
      }
    });
  }

  /* ------------------------------- WhatsApp --------------------------------- */
  function summaryText() {
    const d = getData();
    const c = Store.config;
    const equipo = [d.marca, d.modelo].filter(Boolean).join(' ');
    const lines = [
      '*BLAS REPARACIONES* 🔧',
      `Orden de reparación *N° ${U.pad8(d.numero)}*`,
      `Fecha: ${U.fechaOrden(d.fecha)}`,
      '',
      `👤 Cliente: ${d.nombre || '-'}`,
      `📱 Equipo: ${equipo || '-'}`,
      `🛠️ Falla: ${d.falla || '-'}`
    ];
    if (d.observaciones) lines.push(`📝 Observaciones: ${d.observaciones}`);
    const pagos = registeredPayments();
    if (d.total || d.sena || pagos) {
      lines.push('');
      lines.push(`💲 Total: ${U.money(d.total)}`);
      lines.push(`✅ Seña: ${U.money(d.sena)}`);
      if (pagos > 0) lines.push(`💵 Pagos: ${U.money(pagos)}`);
      lines.push(`⏳ Saldo: ${U.money(d.total - d.sena - pagos)}`);
    }
    lines.push('');
    lines.push('Garantía de 30 días en mano de obra sobre la falla reparada (no aplica a equipos golpeados o mojados).');
    lines.push('Para retirar el equipo presentá esta orden.');
    lines.push('');
    if (c.address) lines.push(`📍 ${c.address}`);
    if (c.instagram) lines.push(`📷 Instagram: ${c.instagram}`);
    return lines.join('\n');
  }

  function openWhatsAppModal() {
    const d = getData();
    if (!d.tel) {
      U.toast('Cargá el teléfono del cliente (TEL) para enviar por WhatsApp', 'warn');
      el.fTel.focus();
      return;
    }
    U.$('#waNumber').textContent = '+' + U.waPhone(d.tel);
    U.$('#waPreview').textContent = summaryText();
    U.$('#waShareBtn').classList.toggle('hidden', !navigator.share);
    U.openModal('modalWhatsApp');
  }

  /* -------------------------------- Guardar --------------------------------- */
  async function onSave() {
    const d = getData();
    if (!d.nombre) {
      U.toast('Ingresá el NOMBRE del cliente', 'warn');
      el.fNombre.focus();
      return;
    }
    if (!d.numero) {
      U.toast('El número de orden no es válido', 'warn');
      el.fNumero.focus();
      return;
    }
    const dup = Store.list('orders').find(o => o.numero === d.numero && o.id !== currentId);
    if (dup) {
      const next = Store.nextFreeNumber();
      const ok = await U.confirm(
        `El N° ${U.pad8(d.numero)} ya pertenece a la orden de ${dup.nombre}. ¿Querés usar el N° ${U.pad8(next)}?`,
        { title: 'Número repetido', okText: `Usar ${U.pad8(next)}` }
      );
      if (!ok) return;
      el.fNumero.value = U.pad8(next);
      numberTouched = false;
    }
    openSaveModal();
  }

  function openSaveModal() {
    const d = getData();
    U.$('#saveSummary').innerHTML = `
      <div class="font-semibold">N° ${U.pad8(d.numero)} · ${U.esc(d.nombre)}</div>
      <div class="text-gray-500">${U.esc([d.marca, d.modelo].filter(Boolean).join(' ') || 'Sin equipo')} · Total ${U.money(d.total)}</div>`;
    const chk = U.$('#saveDeduct');
    chk.checked = false;
    U.$('#saveStockBox').classList.add('hidden');
    U.$('#saveStockSearch').value = '';
    U.$('#saveStockQty').value = 1;
    fillStockSelect('');
    const hasStock = Store.list('stock').length > 0;
    U.$('#saveDeductWrap').classList.toggle('hidden', !hasStock);
    U.$('#saveNoStock').classList.toggle('hidden', hasStock);
    U.openModal('modalSave');
  }

  function fillStockSelect(q) {
    const sel = U.$('#saveStockSelect');
    const tokens = U.norm(q).split(' ').filter(Boolean);
    const items = Store.list('stock')
      .filter(it => {
        const hay = U.norm(`${it.sku} ${it.categoria} ${it.modelo}`);
        return tokens.every(t => hay.includes(t));
      })
      .sort((a, b) => String(a.modelo).localeCompare(String(b.modelo)));
    sel.innerHTML = items.length
      ? items.map(it => `<option value="${it.id}" ${it.cantidad <= 0 ? 'disabled' : ''}>${U.esc(it.categoria)} · ${U.esc(it.modelo)} ${it.sku ? '(' + U.esc(it.sku) + ')' : ''} — Disp: ${it.cantidad}</option>`).join('')
      : '<option value="">Sin coincidencias</option>';
    const firstEnabled = items.find(it => it.cantidad > 0);
    if (firstEnabled) sel.value = firstEnabled.id;
  }

  function finalizeSave() {
    const d = getData();
    let deductItem = null;
    let deductQty = 1;

    if (U.$('#saveDeduct').checked) {
      const sid = U.$('#saveStockSelect').value;
      deductQty = Math.max(1, parseInt(U.$('#saveStockQty').value, 10) || 1);
      deductItem = sid ? Store.get('stock', sid) : null;
      if (!deductItem) {
        U.toast('Elegí un repuesto válido del stock', 'warn');
        return;
      }
      if (deductItem.cantidad < deductQty) {
        U.toast(`Stock insuficiente: quedan ${deductItem.cantidad} unidades`, 'warn');
        return;
      }
      // Si ya hay un costo cargado (p. ej. desde el presupuestador) se asume que ya incluye el repuesto: no se suma dos veces
      const costoRepuesto = Math.round((Number(deductItem.costo) || 0) * deductQty);
      if (costoRepuesto > 0 && !(Number(d.costoInterno) > 0)) {
        d.costoInterno = (Number(d.costoInterno) || 0) + costoRepuesto;
        d.gananciaInterna = Math.max(0, d.total - d.costoInterno);
      }
    }

    if (d.total > 0 && d.costoInterno === 0 && d.gananciaInterna === 0) {
      d.costoInterno = 0;
      d.gananciaInterna = d.total;
    }

    if (el.fCostoInterno) el.fCostoInterno.value = fmtMoneyField(d.costoInterno);
    if (el.fGananciaInterna) el.fGananciaInterna.value = fmtMoneyField(d.gananciaInterna);

    const existing = currentId ? Store.get('orders', currentId) : null;
    const order = existing
      ? { ...existing, ...d }
      : { id: U.uid(), createdAt: Date.now(), estado: 'Recibido', pagos: [], historial: [{ estado: 'Recibido', ts: Date.now() }], repuestos: [], ...d };

    if (deductItem) {
      deductItem.cantidad = deductItem.cantidad - deductQty;
      Store.upsert('stock', deductItem);
      order.repuestos = [...(order.repuestos || []), {
        stockId: deductItem.id, sku: deductItem.sku || '', desc: `${deductItem.categoria} ${deductItem.modelo}`.trim(),
        qty: deductQty, costo: Number(deductItem.costo) || 0, precio: deductItem.precio || 0, ts: Date.now()
      }];
      if (deductItem.cantidad <= (deductItem.minimo || 0)) {
        U.toast(`⚠️ Stock bajo: ${deductItem.categoria} ${deductItem.modelo} (quedan ${deductItem.cantidad})`, 'warn', 5000);
      }
    }

    Store.upsert('orders', order);
    const wasNew = !existing;
    currentId = order.id;
    numberTouched = false;
    if (wasNew) Store.setConfig({ nextNumber: Math.max(Store.config.nextNumber || 0, order.numero + 1) });
    U.closeModal('modalSave');
    updateMode();
    saveDraft();
    U.toast(wasNew
      ? `Orden N° ${U.pad8(order.numero)} guardada. Próximo N°: ${U.pad8(Store.nextFreeNumber())}`
      : `Orden N° ${U.pad8(order.numero)} actualizada`, 'success', 4000);
  }

  /* -------------------------- API para otros módulos ------------------------ */
  function loadOrder(order) {
    currentId = order.id;
    numberTouched = false;
    setData(order);
    updateMode();
    saveDraft();
    App.goTab('boleta');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function prefill({ modelo = '', marca = '', falla = '', total = 0, costoInterno = 0, gananciaInterna = 0 }) {
    if (currentId) newForm();
    if (modelo) el.fModelo.value = modelo;
    if (marca) el.fMarca.value = marca;
    if (falla) el.fFalla.value = falla;
    if (total) el.fTotal.value = U.money(total);
    if (el.fCostoInterno) el.fCostoInterno.value = fmtMoneyField(costoInterno);
    if (el.fGananciaInterna) el.fGananciaInterna.value = fmtMoneyField(gananciaInterna);
    recalc();
    updateProfitSuggest();
    saveDraft();
    App.goTab('boleta');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => el.fNombre.focus(), 350);
  }

  async function uploadLogo(file) {
    if (!file) return;
    try {
      const url = await U.readFileAsDataURL(file);
      const small = await U.resizeImage(url, 360, 'image/png');
      Store.setConfig({ logo: small });
      U.toast('Logo actualizado', 'success');
    } catch (e) {
      U.toast('No se pudo cargar el logo: ' + e.message, 'error');
    }
  }

  /* --------------------------------- Init ----------------------------------- */
  function init() {
    ids.forEach(id => { el[id] = document.getElementById(id); });
    el.fCostoInterno = document.getElementById('fCostoInterno');
    el.fGananciaInterna = document.getElementById('fGananciaInterna');
    el.fSenaMetodo = document.getElementById('fSenaMetodo');
    if (el.fSenaMetodo) el.fSenaMetodo.addEventListener('change', () => saveDraft());

    Pattern.init(document.getElementById('patternCanvas'), saveDraft);
    U.$('#btnClearPattern').addEventListener('click', e => { e.preventDefault(); Pattern.clear(); });

    const debouncedSuggest = U.debounce(updateProfitSuggest, 180);
    U.$('#boleta').addEventListener('input', e => {
      if (e.target === el.fSena || e.target === el.fTotal) recalc(e.target === el.fTotal);
      if (e.target === el.fModelo || e.target === el.fMarca || e.target === el.fFalla || e.target === el.fTotal) {
        selectedMatchIdx = 0;
        debouncedSuggest();
      }
      saveDraft();
    });

    el.fNumero.addEventListener('input', () => {
      el.fNumero.value = el.fNumero.value.replace(/\D/g, '').slice(0, 8);
      numberTouched = true;
    });
    el.fNumero.addEventListener('blur', () => {
      el.fNumero.value = U.pad8(el.fNumero.value || Store.nextFreeNumber());
    });

    [el.fDia, el.fMes, el.fAnio].forEach((box, i, arr) => {
      box.addEventListener('input', () => {
        box.value = box.value.replace(/\D/g, '').slice(0, 2);
        if (box.value.length === 2 && arr[i + 1]) arr[i + 1].focus();
      });
      box.addEventListener('blur', () => {
        if (box.value.length === 1) box.value = '0' + box.value;
      });
    });

    [el.fSena, el.fTotal, el.fCostoInterno, el.fGananciaInterna].filter(Boolean).forEach(inp => {
      inp.addEventListener('focus', () => {
        const v = U.parseMoney(inp.value);
        inp.value = v ? String(v) : '';
        requestAnimationFrame(() => inp.select());
      });
      inp.addEventListener('blur', () => {
        const v = U.parseMoney(inp.value);
        inp.value = v ? U.money(v) : '';
        if (inp === el.fSena || inp === el.fTotal) recalc(inp === el.fTotal);
        saveDraft();
      });
    });

    if (el.fCostoInterno) {
      el.fCostoInterno.addEventListener('input', () => {
        const total = U.parseMoney(el.fTotal.value);
        const costo = U.parseMoney(el.fCostoInterno.value);
        if (total > 0) el.fGananciaInterna.value = U.money(Math.max(0, total - costo));
        saveDraft();
      });
    }
    if (el.fGananciaInterna) {
      el.fGananciaInterna.addEventListener('input', () => saveDraft());
    }

    U.$('#btnGanFormula').addEventListener('click', () => {
      const baseGan = Math.round(Number(Store.config.ganancia) || 30000);
      let total = Math.round(U.parseMoney(el.fTotal.value));
      let costo = Math.round(U.parseMoney(el.fCostoInterno.value));
      if (costo > 0 && total > 0) {
        el.fGananciaInterna.value = U.money(Math.max(0, total - costo));
      } else if (costo > 0 && total === 0) {
        const sum = costo + baseGan;
        total = sum > 0 ? Math.ceil(sum / 1000) * 1000 : 0;
        if (Store.config.redondeoPsicologico && total >= 10000 && total % 10000 === 0) total -= 1000;
        el.fTotal.value = U.money(total);
        recalc();
        el.fGananciaInterna.value = U.money(Math.max(0, total - costo));
      } else if (costo === 0 && total > 0) {
        const gan = Math.min(total, baseGan);
        el.fGananciaInterna.value = U.money(gan);
        el.fCostoInterno.value = total > gan ? U.money(total - gan) : '';
      } else {
        el.fGananciaInterna.value = U.money(baseGan);
      }
      saveDraft();
    });

    U.$('#btnGanManoObra').addEventListener('click', () => {
      const total = U.parseMoney(el.fTotal.value);
      const baseGan = Number(Store.config.ganancia) || 30000;
      el.fCostoInterno.value = '';
      el.fGananciaInterna.value = U.money(total > 0 ? total : baseGan);
      saveDraft();
    });

    const suggestBox = U.$('#profitSuggestBox');
    if (suggestBox) {
      suggestBox.addEventListener('change', e => {
        if (e.target.id === 'selProfitSuggest') {
          selectedMatchIdx = parseInt(e.target.value, 10) || 0;
          updateProfitSuggest();
        }
      });
      suggestBox.addEventListener('click', e => {
        if (e.target.closest('#btnApplySuggest')) {
          const m = currentMatches[selectedMatchIdx] || currentMatches[0];
          if (!m) return;
          el.fCostoInterno.value = U.money(m.costoInterno);
          if (!U.parseMoney(el.fTotal.value)) {
            el.fTotal.value = U.money(m.final);
            recalc();
          }
          const tot = U.parseMoney(el.fTotal.value) || m.final;
          el.fGananciaInterna.value = U.money(Math.max(0, tot - m.costoInterno));
          saveDraft();
          U.toast(`Aplicado: ${m.name} · Ganancia ${U.money(Math.max(0, tot - m.costoInterno))}`, 'success');
        }
      });
    }

    const logoInput = U.$('#logoFile');
    U.$('#logoBtn').addEventListener('click', () => logoInput.click());
    logoInput.addEventListener('change', () => { uploadLogo(logoInput.files[0]); logoInput.value = ''; });
    U.$('#qrBtn').addEventListener('click', () => App.openSettings());

    U.$('#btnGuardar').addEventListener('click', onSave);
    U.$('#btnNuevaOrden').addEventListener('click', async () => {
      const d = getData();
      const dirty = !currentId && (d.nombre || d.modelo || d.falla || d.tel);
      if (dirty && !(await U.confirm('Hay datos sin guardar en la boleta. ¿Empezar una orden nueva igualmente?', { okText: 'Nueva orden' }))) return;
      newForm();
      el.fNombre.focus();
    });
    U.$('#btnPNG').addEventListener('click', e => downloadPNG(e.currentTarget));
    U.$('#btnCopyImg').addEventListener('click', e => copyImage(e.currentTarget));
    U.$('#btnWhatsApp').addEventListener('click', e => {
      const isTouch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
      let canShareFiles = false;
      if (isTouch && typeof navigator.share === 'function' && typeof navigator.canShare === 'function') {
        try {
          canShareFiles = navigator.canShare({ files: [new File([''], 'orden.png', { type: 'image/png' })] });
        } catch (_) {
          canShareFiles = false;
        }
      }
      if (canShareFiles) shareImage(e.currentTarget);
      else openWhatsAppModal();
    });
    U.$('#btnPrint').addEventListener('click', () => window.print());

    U.$('#waOpenChat').addEventListener('click', () => U.openWA(getData().tel, summaryText()));
    U.$('#waCopyImg').addEventListener('click', e => copyImage(e.currentTarget));
    U.$('#waShareBtn').addEventListener('click', e => shareImage(e.currentTarget));
    U.$('#waDownload').addEventListener('click', e => downloadPNG(e.currentTarget));
    U.$('#waCopyText').addEventListener('click', async () => {
      if (await U.copy(summaryText())) U.toast('Resumen copiado', 'success');
    });

    U.$('#saveDeduct').addEventListener('change', e => U.$('#saveStockBox').classList.toggle('hidden', !e.target.checked));
    U.$('#saveStockSearch').addEventListener('input', e => fillStockSelect(e.target.value));
    U.$('#saveConfirm').addEventListener('click', finalizeSave);

    Store.on('config', applyConfig);
    Store.on('priceLists', updateProfitSuggest);
    Store.on('orders', () => {
      if (currentId && !Store.get('orders', currentId)) { currentId = null; updateMode(); }
      else if (currentId) recalc(false);
    });

    if (!restoreDraft()) newForm();
    applyConfig();
  }

  return { init, loadOrder, prefill, uploadLogo, newForm, get currentId() { return currentId; } };
})();
