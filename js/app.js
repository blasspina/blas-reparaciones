/* =========================================================================
   BLAS REPARACIONES · Aplicación (navegación, ajustes, sincronización)
   ========================================================================= */
'use strict';

const App = (() => {
  const TABS = ['boleta', 'presupuesto', 'registro', 'stock'];
  const TAB_KEY = 'blasrep_tab';
  let settingsQR = { mode: 'auto', image: '' };

  function goTab(tab) {
    if (!TABS.includes(tab)) tab = 'boleta';
    U.$$('[data-tab-panel]').forEach(p => p.classList.toggle('hidden', p.dataset.tabPanel !== tab));
    U.$$('[data-tab]').forEach(b => {
      const active = b.dataset.tab === tab;
      b.classList.toggle('tab-active', active);
      b.setAttribute('aria-current', active ? 'page' : 'false');
    });
    localStorage.setItem(TAB_KEY, tab);
    if (location.hash !== '#' + tab) history.replaceState(null, '', '#' + tab);
  }

  /* -------------------------------- Ajustes --------------------------------- */
  function openSettings() {
    const c = Store.config;
    U.$('#cfgAddress').value = c.address || '';
    U.$('#cfgWhatsapp').value = c.whatsapp || '';
    U.$('#cfgInstagram').value = c.instagram || '';
    U.$('#cfgLastNumber').value = Math.max(0, (c.nextNumber || 1) - 1);
    U.$('#cfgPrefix').value = c.countryPrefix || '549';
    U.$('#cfgQrTarget').value = c.qrTarget || '';
    settingsQR = { mode: c.qrMode || 'auto', image: c.qrImage || '' };
    U.$$('input[name="cfgQrMode"]').forEach(r => { r.checked = r.value === settingsQR.mode; });
    renderSettingsPreview();
    U.openModal('modalSettings');
  }

  function renderSettingsPreview() {
    const c = Store.config;
    const logoPrev = U.$('#cfgLogoPreview');
    logoPrev.classList.toggle('bg-gray-800', !c.logo);
    logoPrev.classList.toggle('rounded-full', !c.logo);
    logoPrev.innerHTML = c.logo
      ? `<img src="${c.logo}" alt="Logo" class="w-full h-full object-contain">`
      : '<span class="font-black text-white text-xl">BS</span>';
    const mode = (U.$('input[name="cfgQrMode"]:checked') || {}).value || 'auto';
    U.$('#cfgQrAutoBox').classList.toggle('hidden', mode !== 'auto');
    U.$('#cfgQrCustomBox').classList.toggle('hidden', mode !== 'custom');
    const src = mode === 'custom'
      ? settingsQR.image
      : QR.dataURL(U.$('#cfgQrTarget').value.trim() || 'https://wa.me/5492255551419', 300);
    const prev = U.$('#cfgQrPreview');
    prev.innerHTML = src ? `<img src="${src}" alt="QR" class="w-full h-full object-contain">` : '<span class="text-xs text-gray-400 text-center px-2">Subí una imagen</span>';
  }

  function saveSettings() {
    const last = Math.max(0, parseInt(U.$('#cfgLastNumber').value, 10) || 0);
    const mode = (U.$('input[name="cfgQrMode"]:checked') || {}).value || 'auto';
    if (mode === 'custom' && !settingsQR.image) {
      U.toast('Subí la imagen de tu QR o elegí "Generar automáticamente"', 'warn');
      return;
    }
    const prevNext = Store.config.nextNumber;
    Store.setConfig({
      address: U.$('#cfgAddress').value.trim(),
      whatsapp: U.$('#cfgWhatsapp').value.trim(),
      instagram: U.$('#cfgInstagram').value.trim(),
      countryPrefix: U.$('#cfgPrefix').value.replace(/\D/g, '') || '549',
      qrTarget: U.$('#cfgQrTarget').value.trim() || 'https://wa.me/5492255551419',
      qrMode: mode,
      qrImage: settingsQR.image,
      nextNumber: last + 1
    }, { forceNumber: last + 1 !== prevNext });
    U.closeModal('modalSettings');
    U.toast('Ajustes guardados', 'success');
  }

  /* ---------------------------- Sincronización ------------------------------ */
  function openSync() {
    const s = Sync.getSaved();
    if (s) {
      U.$('#syncConfig').value = JSON.stringify(s.cfg, null, 2);
      U.$('#syncCode').value = s.code || '';
      U.$('#syncEmail').value = Sync.userEmail || s.email || '';
    }
    U.$('#syncPassword').value = '';
    renderSyncStatus(Sync.status);
    U.openModal('modalSync');
  }

  function renderSyncStatus(status, detail) {
    const map = {
      off: ['bg-gray-400', 'Solo local', 'Los datos se guardan únicamente en este dispositivo.'],
      connecting: ['bg-amber-400 animate-pulse', 'Conectando…', 'Estableciendo conexión con Firebase…'],
      online: ['bg-emerald-400', 'En la nube', detail || 'Sincronización en tiempo real activa.'],
      offline: ['bg-amber-500', 'Sin conexión', detail || 'Los cambios se enviarán al reconectar.'],
      locked: ['bg-blue-400', 'Bloqueado', detail || 'Iniciá sesión con el usuario del taller.'],
      error: ['bg-red-500', 'Error sync', detail || 'Error de conexión.']
    };
    const [dot, label, text] = map[status] || map.off;
    U.$('#syncDot').className = `w-2.5 h-2.5 rounded-full ${dot}`;
    U.$('#syncLabel').textContent = label;
    const st = U.$('#syncStatusBox');
    if (st) {
      st.innerHTML = `<span class="w-2.5 h-2.5 rounded-full shrink-0 ${dot}"></span><span>${U.esc(text)}</span>`;
    }
    const disc = U.$('#syncDisconnect');
    if (disc) disc.classList.toggle('hidden', !Sync.isConfigured());
    const logout = U.$('#syncLogout');
    if (logout) logout.classList.toggle('hidden', !Sync.loggedIn);
  }

  async function doConnect(btn) {
    let cfg;
    try {
      cfg = Sync.parseConfig(U.$('#syncConfig').value);
    } catch (e) {
      U.toast(e.message, 'error', 5000);
      return;
    }
    const code = U.$('#syncCode').value.trim();
    if (!code) { U.toast('Ingresá un código de taller (el mismo en todos los dispositivos)', 'warn'); U.$('#syncCode').focus(); return; }
    const email = U.$('#syncEmail').value.trim();
    const password = U.$('#syncPassword').value;
    const sameUser = Sync.loggedIn && (!email || email.toLowerCase() === String(Sync.userEmail).toLowerCase());
    if (!sameUser) {
      if (!email) { U.toast('Ingresá el email del taller', 'warn'); U.$('#syncEmail').focus(); return; }
      if (!password) { U.toast('Ingresá la contraseña', 'warn'); U.$('#syncPassword').focus(); return; }
    }
    const prev = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Conectando…';
    try {
      const c = await Sync.connect(cfg, code, password ? { email, password } : {});
      U.$('#syncCode').value = c;
      U.$('#syncPassword').value = '';
      U.toast('¡Sincronización activada! Usá el mismo código y usuario en los otros dispositivos.', 'success', 5000);
    } catch (e) {
      U.toast('No se pudo conectar: ' + e.message, 'error', 7000);
    } finally {
      btn.disabled = false;
      btn.innerHTML = prev;
      U.icons();
    }
  }

  /* --------------------------- Pantalla de bloqueo --------------------------- */
  function renderLockLogo() {
    const c = Store.config;
    const img = U.$('#authLogoImg');
    const def = U.$('#authLogoDefault');
    if (!img || !def) return;
    if (c.logo) { img.src = c.logo; img.hidden = false; def.hidden = true; }
    else { img.removeAttribute('src'); img.hidden = true; def.hidden = false; }
  }

  function showLockChecking() {
    const lock = U.$('#authLockScreen');
    lock.classList.remove('hidden');
    document.body.classList.add('auth-locked');
    U.$('#authChecking').classList.remove('hidden');
    U.$('#authLockForm').classList.add('hidden');
  }

  function setLockError(msg) {
    const box = U.$('#authError');
    box.textContent = msg || '';
    box.classList.toggle('hidden', !msg);
  }

  function applyLock(isLocked, reason) {
    const lock = U.$('#authLockScreen');
    if (isLocked) {
      U.$$('dialog[open]').forEach(d => d.close());
      lock.classList.remove('hidden');
      document.body.classList.add('auth-locked');
      U.$('#authChecking').classList.add('hidden');
      U.$('#authLockForm').classList.remove('hidden');
      const s = Sync.getSaved();
      const emailInp = U.$('#authEmail');
      if (!emailInp.value && s && s.email) emailInp.value = s.email;
      U.$('#authPassword').value = '';
      setLockError(reason || '');
      U.icons();
      setTimeout(() => (emailInp.value ? U.$('#authPassword') : emailInp).focus(), 60);
    } else {
      lock.classList.add('hidden');
      document.body.classList.remove('auth-locked');
      setLockError('');
    }
  }

  async function submitLock(e) {
    e.preventDefault();
    const email = U.$('#authEmail').value.trim();
    const password = U.$('#authPassword').value;
    if (!email) { setLockError('Ingresá el email del taller.'); U.$('#authEmail').focus(); return; }
    if (!password) { setLockError('Ingresá la contraseña.'); U.$('#authPassword').focus(); return; }
    const btn = U.$('#authSubmit');
    const prev = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Ingresando…';
    setLockError('');
    try {
      await Sync.login(email, password);
      U.toast('¡Bienvenido! Sesión iniciada.', 'success');
    } catch (err) {
      setLockError(err.message);
      U.$('#authPassword').select();
    } finally {
      btn.disabled = false;
      btn.innerHTML = prev;
      U.icons();
    }
  }

  function exportBackup() {
    const data = Store.exportJSON();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const d = new Date();
    const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}_${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
    U.downloadBlob(blob, `respaldo_blas_reparaciones_${stamp}.json`);
    U.toast('Respaldo exportado', 'success');
  }

  async function importBackup(file) {
    if (!file) return;
    try {
      const obj = JSON.parse(await file.text());
      const mode = (U.$('input[name="importMode"]:checked') || {}).value || 'merge';
      if (mode === 'replace' && !(await U.confirm('Se reemplazarán TODOS los datos actuales por los del respaldo. ¿Continuar?', { okText: 'Reemplazar', danger: true }))) return;
      await Store.importJSON(obj, mode);
      U.toast(`Respaldo importado (${(obj.orders || []).length} órdenes, ${(obj.stock || []).length} productos)`, 'success', 5000);
    } catch (e) {
      U.toast('No se pudo importar: ' + e.message, 'error', 6000);
    }
  }

  /* ---------------------------------- Init ---------------------------------- */
  function init() {
    U.$$('[data-tab]').forEach(b => b.addEventListener('click', () => goTab(b.dataset.tab)));
    window.addEventListener('hashchange', () => goTab(location.hash.slice(1)));

    U.$$('[data-close]').forEach(b => b.addEventListener('click', () => {
      const d = b.closest('dialog');
      if (d) d.close();
    }));
    U.$$('dialog.modal').forEach(d => d.addEventListener('click', e => {
      if (e.target === d) d.close();
    }));

    U.$('#btnSettings').addEventListener('click', openSettings);
    U.$('#cfgSave').addEventListener('click', saveSettings);
    U.$('#cfgLogoUpload').addEventListener('click', () => U.$('#cfgLogoFile').click());
    U.$('#cfgLogoFile').addEventListener('change', async e => {
      await Boleta.uploadLogo(e.target.files[0]);
      e.target.value = '';
      renderSettingsPreview();
    });
    U.$('#cfgLogoReset').addEventListener('click', () => {
      Store.setConfig({ logo: '' });
      renderSettingsPreview();
      U.toast('Se restauró el logo BS');
    });
    U.$$('input[name="cfgQrMode"]').forEach(r => r.addEventListener('change', renderSettingsPreview));
    U.$('#cfgQrTarget').addEventListener('input', U.debounce(renderSettingsPreview, 250));
    U.$('#cfgQrUpload').addEventListener('click', () => U.$('#cfgQrFile').click());
    U.$('#cfgQrFile').addEventListener('change', async e => {
      const f = e.target.files[0];
      e.target.value = '';
      if (!f) return;
      try {
        settingsQR.image = await U.resizeImage(await U.readFileAsDataURL(f), 500, 'image/png');
        renderSettingsPreview();
      } catch (err) {
        U.toast('Imagen inválida', 'error');
      }
    });

    U.$('#btnSync').addEventListener('click', openSync);
    U.$('#syncConnect').addEventListener('click', e => doConnect(e.currentTarget));
    U.$('#syncLogout').addEventListener('click', async () => {
      if (await U.confirm('¿Cerrar la sesión en este dispositivo? Se bloqueará el acceso hasta volver a ingresar con el usuario y la contraseña del taller.', { okText: 'Cerrar sesión' })) {
        await Sync.signOut();
        U.closeModal('modalSync');
        U.toast('Sesión cerrada');
      }
    });
    U.$('#syncDisconnect').addEventListener('click', async () => {
      if (await U.confirm('¿Desactivar la sincronización en este dispositivo? Los datos locales se conservan.', { okText: 'Desactivar' })) {
        await Sync.disconnect(false);
        U.toast('Sincronización desactivada');
      }
    });
    U.$('#bkExport').addEventListener('click', exportBackup);
    U.$('#bkImport').addEventListener('click', () => U.$('#bkFile').click());
    U.$('#bkFile').addEventListener('change', e => { importBackup(e.target.files[0]); e.target.value = ''; });

    U.$('#authLockForm').addEventListener('submit', submitLock);
    U.$('#authTogglePass').addEventListener('click', () => {
      const inp = U.$('#authPassword');
      const show = inp.type === 'password';
      inp.type = show ? 'text' : 'password';
      U.$('#authTogglePass').innerHTML = `<i data-lucide="${show ? 'eye-off' : 'eye'}" class="w-4 h-4"></i>`;
      U.icons();
      inp.focus();
    });
    U.$('#authForgot').addEventListener('click', async () => {
      const email = U.$('#authEmail').value.trim();
      if (!email) { setLockError('Escribí el email del taller para enviarte el enlace de recuperación.'); U.$('#authEmail').focus(); return; }
      try {
        await Sync.resetPassword(email);
        setLockError('');
        U.toast('Se envió un correo para restablecer la contraseña a ' + email, 'success', 6000);
      } catch (err) {
        setLockError(err.message);
      }
    });

    Sync.onStatus(renderSyncStatus);
    Sync.onLock(applyLock);
    Store.on('config', renderLockLogo);
    renderLockLogo();
    if (Sync.isConfigured()) showLockChecking();
    else applyLock(false);

    Boleta.init();
    Presupuesto.init();
    Registro.init();
    Stock.init();

    const initial = location.hash.slice(1) || localStorage.getItem(TAB_KEY) || 'boleta';
    goTab(initial);
    U.icons();

    Store.loadPriceLists().finally(() => Sync.autoStart());

    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW no registrado', err));
    }
  }

  return { init, goTab, openSettings };
})();

document.addEventListener('DOMContentLoaded', App.init);
