/* =========================================================================
   BLAS REPARACIONES · Sincronización Multi-dispositivo (Firebase Realtime DB)
   Autenticación con Email y Contraseña (Firebase Auth, persistencia LOCAL)
   ========================================================================= */
'use strict';

/* Configuración de Firebase y código de taller por defecto: la app funciona en cualquier
   navegador nuevo (o incógnito) sin pegar nada en el modal de Sincronización. */
const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyCXJxUjLWP7g-7BccA-o15gjsUaa8PZduc",
  authDomain: "blas-reparaciones.firebaseapp.com",
  databaseURL: "https://blas-reparaciones-default-rtdb.firebaseio.com",
  projectId: "blas-reparaciones",
  storageBucket: "blas-reparaciones.firebasestorage.app",
  messagingSenderId: "90804975020",
  appId: "1:90804975020:web:a380668af34361d5777609"
};
const DEFAULT_SHOP_CODE = 'blas-reparaciones';

const Sync = (() => {
  const KEY = 'blasrep_firebase_v1';
  const SESSION_KEY = 'blasrep_session_v1';
  const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
  const APP_NAME = 'blasrep-app';
  const COLS = ['orders', 'stock'];

  let app = null;
  let auth = null;
  let root = null;
  let infoRef = null;
  let authUnsub = null;
  let status = 'off';
  let statusDetail = '';
  let locked = false;
  let pendingInitialMerge = false;
  const statusListeners = [];
  const lockListeners = [];

  function defaultSaved() {
    return { cfg: { ...DEFAULT_FIREBASE_CONFIG }, code: DEFAULT_SHOP_CODE, email: '', enabled: true };
  }
  /** Devuelve la config guardada; si no hay ninguna (navegador nuevo/incógnito) usa la de por defecto */
  function getSaved() {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(KEY)) || null; } catch (e) { s = null; }
    if (!s) return defaultSaved();
    if (!s.cfg || !s.cfg.databaseURL) return { ...s, cfg: { ...DEFAULT_FIREBASE_CONFIG }, code: s.code || DEFAULT_SHOP_CODE };
    return s;
  }
  function save(obj) { localStorage.setItem(KEY, JSON.stringify(obj)); }
  function isConfigured() {
    const s = getSaved();
    return !!(s && s.enabled && s.cfg && s.cfg.databaseURL);
  }

  function setStatus(s, detail = '') {
    status = s;
    statusDetail = detail;
    statusListeners.forEach(fn => { try { fn(s, detail); } catch (e) { console.error(e); } });
  }
  function onStatus(fn) { statusListeners.push(fn); fn(status, statusDetail); }

  function setLocked(v, reason = '') {
    locked = !!v;
    lockListeners.forEach(fn => { try { fn(locked, reason); } catch (e) { console.error(e); } });
  }
  function onLock(fn) { lockListeners.push(fn); }

  function markSession(email) {
    if (email) localStorage.setItem(SESSION_KEY, JSON.stringify({ email, ts: Date.now() }));
    else localStorage.removeItem(SESSION_KEY);
  }
  function hadSession() {
    try { return !!JSON.parse(localStorage.getItem(SESSION_KEY)); } catch (e) { return false; }
  }

  function loadScript(src) {
    return new Promise((res, rej) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        if (existing.dataset.loaded === '1') return res();
        existing.addEventListener('load', () => res());
        existing.addEventListener('error', () => rej(new Error('No se pudo cargar ' + src)));
        return;
      }
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => { s.dataset.loaded = '1'; res(); };
      s.onerror = () => {
        s.remove();
        const err = new Error('No se pudo cargar el SDK de Firebase. Verificá tu conexión a Internet.');
        err.code = 'sdk/unavailable';
        rej(err);
      };
      document.head.appendChild(s);
    });
  }

  /** Acepta JSON puro o el snippet JS "const firebaseConfig = {...}" de la consola de Firebase */
  function parseConfig(text) {
    let t = String(text || '').trim();
    const start = t.indexOf('{');
    const end = t.lastIndexOf('}');
    if (start < 0 || end < 0 || end <= start) throw new Error('No se encontró un objeto de configuración { ... }');
    t = t.slice(start, end + 1);
    try { return JSON.parse(t); } catch (e) { /* se intenta como literal JS */ }
    const json = t
      .replace(/^\s*\/\/.*$/gm, '')
      .replace(/([{,]\s*)([A-Za-z_$][\w$]*)\s*:/g, '$1"$2":')
      .replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (m, g) => '"' + g.replace(/"/g, '\\"') + '"')
      .replace(/,\s*}/g, '}');
    try {
      return JSON.parse(json);
    } catch (e) {
      throw new Error('La configuración no tiene un formato válido. Pegá el objeto firebaseConfig completo.');
    }
  }

  function sanitizeCode(code) {
    return String(code || '').trim().toLowerCase().replace(/[.#$\[\]\/\s]+/g, '-').replace(/^-+|-+$/g, '') || 'blas-reparaciones';
  }

  function clean(obj) { return JSON.parse(JSON.stringify(obj)); }

  function withTimeout(promise, ms, msg) {
    return Promise.race([
      promise,
      new Promise((_, rej) => setTimeout(() => rej(new Error(msg)), ms))
    ]);
  }

  function friendlyError(e) {
    const code = (e && e.code) || '';
    const map = {
      'auth/invalid-credential': 'Email o contraseña incorrectos.',
      'auth/invalid-login-credentials': 'Email o contraseña incorrectos.',
      'auth/wrong-password': 'Email o contraseña incorrectos.',
      'auth/user-not-found': 'No existe un usuario con ese email.',
      'auth/invalid-email': 'El email no tiene un formato válido.',
      'auth/missing-password': 'Ingresá la contraseña.',
      'auth/user-disabled': 'Este usuario fue deshabilitado en Firebase.',
      'auth/too-many-requests': 'Demasiados intentos fallidos. Esperá unos minutos e intentá de nuevo.',
      'auth/network-request-failed': 'Sin conexión a Internet. Verificá la red e intentá de nuevo.',
      'auth/operation-not-allowed': 'El acceso con Correo electrónico/contraseña no está habilitado en Firebase Authentication.',
      'auth/api-key-not-valid.-please-pass-a-valid-api-key.': 'La apiKey de la configuración no es válida.',
      'PERMISSION_DENIED': 'Permiso denegado por las reglas de Realtime Database.',
      'permission-denied': 'Permiso denegado por las reglas de Realtime Database.'
    };
    return map[code] || (e && e.message) || String(e);
  }

  /* ---------------------------- App / Auth ---------------------------- */
  async function ensureApp(cfg) {
    await loadScript(SDK + 'firebase-app-compat.js');
    await loadScript(SDK + 'firebase-auth-compat.js');
    await loadScript(SDK + 'firebase-database-compat.js');

    const same = app && app.options &&
      app.options.apiKey === cfg.apiKey &&
      app.options.databaseURL === cfg.databaseURL;
    if (same) return app;

    detachListeners();
    const existing = firebase.apps.find(a => a.name === APP_NAME);
    if (existing) { try { await existing.delete(); } catch (e) { console.warn(e); } }

    app = firebase.initializeApp(cfg, APP_NAME);
    auth = firebase.auth(app);
    await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
    return app;
  }

  function waitAuthReady() {
    return new Promise(res => {
      const un = auth.onAuthStateChanged(u => { un(); res(u); });
    });
  }

  function currentUser() { return auth ? auth.currentUser : null; }

  /* ------------------------------ Conexión ------------------------------ */
  async function connect(cfg, code, creds = {}) {
    if (!cfg || !cfg.databaseURL) {
      throw new Error('La configuración debe incluir "databaseURL". Creá una Realtime Database en tu proyecto de Firebase.');
    }
    const shopCode = sanitizeCode(code);
    const email = String(creds.email || '').trim();
    const password = String(creds.password || '');
    setStatus('connecting', 'Conectando…');

    try {
      await ensureApp(cfg);
      let user = await waitAuthReady();

      if (email && password) {
        if (user && user.email && user.email.toLowerCase() !== email.toLowerCase()) {
          detachListeners();
          await auth.signOut();
        }
        const cred = await auth.signInWithEmailAndPassword(email, password);
        user = cred.user;
      }

      const prev = getSaved() || {};
      save({ cfg, code: shopCode, email: (user && user.email) || email || prev.email || '', enabled: true });

      if (!user) {
        markSession(null);
        setStatus('locked', 'Sesión no iniciada · ingresá con el usuario del taller');
        setLocked(true, '');
        const err = new Error('Iniciá sesión con el email y la contraseña del taller.');
        err.code = 'auth/required';
        throw err;
      }

      const offline = await startSync(shopCode);
      markSession(user.email || email);
      setLocked(false);
      if (offline) setStatus('offline', 'Sin conexión · los cambios se enviarán al reconectar');
      else setStatus('online', `Sincronizado · ${shopCode} · ${user.email || ''}`);
      return shopCode;
    } catch (e) {
      if (e.code === 'auth/required') throw e;
      detachListeners();
      const msg = friendlyError(e);
      setStatus('error', msg);
      const wrapped = new Error(msg);
      wrapped.code = e.code;
      throw wrapped;
    }
  }

  async function startSync(shopCode) {
    detachListeners();
    const db = firebase.database(app);
    root = db.ref('talleres/' + shopCode);

    let offline = false;
    try {
      const snap = await withTimeout(root.once('value'), 12000,
        'No se pudo leer la base de datos. Revisá la URL y las reglas de seguridad.');
      await initialMerge(snap.val() || {});
    } catch (e) {
      // Un error de permisos/reglas es real: se informa. Cualquier otro (sin internet, timeout)
      // deja la app conectada igual para que sincronice sola al volver la conexión.
      const code = (e && e.code) || '';
      if (code === 'PERMISSION_DENIED' || code === 'permission-denied') throw e;
      console.warn('Sin conexión al iniciar la sincronización:', e && e.message);
      offline = true;
      pendingInitialMerge = true;
    }
    attachListeners(db, shopCode);

    authUnsub = auth.onAuthStateChanged(u => {
      if (!u && root) {
        detachListeners();
        markSession(null);
        setStatus('locked', 'La sesión se cerró · ingresá nuevamente');
        setLocked(true, 'La sesión se cerró. Ingresá nuevamente.');
      }
    });
    return offline;
  }

  async function initialMerge(remote) {
    const updates = {};

    COLS.forEach(col => {
      const remoteArr = Object.values(remote[col] || {});
      const remoteMap = {};
      remoteArr.forEach(r => { if (r && r.id) remoteMap[r.id] = r; });
      const merged = Store.mergeArrays(Store.raw(col), remoteArr);
      merged.forEach(it => {
        const r = remoteMap[it.id];
        if (!r || (it.updatedAt || 0) > (r.updatedAt || 0)) updates[`${col}/${it.id}`] = clean(it);
      });
      Store.applyRemote(col, merged);
    });

    const lc = Store.config;
    const rc = remote.config;
    let cfgMerged;
    if (!rc || (lc.updatedAt || 0) > (rc.updatedAt || 0)) cfgMerged = { ...lc };
    else cfgMerged = { ...lc, ...rc };
    cfgMerged.nextNumber = Math.max(lc.nextNumber || 0, (rc && rc.nextNumber) || 0);
    updates.config = clean(cfgMerged);
    Store.applyRemoteConfig(cfgMerged);

    const remoteLists = Object.values(remote.priceLists || {});
    const remoteListMap = {};
    remoteLists.forEach(l => { if (l && l.id) remoteListMap[l.id] = l; });
    const mergedLists = Store.mergeArrays(Store.rawPriceLists(), remoteLists);
    mergedLists.forEach(l => {
      const r = remoteListMap[l.id];
      if (!r || (l.updatedAt || 0) > (r.updatedAt || 0)) updates[`priceLists/${l.id}`] = clean(l);
    });
    await Store.applyRemotePriceLists(mergedLists);

    await root.update(updates);
  }

  function attachListeners(db, shopCode) {
    COLS.forEach(col => {
      root.child(col).on('value', s => Store.applyRemote(col, Object.values(s.val() || {})));
    });
    root.child('config').on('value', s => {
      const v = s.val();
      if (v) Store.applyRemoteConfig(v);
    });
    root.child('priceLists').on('value', s => {
      Store.applyRemotePriceLists(Object.values(s.val() || {}));
    });
    infoRef = db.ref('.info/connected');
    infoRef.on('value', s => {
      if (!root) return;
      const u = currentUser();
      if (s.val() === true) {
        setStatus('online', `Sincronizado · ${shopCode}${u && u.email ? ' · ' + u.email : ''}`);
        if (pendingInitialMerge) {
          // Arrancó sin internet: al volver la conexión se hace la mezcla inicial y se suben los cambios locales
          pendingInitialMerge = false;
          const r = root;
          r.once('value')
            .then(snap => { if (root === r) return initialMerge(snap.val() || {}); })
            .catch(err => { pendingInitialMerge = true; console.warn('Mezcla inicial pendiente:', err && err.message); });
        }
      }
      else setStatus('offline', 'Sin conexión · los cambios se enviarán al reconectar');
    });
  }

  function detachListeners() {
    try {
      if (authUnsub) { authUnsub(); }
      if (root) {
        COLS.forEach(c => root.child(c).off());
        root.child('config').off();
        root.child('priceLists').off();
      }
      if (infoRef) infoRef.off();
    } catch (e) {
      console.warn(e);
    }
    authUnsub = null; root = null; infoRef = null;
  }

  /** Inicia sesión usando la configuración ya guardada en el dispositivo (pantalla de bloqueo) */
  async function login(email, password) {
    const s = getSaved();
    if (!s || !s.cfg) throw new Error('No hay una configuración de Firebase guardada en este dispositivo.');
    if (!email || !password) {
      const err = new Error('Ingresá el email y la contraseña.');
      err.code = 'auth/missing-password';
      throw err;
    }
    return connect(s.cfg, s.code, { email, password });
  }

  async function resetPassword(email) {
    const s = getSaved();
    if (!s || !s.cfg) throw new Error('No hay una configuración de Firebase guardada en este dispositivo.');
    if (!email) throw new Error('Escribí tu email para recibir el enlace de recuperación.');
    try {
      await ensureApp(s.cfg);
      await auth.sendPasswordResetEmail(String(email).trim());
    } catch (e) {
      throw new Error(friendlyError(e));
    }
  }

  /** Cierra la sesión pero mantiene la configuración: se mostrará la pantalla de bloqueo */
  async function signOut() {
    detachListeners();
    markSession(null);
    if (auth) {
      try { await auth.signOut(); } catch (e) { console.warn(e); }
    }
    if (isConfigured()) {
      setStatus('locked', 'Sesión cerrada · ingresá con el usuario del taller');
      setLocked(true, '');
    } else {
      setStatus('off', 'Solo local');
    }
  }

  /** Desactiva la sincronización en el dispositivo (cierra sesión y deja de usar Firebase) */
  async function disconnect(keepSaved = false) {
    detachListeners();
    if (!keepSaved) {
      markSession(null);
      try { if (auth) await auth.signOut(); } catch (e) { console.warn(e); }
      try { if (app) await app.delete(); } catch (e) { console.warn(e); }
      app = null; auth = null;
      const s = getSaved();
      if (s) save({ ...s, enabled: false });
      setLocked(false);
      setStatus('off', 'Solo local');
    }
  }

  function report(err) {
    console.error(err);
    U.toast('Error al sincronizar: ' + friendlyError(err), 'error');
  }

  function pushItem(col, item) {
    if (!root) return;
    root.child(`${col}/${item.id}`).set(clean(item)).catch(report);
  }

  function pushConfig(cfg, forceNumber = false) {
    if (!root) return;
    const c = clean(cfg);
    const nn = c.nextNumber || 0;
    delete c.nextNumber;
    root.child('config').update(c).catch(report);
    if (forceNumber) {
      root.child('config/nextNumber').set(nn).catch(report);
    } else {
      root.child('config/nextNumber').transaction(cur => Math.max(cur || 0, nn)).catch(report);
    }
  }

  function pushPriceList(l) {
    if (!root) return;
    root.child(`priceLists/${l.id}`).set(clean(l)).catch(report);
  }

  async function pushAll() {
    if (!root) return;
    const updates = {};
    COLS.forEach(col => Store.raw(col).forEach(it => { updates[`${col}/${it.id}`] = clean(it); }));
    updates.config = clean(Store.config);
    Store.rawPriceLists().forEach(l => { updates[`priceLists/${l.id}`] = clean(l); });
    await root.update(updates);
  }

  async function autoStart() {
    const s = getSaved();
    if (!(s && s.enabled && s.cfg)) {
      setLocked(false);
      setStatus('off', 'Solo local');
      return;
    }
    try {
      await connect(s.cfg, s.code);
    } catch (e) {
      if (e.code === 'auth/required') return;
      if (e.code === 'sdk/unavailable' && hadSession()) {
        setLocked(false);
        setStatus('offline', 'Sin conexión · trabajando con los datos locales');
        return;
      }
      if (!currentUser()) {
        setLocked(true, friendlyError(e));
      } else {
        setLocked(false);
      }
      console.warn('Auto-sync falló:', e.message);
    }
  }

  return {
    get status() { return status; },
    get connected() { return !!root; },
    get locked() { return locked; },
    get userEmail() { const u = currentUser(); return u ? u.email : ''; },
    get loggedIn() { return !!currentUser(); },
    getSaved, isConfigured, parseConfig, sanitizeCode, connect, login, resetPassword, signOut, disconnect,
    onStatus, onLock, pushItem, pushConfig, pushPriceList, pushAll, autoStart
  };
})();
