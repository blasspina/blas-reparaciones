/* =========================================================================
   BLAS REPARACIONES · Stock de Productos y Repuestos
   ========================================================================= */
'use strict';

const Stock = (() => {
  const CATEGORIAS = ['Pantallas / Módulos', 'Baterías', 'Pines de carga', 'Templados', 'Fundas', 'Cables', 'Cargadores', 'Auriculares', 'Flex', 'Cámaras', 'Tapas', 'Insumos', 'Otros'];
  let editId = null;
  let onlyLow = false;

  function isLow(it) { return (Number(it.cantidad) || 0) <= (Number(it.minimo) || 0); }

  function categories() {
    const set = new Set(CATEGORIAS);
    Store.list('stock').forEach(it => it.categoria && set.add(it.categoria));
    return Array.from(set);
  }

  function filtered() {
    const tokens = U.norm(U.$('#sSearch').value).split(' ').filter(Boolean);
    const cat = U.$('#sCat').value;
    return Store.list('stock')
      .filter(it => !cat || it.categoria === cat)
      .filter(it => !onlyLow || isLow(it))
      .filter(it => {
        if (!tokens.length) return true;
        const hay = U.norm(`${it.sku} ${it.categoria} ${it.modelo}`);
        return tokens.every(t => hay.includes(t));
      })
      .sort((a, b) => (isLow(b) - isLow(a)) || String(a.categoria).localeCompare(String(b.categoria)) || String(a.modelo).localeCompare(String(b.modelo)));
  }

  function renderCats() {
    const sel = U.$('#sCat');
    const cur = sel.value;
    sel.innerHTML = '<option value="">Todas las categorías</option>' + categories().map(c => `<option ${c === cur ? 'selected' : ''}>${U.esc(c)}</option>`).join('');
    U.$('#stCatList').innerHTML = categories().map(c => `<option value="${U.esc(c)}"></option>`).join('');
  }

  function qtyControl(it) {
    return `<div class="inline-flex items-center rounded-xl border ${isLow(it) ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'} overflow-hidden">
      <button class="qty-btn" data-qty="-1" data-id="${it.id}" aria-label="Restar uno"><i data-lucide="minus" class="w-4 h-4"></i></button>
      <span class="min-w-[2.5rem] text-center font-bold ${isLow(it) ? 'text-red-600' : 'text-gray-900'}">${it.cantidad}</span>
      <button class="qty-btn" data-qty="1" data-id="${it.id}" aria-label="Sumar uno"><i data-lucide="plus" class="w-4 h-4"></i></button>
    </div>`;
  }

  function render() {
    renderCats();
    const all = Store.list('stock');
    const rows = filtered();
    const low = all.filter(isLow).length;
    const units = all.reduce((s, it) => s + (Number(it.cantidad) || 0), 0);
    const valor = all.reduce((s, it) => s + (Number(it.cantidad) || 0) * (Number(it.costo) || 0), 0);
    const venta = all.reduce((s, it) => s + (Number(it.cantidad) || 0) * (Number(it.precio) || 0), 0);
    U.$('#sStats').innerHTML = [
      ['Productos', all.length, 'package', 'text-gray-900'],
      ['Unidades', units, 'layers', 'text-gray-900'],
      ['Stock bajo', low, 'triangle-alert', low ? 'text-red-600' : 'text-gray-900'],
      ['Valor (costo / venta)', `${U.money(valor)}<span class="text-gray-400 font-medium text-sm"> / ${U.money(venta)}</span>`, 'banknote', 'text-gray-900']
    ].map(([l, v, ic, cls]) => `
      <div class="bg-white rounded-2xl border border-gray-200 p-3 sm:p-4">
        <div class="flex items-center gap-2 text-xs text-gray-500"><i data-lucide="${ic}" class="w-4 h-4"></i>${l}</div>
        <div class="mt-1 text-lg sm:text-2xl font-extrabold ${cls} break-words">${v}</div>
      </div>`).join('');

    const lowBtn = U.$('#sLow');
    lowBtn.classList.toggle('chip-active', onlyLow);
    lowBtn.querySelector('.chip-n').textContent = low;

    const empty = `<div class="text-center py-12 text-gray-500">
      <i data-lucide="package-open" class="w-12 h-12 mx-auto mb-3 text-gray-300"></i>
      <p class="font-semibold text-gray-700">${all.length ? 'Sin resultados' : 'Inventario vacío'}</p>
      <p class="text-sm">${all.length ? 'Cambiá los filtros de búsqueda.' : 'Agregá tus repuestos, templados, baterías e insumos.'}</p></div>`;

    U.$('#sTableBody').innerHTML = rows.map(it => `
      <tr class="border-t border-gray-100 ${isLow(it) ? 'bg-red-50/60' : 'hover:bg-gray-50/70'}">
        <td class="px-3 py-2.5 font-mono text-xs text-gray-600">${U.esc(it.sku || '-')}</td>
        <td class="px-3 py-2.5 text-gray-600">${U.esc(it.categoria)}</td>
        <td class="px-3 py-2.5 font-semibold text-gray-900">${U.esc(it.modelo)}
          ${isLow(it) ? '<span class="ml-1 inline-flex items-center gap-1 text-[11px] font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded"><i data-lucide="triangle-alert" class="w-3 h-3"></i>BAJO</span>' : ''}</td>
        <td class="px-3 py-2.5">${qtyControl(it)}</td>
        <td class="px-3 py-2.5 text-gray-500 text-center">${it.minimo}</td>
        <td class="px-3 py-2.5 text-right text-gray-600">${U.money(it.costo)}</td>
        <td class="px-3 py-2.5 text-right font-semibold">${U.money(it.precio)}</td>
        <td class="px-3 py-2.5"><div class="flex justify-end gap-1">
          <button class="icon-btn" data-edit="${it.id}" title="Editar"><i data-lucide="pencil" class="w-4 h-4"></i></button>
          <button class="icon-btn text-red-600 hover:bg-red-50" data-del="${it.id}" title="Eliminar"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
        </div></td>
      </tr>`).join('');
    U.$('#sTableWrap').classList.toggle('hidden', !rows.length);
    U.$('#sEmptyDesk').innerHTML = rows.length ? '' : empty;

    U.$('#sCards').innerHTML = rows.length ? rows.map(it => `
      <article class="rounded-2xl border p-3.5 shadow-sm ${isLow(it) ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <div class="text-[11px] uppercase tracking-wide text-gray-500">${U.esc(it.categoria)}${it.sku ? ' · ' + U.esc(it.sku) : ''}</div>
            <div class="font-bold text-gray-900 leading-snug">${U.esc(it.modelo)}</div>
            <div class="text-xs text-gray-500 mt-0.5">Costo ${U.money(it.costo)} · Venta <b class="text-gray-800">${U.money(it.precio)}</b></div>
          </div>
          <div class="flex gap-1 shrink-0">
            <button class="icon-btn" data-edit="${it.id}" title="Editar"><i data-lucide="pencil" class="w-4 h-4"></i></button>
            <button class="icon-btn text-red-600" data-del="${it.id}" title="Eliminar"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
          </div>
        </div>
        <div class="mt-3 flex items-center justify-between">
          ${qtyControl(it)}
          <span class="text-xs ${isLow(it) ? 'text-red-600 font-bold' : 'text-gray-500'}">${isLow(it) ? '⚠ Stock bajo · ' : ''}Mín. ${it.minimo}</span>
        </div>
      </article>`).join('') : empty;
    U.icons();
  }

  function openForm(it = null) {
    editId = it ? it.id : null;
    U.$('#stTitle').textContent = it ? 'Editar producto' : 'Nuevo producto';
    U.$('#stSku').value = it ? it.sku || '' : '';
    U.$('#stCat').value = it ? it.categoria || '' : '';
    U.$('#stModelo').value = it ? it.modelo || '' : '';
    U.$('#stCant').value = it ? it.cantidad : 1;
    U.$('#stMin').value = it ? it.minimo : 1;
    U.$('#stCosto').value = it && it.costo ? it.costo : '';
    U.$('#stPrecio').value = it && it.precio ? it.precio : '';
    updateSuggest();
    U.openModal('modalStock');
    setTimeout(() => U.$(it ? '#stCant' : '#stCat').focus(), 50);
  }

  function updateSuggest() {
    const costo = U.parseMoney(U.$('#stCosto').value);
    const box = U.$('#stSuggest');
    if (!costo) { box.textContent = ''; return; }
    box.innerHTML = `Sugerido con fórmula del presupuestador: <button type="button" class="underline font-semibold" id="stUseSuggest">${U.money(Presupuesto.calc(costo).final)}</button>`;
  }

  function saveForm() {
    const cat = U.$('#stCat').value.trim();
    const modelo = U.$('#stModelo').value.trim();
    if (!cat || !modelo) { U.toast('Completá categoría y modelo compatible', 'warn'); return; }
    const sku = U.$('#stSku').value.trim();
    if (sku) {
      const dup = Store.list('stock').find(x => x.id !== editId && String(x.sku).toLowerCase() === sku.toLowerCase());
      if (dup) { U.toast(`El código ${sku} ya existe (${dup.modelo})`, 'warn'); return; }
    }
    const base = editId ? Store.get('stock', editId) : { id: U.uid(), createdAt: Date.now() };
    const item = {
      ...base,
      sku,
      categoria: cat,
      modelo,
      cantidad: Math.max(0, parseInt(U.$('#stCant').value, 10) || 0),
      minimo: Math.max(0, parseInt(U.$('#stMin').value, 10) || 0),
      costo: Math.max(0, U.parseMoney(U.$('#stCosto').value)),
      precio: Math.max(0, U.parseMoney(U.$('#stPrecio').value))
    };
    Store.upsert('stock', item);
    U.closeModal('modalStock');
    U.toast(editId ? 'Producto actualizado' : 'Producto agregado', 'success');
  }

  function adjust(id, delta) {
    const it = Store.get('stock', id);
    if (!it) return;
    const next = Math.max(0, (Number(it.cantidad) || 0) + delta);
    if (next === it.cantidad) return;
    it.cantidad = next;
    Store.upsert('stock', it);
    if (navigator.vibrate) { try { navigator.vibrate(10); } catch (e) { /* sin vibración */ } }
  }

  function exportXLSX() {
    if (typeof XLSX === 'undefined') { U.toast('SheetJS no disponible', 'error'); return; }
    const rows = filtered().map(it => ({
      'Código/SKU': it.sku, Categoría: it.categoria, 'Marca/Modelo compatible': it.modelo,
      Cantidad: it.cantidad, 'Stock mínimo': it.minimo, Costo: it.costo, 'Precio venta': it.precio
    }));
    if (!rows.length) { U.toast('No hay productos para exportar', 'warn'); return; }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Stock');
    XLSX.writeFile(wb, `Stock_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  function init() {
    U.$('#sAdd').addEventListener('click', () => openForm());
    U.$('#sSearch').addEventListener('input', U.debounce(render, 150));
    U.$('#sCat').addEventListener('change', render);
    U.$('#sLow').addEventListener('click', () => { onlyLow = !onlyLow; render(); });
    U.$('#sExport').addEventListener('click', exportXLSX);
    U.$('#stSave').addEventListener('click', saveForm);
    U.$('#stCosto').addEventListener('input', updateSuggest);
    U.$('#stSuggest').addEventListener('click', e => {
      if (e.target.id === 'stUseSuggest') U.$('#stPrecio').value = Presupuesto.calc(U.parseMoney(U.$('#stCosto').value)).final;
    });
    U.$('#modalStock').addEventListener('keydown', e => {
      if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); saveForm(); }
    });

    U.$('#tab-stock').addEventListener('click', async e => {
      const q = e.target.closest('[data-qty]');
      const ed = e.target.closest('[data-edit]');
      const del = e.target.closest('[data-del]');
      if (q) adjust(q.dataset.id, parseInt(q.dataset.qty, 10));
      else if (ed) openForm(Store.get('stock', ed.dataset.edit));
      else if (del) {
        const it = Store.get('stock', del.dataset.del);
        if (it && await U.confirm(`¿Eliminar "${it.modelo}" del stock?`, { okText: 'Eliminar', danger: true })) {
          Store.remove('stock', it.id);
          U.toast('Producto eliminado');
        }
      }
    });

    Store.on('stock', render);
    render();
  }

  return { init };
})();
