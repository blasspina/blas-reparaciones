/* =========================================================================
   BLAS REPARACIONES · Registro de Reparaciones y Resumen de Ganancias
   ========================================================================= */
'use strict';

const Registro = (() => {
  const ESTADOS = [
    { k: 'Recibido', cls: 'st-recibido', icon: 'inbox' },
    { k: 'En reparación', cls: 'st-reparacion', icon: 'wrench' },
    { k: 'Esperando repuesto', cls: 'st-esperando', icon: 'clock' },
    { k: 'Listo para retirar', cls: 'st-listo', icon: 'circle-check' },
    { k: 'Entregado', cls: 'st-entregado', icon: 'package-check' },
    { k: 'Sin solución', cls: 'st-sinsolucion', icon: 'circle-x' }
  ];
  const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  function currentMonthKey() {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const a = String(d.getFullYear()).slice(-2);
    return `${a}-${m}`;
  }

  let filterEstado = '';
  let filterMonth = currentMonthKey();
  let pagoTarget = null;
  let gananciaTarget = null;

  function pagado(o) { return (o.pagos || []).reduce((s, p) => s + (Number(p.monto) || 0), 0); }
  function saldo(o) { return (Number(o.total) || 0) - (Number(o.sena) || 0) - pagado(o); }
  function costo(o) { return Math.max(0, Math.round(Number(o.costoInterno) || 0)); }
  function ganancia(o) {
    if (o.gananciaInterna !== undefined && o.gananciaInterna !== null && Number(o.gananciaInterna) > 0) {
      return Math.round(Number(o.gananciaInterna));
    }
    if (Number(o.costoInterno) > 0 && Number(o.total) > 0) {
      return Math.max(0, Math.round(Number(o.total) - Number(o.costoInterno)));
    }
    return Math.max(0, Math.round(Number(o.gananciaInterna) || 0));
  }
  function estadoInfo(k) { return ESTADOS.find(e => e.k === k) || ESTADOS[0]; }

  function orderMonthKey(o) {
    if (o && o.fecha && o.fecha.m && o.fecha.a) {
      const m = parseInt(o.fecha.m, 10);
      const a = String(o.fecha.a).trim().slice(-2).padStart(2, '0');
      if (m >= 1 && m <= 12 && /^\d{2}$/.test(a)) {
        return `${a}-${String(m).padStart(2, '0')}`;
      }
    }
    const d = new Date((o && o.createdAt) || Date.now());
    return `${String(d.getFullYear()).slice(-2)}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  function formatMonthOption(key) {
    const [a, mStr] = String(key).split('-');
    const m = parseInt(mStr, 10);
    const name = MESES[m - 1] || mStr;
    return `${name} 20${a} (${mStr}/${a})`;
  }

  function periodOrders() {
    const all = Store.list('orders');
    if (filterMonth === 'all') return all;
    return all.filter(o => orderMonthKey(o) === filterMonth);
  }

  function filtered() {
    const tokens = U.norm(U.$('#rSearch').value).split(' ').filter(Boolean);
    return periodOrders()
      .filter(o => !filterEstado || o.estado === filterEstado)
      .filter(o => {
        if (!tokens.length) return true;
        const hay = U.norm(`${U.pad8(o.numero)} ${o.numero} ${o.nombre} ${o.tel} ${String(o.tel || '').replace(/\D/g, '')} ${o.modelo} ${o.marca}`);
        return tokens.every(t => hay.includes(t));
      })
      .sort((a, b) => (b.numero || 0) - (a.numero || 0) || (b.createdAt || 0) - (a.createdAt || 0));
  }

  function estadoSelect(o) {
    const info = estadoInfo(o.estado);
    return `<div class="estado-wrap ${info.cls}">
      <select class="estado-select" data-estado="${o.id}" aria-label="Cambiar estado">
        ${ESTADOS.map(e => `<option value="${e.k}" ${e.k === o.estado ? 'selected' : ''}>${e.k}</option>`).join('')}
      </select>
    </div>`;
  }

  function saldoBadge(o) {
    const s = saldo(o);
    if (!o.total) return '<span class="text-xs text-gray-400">Sin total</span>';
    if (s <= 0) return '<span class="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full"><i data-lucide="check" class="w-3 h-3"></i>Pagado</span>';
    return `<span class="text-xs font-semibold text-red-600">Saldo ${U.money(s)}</span>`;
  }

  function gananciaBadge(o) {
    const g = ganancia(o);
    return `<button type="button" class="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-lg border transition cursor-pointer ${g > 0 ? 'bg-emerald-50/90 text-emerald-700 border-emerald-200 hover:bg-emerald-100' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'}" data-act="ganancia" data-id="${o.id}" title="Clic para editar costo y ganancia interna">
      <i data-lucide="trending-up" class="w-3 h-3"></i>
      <span>Ganancia: ${U.money(g)}</span>
    </button>`;
  }

  function actions(o, compact = false) {
    const lbl = (t) => compact ? '' : `<span class="hidden xl:inline">${t}</span>`;
    return `
      <button class="icon-btn" data-act="pago" data-id="${o.id}" title="Registrar pago"><i data-lucide="wallet" class="w-4 h-4"></i>${lbl('Pago')}</button>
      <button class="icon-btn" data-act="ver" data-id="${o.id}" title="Ver / Reimprimir boleta"><i data-lucide="eye" class="w-4 h-4"></i>${lbl('Ver')}</button>
      <button class="icon-btn text-emerald-700 hover:bg-emerald-50" data-act="wa" data-id="${o.id}" title="Avisar por WhatsApp que está listo"><i data-lucide="message-circle" class="w-4 h-4"></i>${lbl('Avisar')}</button>
      <button class="icon-btn" data-act="tsv" data-id="${o.id}" title="Copiar fila TSV"><i data-lucide="clipboard-copy" class="w-4 h-4"></i>${lbl('TSV')}</button>
      <button class="icon-btn text-red-600 hover:bg-red-50" data-act="del" data-id="${o.id}" title="Eliminar orden"><i data-lucide="trash-2" class="w-4 h-4"></i></button>`;
  }

  function renderMonthSelector(all) {
    const sel = U.$('#rMonthFilter');
    if (!sel) return;
    const curKey = currentMonthKey();
    const keys = new Set([curKey]);
    all.forEach(o => keys.add(orderMonthKey(o)));
    const sorted = Array.from(keys).sort((a, b) => b.localeCompare(a));
    if (filterMonth !== 'all' && !keys.has(filterMonth)) filterMonth = curKey;

    sel.innerHTML = [
      ...sorted.map(k => `<option value="${k}" ${filterMonth === k ? 'selected' : ''}>${k === curKey ? 'Mes actual · ' : ''}${formatMonthOption(k)}</option>`),
      `<option value="all" ${filterMonth === 'all' ? 'selected' : ''}>Todos los meses (${all.length})</option>`
    ].join('');
  }

  function renderFinanceCards(inPeriod) {
    const box = U.$('#rFinanceCards');
    if (!box) return;
    const valid = inPeriod.filter(o => o.estado !== 'Sin solución');
    const presupuestado = valid.reduce((s, o) => s + (Number(o.total) || 0), 0);
    const gananciaTotal = valid.reduce((s, o) => s + ganancia(o), 0);
    const costoTotal = valid.reduce((s, o) => s + costo(o), 0);
    const saldoTotal = valid.reduce((s, o) => s + Math.max(0, saldo(o)), 0);
    const conSaldo = valid.filter(o => saldo(o) > 0).length;

    let cobradoEfectivo = 0;
    let cobradoDigital = 0;
    valid.forEach(o => {
      const senaMonto = Math.max(0, Number(o.sena) || 0);
      if (senaMonto > 0) {
        const met = o.senaMetodo || 'Efectivo';
        if (met === 'Efectivo') cobradoEfectivo += senaMonto;
        else cobradoDigital += senaMonto;
      }
      (o.pagos || []).forEach(p => {
        const monto = Math.max(0, Number(p.monto) || 0);
        if (monto > 0) {
          const met = p.metodo || 'Efectivo';
          if (met === 'Efectivo') cobradoEfectivo += monto;
          else cobradoDigital += monto;
        }
      });
    });
    const cobradoReal = cobradoEfectivo + cobradoDigital;

    box.innerHTML = `
      <div class="card p-3 sm:p-4">
        <div class="flex items-center justify-between text-xs font-semibold text-slate-500">
          <span>Cobrado real del período</span>
          <i data-lucide="wallet" class="w-4 h-4 text-blue-600"></i>
        </div>
        <div class="mt-1 text-lg sm:text-2xl font-extrabold text-slate-900">${U.money(cobradoReal)}</div>
        <div class="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-600">
          <span>💵 Efectivo: <b class="text-slate-800">${U.money(cobradoEfectivo)}</b></span>
          <span>💳 Transf. / Digital: <b class="text-slate-800">${U.money(cobradoDigital)}</b></span>
        </div>
      </div>
      <div class="card p-3 sm:p-4">
        <div class="flex items-center justify-between text-xs font-semibold text-slate-500">
          <span>Total presupuestado</span>
          <i data-lucide="receipt" class="w-4 h-4 text-slate-400"></i>
        </div>
        <div class="mt-1 text-lg sm:text-2xl font-extrabold text-slate-900">${U.money(presupuestado)}</div>
        <div class="mt-0.5 text-xs text-slate-500">${valid.length} orden(es) activas en el período</div>
      </div>
      <div class="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/90 to-teal-50/60 p-3 sm:p-4 shadow-sm">
        <div class="flex items-center justify-between text-xs font-bold text-emerald-800">
          <span>Ganancia Neta del período</span>
          <i data-lucide="trending-up" class="w-4 h-4 text-emerald-600"></i>
        </div>
        <div class="mt-1 text-lg sm:text-2xl font-extrabold text-emerald-700">${U.money(gananciaTotal)}</div>
        <div class="mt-0.5 text-xs text-emerald-700/80">Costos + envíos: ${U.money(costoTotal)}</div>
      </div>
      <div class="card p-3 sm:p-4">
        <div class="flex items-center justify-between text-xs font-semibold text-slate-500">
          <span>Pendiente de cobro (Saldos)</span>
          <i data-lucide="clock" class="w-4 h-4 text-amber-500"></i>
        </div>
        <div class="mt-1 text-lg sm:text-2xl font-extrabold ${saldoTotal > 0 ? 'text-red-600' : 'text-slate-900'}">${U.money(saldoTotal)}</div>
        <div class="mt-0.5 text-xs text-slate-500">${conSaldo ? `${conSaldo} orden(es) con saldo pendiente` : 'Todo al día'}</div>
      </div>`;
  }

  function render() {
    const all = Store.list('orders');
    renderMonthSelector(all);
    const inPeriod = periodOrders();
    const rows = filtered();

    renderFinanceCards(inPeriod);

    U.$('#rChips').innerHTML = [{ k: '', label: 'Todos', n: inPeriod.length }]
      .concat(ESTADOS.map(e => ({ k: e.k, label: e.k, n: inPeriod.filter(o => o.estado === e.k).length, cls: e.cls })))
      .map(c => `<button class="chip ${filterEstado === c.k ? 'chip-active' : ''}" data-chip="${U.esc(c.k)}">
          ${c.cls ? `<span class="dot ${c.cls}"></span>` : ''}${U.esc(c.label)} <span class="chip-n">${c.n}</span></button>`).join('');

    const pendiente = inPeriod.filter(o => o.estado !== 'Entregado' && o.estado !== 'Sin solución').length;
    const saldoTotal = inPeriod.filter(o => o.estado !== 'Sin solución').reduce((s, o) => s + Math.max(0, saldo(o)), 0);
    U.$('#rStats').innerHTML = `
      <span><b>${inPeriod.length}</b> órdenes en el período</span><span class="text-gray-300">·</span>
      <span><b>${pendiente}</b> en taller</span><span class="text-gray-300">·</span>
      <span>Saldos a cobrar <b>${U.money(saldoTotal)}</b></span>`;

    const empty = `<div class="text-center py-12 text-gray-500">
        <i data-lucide="clipboard-list" class="w-12 h-12 mx-auto mb-3 text-gray-300"></i>
        <p class="font-semibold text-gray-700">${all.length ? 'Sin órdenes en este período o filtro' : 'Todavía no hay órdenes guardadas'}</p>
        <p class="text-sm">${all.length ? 'Probá cambiando el mes arriba o el filtro de estado.' : 'Creá tu primera orden desde la pestaña Boleta.'}</p></div>`;

    U.$('#rTableBody').innerHTML = rows.map(o => `
      <tr class="border-t border-gray-100 hover:bg-gray-50/70 align-top">
        <td class="px-3 py-3 font-mono font-semibold text-gray-800 whitespace-nowrap">${U.pad8(o.numero)}</td>
        <td class="px-3 py-3 whitespace-nowrap text-gray-600">${U.esc(U.fechaOrden(o.fecha))}</td>
        <td class="px-3 py-3 min-w-[150px]"><div class="font-semibold text-gray-900">${U.esc(o.nombre)}</div><div class="text-xs text-gray-500">${U.esc(o.tel)}</div></td>
        <td class="px-3 py-3 min-w-[180px]"><div class="font-medium">${U.esc([o.marca, o.modelo].filter(Boolean).join(' ') || '-')}</div><div class="text-xs text-gray-500 line-clamp-2">${U.esc(o.falla)}</div></td>
        <td class="px-3 py-3 whitespace-nowrap">
          <div class="font-semibold">${U.money(o.total)}</div>
          <div>${saldoBadge(o)}</div>
          <div>${gananciaBadge(o)}</div>
        </td>
        <td class="px-3 py-3">${estadoSelect(o)}</td>
        <td class="px-3 py-3"><div class="flex items-center gap-1 justify-end">${actions(o)}</div></td>
      </tr>`).join('');
    U.$('#rTableWrap').classList.toggle('hidden', !rows.length);

    U.$('#rCards').innerHTML = rows.length ? rows.map(o => `
      <article class="bg-white rounded-2xl border border-gray-200 p-3.5 shadow-sm">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <div class="text-xs font-mono text-gray-500">N° ${U.pad8(o.numero)} · ${U.esc(U.fechaOrden(o.fecha))}</div>
            <div class="font-bold text-gray-900 truncate">${U.esc(o.nombre)}</div>
            <div class="text-sm text-gray-600 truncate">${U.esc([o.marca, o.modelo].filter(Boolean).join(' ') || '-')}${o.tel ? ' · ' + U.esc(o.tel) : ''}</div>
          </div>
          <div class="text-right shrink-0">
            <div class="font-bold">${U.money(o.total)}</div>
            <div>${saldoBadge(o)}</div>
            <div>${gananciaBadge(o)}</div>
          </div>
        </div>
        ${o.falla ? `<p class="text-sm text-gray-600 mt-2 line-clamp-2">${U.esc(o.falla)}</p>` : ''}
        <div class="mt-3">${estadoSelect(o)}</div>
        <div class="mt-2 grid grid-cols-5 gap-1 border-t border-gray-100 pt-2">${actions(o, true)}</div>
      </article>`).join('') : empty;
    U.$('#rEmptyDesk').innerHTML = rows.length ? '' : empty;
    U.icons();
  }

  function setEstado(o, estado) {
    if (o.estado === estado) return;
    o.estado = estado;
    o.historial = [...(o.historial || []), { estado, ts: Date.now() }];
    if (estado === 'Entregado') o.entregadoAt = Date.now();
    Store.upsert('orders', o);
  }

  function tsv(o) {
    const clean = v => String(v ?? '').replace(/[\t\r\n]+/g, ' ').trim();
    return [
      U.pad8(o.numero), U.fechaOrden(o.fecha), o.nombre, o.tel, o.marca, o.modelo, o.falla, o.observaciones,
      o.contrasena, Pattern.toText(o.patron), o.total || 0, o.sena || 0, pagado(o), saldo(o), o.estado
    ].map(clean).join('\t');
  }

  function waListo(o) {
    const c = Store.config;
    const equipo = [o.marca, o.modelo].filter(Boolean).join(' ') || 'equipo';
    const s = saldo(o);
    const lines = [
      `¡Hola ${o.nombre}! 👋`,
      `Te escribimos de *BLAS REPARACIONES* 🔧`,
      '',
      `Tu *${equipo}* (Orden N° ${U.pad8(o.numero)}) ya está *listo para retirar* ✅`,
      s > 0 ? `💲 Saldo a abonar: *${U.money(s)}*` : '💲 El trabajo ya está abonado.',
      '',
      'Recordá traer la orden/factura original para el retiro.',
      c.address ? `📍 ${c.address}` : '',
      '',
      '¡Gracias por tu confianza!'
    ];
    return lines.filter((l, i, arr) => !(l === '' && arr[i - 1] === '')).join('\n');
  }

  function openPago(o) {
    pagoTarget = o.id;
    const pg = pagado(o);
    U.$('#pagoInfo').innerHTML = `
      <div class="font-semibold">N° ${U.pad8(o.numero)} · ${U.esc(o.nombre)}</div>
      <div class="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 text-sm">
        <span class="text-gray-500">Total</span><span class="text-right font-medium">${U.money(o.total)}</span>
        <span class="text-gray-500">Seña</span><span class="text-right">${U.money(o.sena)}${o.sena > 0 ? ` <span class="text-xs text-gray-400">(${U.esc(o.senaMetodo || 'Efectivo')})</span>` : ''}</span>
        <span class="text-gray-500">Pagos registrados</span><span class="text-right">${U.money(pg)}</span>
        <span class="text-gray-900 font-semibold">Saldo</span><span class="text-right font-bold text-red-600">${U.money(saldo(o))}</span>
      </div>
      ${(o.pagos || []).length ? `<div class="mt-3 text-xs text-gray-500 space-y-0.5">${o.pagos.map(p => `<div>• ${U.fmtDate(p.ts, true)} — ${U.money(p.monto)} (${U.esc(p.metodo || 'Efectivo')})</div>`).join('')}</div>` : ''}`;
    U.$('#pagoMonto').value = Math.max(0, saldo(o)) ? U.money(Math.max(0, saldo(o))) : '';
    U.$('#pagoMetodo').value = 'Efectivo';
    U.$('#pagoEntregado').checked = false;
    U.openModal('modalPago');
  }

  function confirmPago() {
    const o = Store.get('orders', pagoTarget);
    if (!o) return;
    const monto = U.parseMoney(U.$('#pagoMonto').value);
    if (!(monto > 0)) { U.toast('Ingresá un monto válido', 'warn'); return; }
    o.pagos = [...(o.pagos || []), { monto, metodo: U.$('#pagoMetodo').value, ts: Date.now() }];
    if (U.$('#pagoEntregado').checked && o.estado !== 'Entregado') {
      o.estado = 'Entregado';
      o.entregadoAt = Date.now();
      o.historial = [...(o.historial || []), { estado: 'Entregado', ts: Date.now() }];
    }
    Store.upsert('orders', o);
    U.closeModal('modalPago');
    const s = saldo(o);
    U.toast(s <= 0 ? 'Pago registrado. ¡Orden saldada!' : `Pago registrado. Resta ${U.money(s)}`, 'success');
  }

  function openGanancia(o) {
    gananciaTarget = o.id;
    const equipo = [o.marca, o.modelo].filter(Boolean).join(' ') || 'Sin equipo';
    U.$('#ganOrderInfo').innerHTML = `
      <div class="font-semibold text-slate-900">N° ${U.pad8(o.numero)} · ${U.esc(o.nombre)}</div>
      <div class="text-xs text-slate-500 mt-0.5">${U.esc(equipo)} · ${U.esc(o.falla || '-')}</div>
      <div class="mt-2 font-bold text-slate-800">Total cobrado al cliente: ${U.money(o.total)}</div>`;
    const c = costo(o);
    const g = ganancia(o);
    U.$('#ganCostoInput').value = c ? U.money(c) : '';
    U.$('#ganNetaInput').value = g ? U.money(g) : '';
    const fLbl = U.$('#ganModalFormulaLabel');
    if (fLbl) fLbl.textContent = `Fórmula (${U.money(Store.config.ganancia || 30000)})`;
    U.openModal('modalGanancia');
  }

  function confirmGanancia() {
    const o = Store.get('orders', gananciaTarget);
    if (!o) return;
    o.costoInterno = Math.max(0, U.parseMoney(U.$('#ganCostoInput').value));
    o.gananciaInterna = Math.max(0, U.parseMoney(U.$('#ganNetaInput').value));
    Store.upsert('orders', o);
    U.closeModal('modalGanancia');
    U.toast(`Ganancia actualizada: ${U.money(o.gananciaInterna)}`, 'success');
  }

  async function onAction(act, id) {
    const o = Store.get('orders', id);
    if (!o) return;
    switch (act) {
      case 'ganancia': openGanancia(o); break;
      case 'pago': openPago(o); break;
      case 'ver': Boleta.loadOrder(o); break;
      case 'wa': {
        if (!o.tel) { U.toast('La orden no tiene teléfono cargado', 'warn'); return; }
        U.openWA(o.tel, waListo(o));
        if (o.estado !== 'Listo para retirar' && o.estado !== 'Entregado') {
          if (await U.confirm('¿Marcar también la orden como "Listo para retirar"?', { title: 'Actualizar estado', okText: 'Marcar como listo' })) {
            setEstado(o, 'Listo para retirar');
            U.toast('Estado cambiado a "Listo para retirar"');
          }
        }
        break;
      }
      case 'tsv':
        if (await U.copy(tsv(o))) U.toast('Fila copiada (TSV). Pegala en tu planilla.', 'success');
        break;
      case 'del': {
        if (await U.confirm(`¿Eliminar la orden N° ${U.pad8(o.numero)} de ${o.nombre}? Esta acción no se puede deshacer.`, { okText: 'Eliminar', danger: true })) {
          const reps = (o.repuestos || []).filter(r => r && r.stockId && (Number(r.qty) || 0) > 0 && Store.get('stock', r.stockId));
          if (reps.length) {
            const detalle = reps.map(r => `${r.qty}x ${r.desc || 'repuesto'}`).join(', ');
            const devolver = await U.confirm(
              `Esta orden tiene repuestos descontados del stock (${detalle}). ¿Querés devolver esas unidades al inventario?`,
              { title: 'Reintegrar stock', okText: 'Devolver al stock', cancelText: 'No devolver' }
            );
            if (devolver) {
              reps.forEach(r => {
                const item = Store.get('stock', r.stockId);
                if (item) {
                  item.cantidad = (Number(item.cantidad) || 0) + (Number(r.qty) || 0);
                  Store.upsert('stock', item);
                }
              });
            }
          }
          Store.remove('orders', id);
          U.toast('Orden eliminada');
        }
        break;
      }
    }
  }

  function exportXLSX() {
    if (typeof XLSX === 'undefined') { U.toast('SheetJS no disponible', 'error'); return; }
    const rows = filtered().map(o => ({
      'N°': U.pad8(o.numero), Fecha: U.fechaOrden(o.fecha), Nombre: o.nombre, Tel: o.tel, Marca: o.marca, Modelo: o.modelo,
      Falla: o.falla, Observaciones: o.observaciones, Contraseña: o.contrasena, Patrón: Pattern.toText(o.patron),
      Total: o.total || 0, Seña: o.sena || 0, Pagado: pagado(o), Saldo: saldo(o),
      'Costo Interno': costo(o), 'Ganancia Neta': ganancia(o), Estado: o.estado,
      Repuestos: (o.repuestos || []).map(r => `${r.qty}x ${r.desc}`).join(', ')
    }));
    if (!rows.length) { U.toast('No hay órdenes para exportar', 'warn'); return; }
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Reparaciones');
    XLSX.writeFile(wb, `Registro_Reparaciones_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  function init() {
    U.$('#rSearch').addEventListener('input', U.debounce(render, 150));
    U.$('#rMonthFilter').addEventListener('change', e => {
      filterMonth = e.target.value;
      render();
    });
    U.$('#rChips').addEventListener('click', e => {
      const c = e.target.closest('[data-chip]');
      if (!c) return;
      filterEstado = c.dataset.chip;
      render();
    });
    const section = U.$('#tab-registro');
    section.addEventListener('change', e => {
      const sel = e.target.closest('[data-estado]');
      if (!sel) return;
      const o = Store.get('orders', sel.dataset.estado);
      if (o) { setEstado(o, sel.value); U.toast(`N° ${U.pad8(o.numero)} → ${sel.value}`); }
    });
    section.addEventListener('click', e => {
      const b = e.target.closest('[data-act]');
      if (b) onAction(b.dataset.act, b.dataset.id);
    });

    U.$('#pagoConfirm').addEventListener('click', confirmPago);
    const pm = U.$('#pagoMonto');
    pm.addEventListener('focus', () => { const v = U.parseMoney(pm.value); pm.value = v ? String(v) : ''; });
    pm.addEventListener('blur', () => { const v = U.parseMoney(pm.value); pm.value = v ? U.money(v) : ''; });

    const gCosto = U.$('#ganCostoInput');
    const gNeta = U.$('#ganNetaInput');
    [gCosto, gNeta].filter(Boolean).forEach(inp => {
      inp.addEventListener('focus', () => { const v = U.parseMoney(inp.value); inp.value = v ? String(v) : ''; requestAnimationFrame(() => inp.select()); });
      inp.addEventListener('blur', () => { const v = U.parseMoney(inp.value); inp.value = v ? U.money(v) : ''; });
    });
    if (gCosto) {
      gCosto.addEventListener('input', () => {
        const o = Store.get('orders', gananciaTarget);
        const tot = o ? (Number(o.total) || 0) : 0;
        const c = U.parseMoney(gCosto.value);
        if (tot > 0) gNeta.value = U.money(Math.max(0, tot - c));
      });
    }
    U.$('#ganModalFormula').addEventListener('click', () => {
      const o = Store.get('orders', gananciaTarget);
      const tot = o ? (Number(o.total) || 0) : 0;
      const baseGan = Number(Store.config.ganancia) || 30000;
      const c = U.parseMoney(gCosto.value);
      if (c > 0 && tot > 0) {
        gNeta.value = U.money(Math.max(0, tot - c));
      } else if (tot > 0) {
        const gan = Math.min(tot, baseGan);
        gNeta.value = U.money(gan);
        gCosto.value = tot > gan ? U.money(tot - gan) : '';
      } else {
        gNeta.value = U.money(baseGan);
      }
    });
    U.$('#ganModalManoObra').addEventListener('click', () => {
      const o = Store.get('orders', gananciaTarget);
      const tot = o ? (Number(o.total) || 0) : (Number(Store.config.ganancia) || 30000);
      gCosto.value = '';
      gNeta.value = U.money(tot);
    });
    U.$('#ganSaveBtn').addEventListener('click', confirmGanancia);

    U.$('#rExport').addEventListener('click', exportXLSX);

    Store.on('orders', render);
    Store.on('config', render);
    render();
  }

  return { init, ESTADOS, saldo, ganancia };
})();
