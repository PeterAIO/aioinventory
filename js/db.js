/**
 * db.js — AIO Inventory · Firebase Firestore backend
 */
const DB_CONFIG = {
  apiKey:            "AIzaSyCwlZg9YaGfQDKuVBDI4RAkEzKcDg7Cgdo",
  authDomain:        "aio-inventory-b9b29.firebaseapp.com",
  projectId:         "aio-inventory-b9b29",
  storageBucket:     "aio-inventory-b9b29.firebasestorage.app",
  messagingSenderId: "146229036238",
  appId:             "1:146229036238:web:c91467e73e3e2912683c9f"
};

const DB = (() => {
  let _pendingWrite = false;
  let _data  = { movements: [], thresholds: {}, shipments: [], serialCosts: {}, serialConditions: {}, customSuppliers: [], customLocations: [], orders: [], suppliers: [], productRecords: [], auditRecords: [], pendingUsers: {}, pendingDeployments: [], pausedAudits: {}, hubspotCompanyMap: {} };
  let _db    = null;
  let _ready = false;
  let _onReadyCallbacks = [];

  async function init() {
    try {
      const { initializeApp, getApps } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
      const { getFirestore, doc, getDoc, setDoc, onSnapshot } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');

      const app = getApps().length ? getApps()[0] : initializeApp(DB_CONFIG);
      _db = getFirestore(app);

      const docRef = doc(_db, 'inventory', 'main');
      const snap   = await getDoc(docRef);
      if (snap.exists()) {
        const d = snap.data();
        _data = { movements: d.movements||[], thresholds: d.thresholds||{}, shipments: d.shipments||[], serialCosts: d.serialCosts||{}, serialConditions: d.serialConditions||{}, purchaseOrders: d.purchaseOrders||{}, serialPOs: d.serialPOs||{}, customSuppliers: d.customSuppliers||[], customLocations: d.customLocations||[], orders: d.orders||[], suppliers: d.suppliers||[], productRecords: d.productRecords||[], auditRecords: d.auditRecords||[], pendingUsers: d.pendingUsers||{}, pendingDeployments: d.pendingDeployments||[], pausedAudits: d.pausedAudits||{}, hubspotCompanyMap: d.hubspotCompanyMap||{} };
      } else {
        await setDoc(docRef, _data);
      }

      // Real-time listener — keeps all users in sync
      onSnapshot(docRef, snap => {
        if (!snap.exists()) return;
        if (_pendingWrite) return;
        const d = snap.data();
        _data = { movements: d.movements||[], thresholds: d.thresholds||{}, shipments: d.shipments||[], serialCosts: d.serialCosts||{}, serialConditions: d.serialConditions||{}, purchaseOrders: d.purchaseOrders||{}, serialPOs: d.serialPOs||{}, customSuppliers: d.customSuppliers||[], customLocations: d.customLocations||[], orders: d.orders||[], suppliers: d.suppliers||[], productRecords: d.productRecords||[], auditRecords: d.auditRecords||[], pendingUsers: d.pendingUsers||{}, pendingDeployments: d.pendingDeployments||[], pausedAudits: d.pausedAudits||{}, hubspotCompanyMap: d.hubspotCompanyMap||{} };
        if (typeof _currentView !== 'undefined') _refreshView();
      });

      _ready = true;
      _onReadyCallbacks.forEach(fn => fn());
    } catch(err) {
      console.error('DB init error:', err);
      _loadLS();
      _ready = true;
      _onReadyCallbacks.forEach(fn => fn());
    }
  }

  function _loadLS() {
    try { const r = localStorage.getItem('aio_inventory_v2'); if (r) { const d=JSON.parse(r); _data={movements:[],thresholds:{},shipments:[],serialCosts:{},...d}; } } catch(e) {}
  }

  async function _save() {
    if (!_db) {
      // Firestore never initialised — this device is running localStorage-only
      // and NOTHING is reaching the server. Make that impossible to miss.
      localStorage.setItem('aio_inventory_v2', JSON.stringify(_data));
      _saveBanner('⚠️ <b>NOT CONNECTED TO THE SERVER.</b> Your changes are saved only on this device and are NOT syncing to the team. Refresh the page; if this keeps happening, tell the admin.');
      return;
    }
    try {
      const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
      const payload = JSON.stringify(_data);
      if (payload.length > 850000) _sizeBanner(payload.length);
      await setDoc(doc(_db, 'inventory', 'main'), _data);
      // Write reached the server — clear any prior failure state / local backup.
      _clearSaveBanner();
      try { localStorage.removeItem('aio_inventory_v2'); } catch(_) {}
    } catch(e) {
      // The write DID NOT reach Firestore. Keep a local backup AND scream about it —
      // the old code swallowed this silently, which is how data went missing.
      try { localStorage.setItem('aio_inventory_v2', JSON.stringify(_data)); } catch(_) {}
      console.error('DB save FAILED — change not persisted to server:', e);
      _saveBanner('⚠️ <b>YOUR LAST CHANGE DID NOT SAVE.</b> It is stored only on this device. Do NOT close or refresh this tab — take a screenshot and tell the admin. <span style="opacity:.75">(' + _esc(e && (e.message || e.code) || 'unknown error') + ')</span>');
    }
    finally { setTimeout(() => { _pendingWrite = false; }, 1000); }
  }

  // ── Save-status banners (self-contained; no dependency on ui.js) ─────────
  function _esc(s) { return String(s).replace(/[&<>]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;' }[c])); }
  function _saveBanner(html) {
    if (typeof document === 'undefined') return;
    let el = document.getElementById('db-save-error');
    if (!el) {
      el = document.createElement('div');
      el.id = 'db-save-error';
      el.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:100000;background:#b00020;color:#fff;padding:12px 18px;font:14px/1.45 system-ui,-apple-system,sans-serif;box-shadow:0 -2px 12px rgba(0,0,0,.35);';
      document.body.appendChild(el);
    }
    el.innerHTML = html;
  }
  function _clearSaveBanner() {
    const el = document.getElementById('db-save-error');
    if (el) el.remove();
  }
  function _sizeBanner(len) {
    if (typeof document === 'undefined') return;
    const kb = Math.round(len / 1024);
    console.warn('[DB] inventory document is ~' + kb + 'KB — approaching the Firestore 1MB per-document limit.');
    let el = document.getElementById('db-size-warn');
    if (!el) {
      el = document.createElement('div');
      el.id = 'db-size-warn';
      el.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:99999;background:#8a6d00;color:#fff;padding:8px 18px;font:13px/1.4 system-ui,-apple-system,sans-serif;text-align:center;';
      document.body.appendChild(el);
    }
    el.innerHTML = '⚠️ Inventory database is ~' + kb + 'KB of the 1024KB per-document limit. Approaching capacity — tell the admin to split the data before it stops saving.';
  }

  function onReady(fn)          { if (_ready) fn(); else _onReadyCallbacks.push(fn); }
  function getData()             { return _data; }
  function addMovement(mv)       { _data.movements.push(mv); _save(); }
  function setThreshold(k, v)    { _data.thresholds[k] = v; _save(); }
  function getThreshold(k) {
    if (_data.thresholds[k] !== undefined) return _data.thresholds[k];
    const product = k.split('||')[0];
    const rec = (_data.productRecords || []).find(p => p.name === product);
    if (rec && rec.defaultThreshold != null) return rec.defaultThreshold;
    return 3;
  }
  function addShipment(s)        { _data.shipments.push(s); _save(); }
  function updateShipment(id,u)  { const i=_data.shipments.findIndex(s=>s.id===id); if(i>-1){_data.shipments[i]={..._data.shipments[i],...u};_save();} }
  function removeShipment(id)    { _data.shipments=_data.shipments.filter(s=>s.id!==id); _save(); }
  function setSerialCost(s,c)    { _data.serialCosts[s.toUpperCase()]=c; _save(); }
  function getSerialCost(s)      { return _data.serialCosts[s.toUpperCase()]??null; }

  // HubSpot Company mapping — customer name (exact string) -> HubSpot Company ID
  function setHubspotCompanyId(customer, companyId) {
    if (!_data.hubspotCompanyMap) _data.hubspotCompanyMap = {};
    const key = (customer || '').trim();
    if (!key) return;
    const id = (companyId == null ? '' : String(companyId).trim());
    if (!id) delete _data.hubspotCompanyMap[key];
    else _data.hubspotCompanyMap[key] = id;
    _save();
  }
  function getHubspotCompanyId(customer) { return (_data.hubspotCompanyMap || {})[(customer || '').trim()] || null; }
  function getHubspotCompanyMap()        { return _data.hubspotCompanyMap || {}; }
  function setProductCost(name,cost,map) {
    // Update in-stock serials via inventory map
    Object.values(map).forEach(v => { if(v.product===name) v.inStock.forEach(s=>{_data.serialCosts[s.toUpperCase()]=cost;}); });
    // Also update deployed serials so cost stays consistent across all views
    _data.movements.forEach(mv => {
      if (mv.type === 'OUT' && mv.product === name) {
        mv.serials.forEach(s => { _data.serialCosts[s.toUpperCase()] = cost; });
      }
    });
    _save();
  }

  // Delete a serial from all movements (removes it from stock entirely)
  function deleteSerial(serial) {
    const s = serial.toUpperCase();
    _data.movements = _data.movements.map(mv => ({
      ...mv,
      serials: mv.serials.filter(x => x.toUpperCase() !== s)
    })).filter(mv => mv.serials.length > 0);
    delete _data.serialCosts[s];
    _save();
  }

  // Rename a serial across all movements and cost records
  function renameSerial(oldSerial, newSerial) {
    const o = oldSerial.toUpperCase();
    const n = newSerial.toUpperCase();
    _data.movements = _data.movements.map(mv => ({
      ...mv,
      serials: mv.serials.map(s => s.toUpperCase() === o ? n : s)
    }));
    if (_data.serialCosts[o] !== undefined) {
      _data.serialCosts[n] = _data.serialCosts[o];
      delete _data.serialCosts[o];
    }
    _save();
  }
  // Update condition flag on the IN movement for a serial (also records tester)
  // NOTE: the 'used' field is NEVER modified here — it is permanent from receipt
  function updateSerialCondition(serial, condition, testedBy, testedDate, notes) {
    const s = serial.toUpperCase();
    // Per-serial storage — prevents one serial's condition from bleeding across
    // all serials that share the same batch IN movement
    if (!_data.serialConditions) _data.serialConditions = {};
    _data.serialConditions[s] = {
      condition:  condition,
      testedBy:   testedBy  || '',
      testedAt:   testedDate ? (testedDate + 'T00:00:00.000Z') : (condition === '' ? '' : new Date().toISOString()),
      testNotes:  notes !== undefined ? notes : '',
    };
    // Also scrub any movement-level condition for this serial so the fallback
    // in getAllSerialRows can never bleed the old movement condition onto other
    // serials in the same batch
    _data.movements = _data.movements.map(mv => {
      if (mv.type === 'IN' && (mv.condition || '') !== '' && mv.serials.some(x => x.toUpperCase() === s)) {
        return { ...mv, condition: '' };
      }
      return mv;
    });
    _save();
  }
  function getSerialCondition(serial) {
    const s = serial.toUpperCase();
    const sc = _data.serialConditions || {};
    return s in sc ? sc[s] : null; // null = no per-serial override; caller falls back to movement
  }
  function addOrder(order)       { if(!_data.orders) _data.orders=[]; _data.orders.push(order); _save(); }
  function updateOrder(id,u)     { if(!_data.orders) return; const i=_data.orders.findIndex(o=>o.id===id); if(i>-1){_data.orders[i]={..._data.orders[i],...u};_save();} }
  function removeOrder(id)       { if(!_data.orders) return; _data.orders=_data.orders.filter(o=>o.id!==id); _save(); }
  function getOrders()           { return _data.orders||[]; }

  function addSupplier(s)        { if(!_data.suppliers) _data.suppliers=[]; _data.suppliers.push(s); _save(); }
  function updateSupplier(id,u)  { if(!_data.suppliers) return; const i=_data.suppliers.findIndex(s=>s.id===id); if(i>-1){_data.suppliers[i]={..._data.suppliers[i],...u};_save();} }
  function removeSupplier(id)    { if(!_data.suppliers) return; _data.suppliers=_data.suppliers.filter(s=>s.id!==id); _save(); }
  function getSupplierRecords()  { return _data.suppliers||[]; }

  function addProductRecord(r)      { if(!_data.productRecords) _data.productRecords=[]; _data.productRecords.push(r); _save(); }
  function updateProductRecord(id,u){ if(!_data.productRecords) return; const i=_data.productRecords.findIndex(r=>r.id===id); if(i>-1){_data.productRecords[i]={..._data.productRecords[i],...u};_save();} }
  function removeProductRecord(id)  { if(!_data.productRecords) return; _data.productRecords=_data.productRecords.filter(r=>r.id!==id); _save(); }
  function getProductRecords()      { return _data.productRecords||[]; }

  function exportJSON()          { return JSON.stringify(_data, null, 2); }
  function importJSON(str)       { const p=JSON.parse(str); if(!Array.isArray(p.movements)) throw new Error('Invalid format'); _data={shipments:[],serialCosts:{},purchaseOrders:{},hubspotCompanyMap:{},...p}; _save(); }

  // ── Purchase Orders ────────────────────────────────────────────────────
  // poNumber -> { poNumber, supplier, date, lines: [{product, unitCost}] }
  function savePO(poNumber, poData) {
    if (!_data.purchaseOrders) _data.purchaseOrders = {};
    _data.purchaseOrders[poNumber] = { ...poData, poNumber };
    _save();
  }
  function getPO(poNumber)   { return (_data.purchaseOrders || {})[poNumber] || null; }
  function getAllPOs()        { return Object.values(_data.purchaseOrders || {}); }
  function getPONumbers()    { return Object.keys(_data.purchaseOrders || {}).sort(); }
  // Get locked unit cost for a product from a specific PO
  function getPOUnitCost(poNumber, product) {
    const po = getPO(poNumber);
    if (!po) return null;
    const line = (po.lines || []).find(l => l.product === product);
    return line ? line.unitCost : null;
  }
  // Store which PO a serial is linked to
  function setSerialPO(serial, poNumber) {
    if (!_data.serialPOs) _data.serialPOs = {};
    _data.serialPOs[serial.toUpperCase()] = poNumber;
    _save();
  }
  function getSerialPO(serial) { return (_data.serialPOs || {})[serial.toUpperCase()] || null; }

  function addCustomSupplier(name) {
    if (!_data.customSuppliers) _data.customSuppliers = [];
    if (!_data.customSuppliers.includes(name)) { _data.customSuppliers.push(name); _save(); }
  }
  function addCustomLocation(name) {
    if (!_data.customLocations) _data.customLocations = [];
    if (!_data.customLocations.includes(name)) { _data.customLocations.push(name); _save(); }
  }
  function getCustomSuppliers() { return _data.customSuppliers || []; }
  function getCustomLocations() { return _data.customLocations || []; }

  function addAuditRecord(record)  { if(!_data.auditRecords) _data.auditRecords=[]; _data.auditRecords.push(record); _save(); }
  function getAuditRecords()       { return _data.auditRecords || []; }

  // Paused audits — map keyed by user email, supports multiple concurrent users
  function savePausedAudit(email, state) {
    if (!_data.pausedAudits) _data.pausedAudits = {};
    _data.pausedAudits[email.toLowerCase()] = state;
    _save();
  }
  function getPausedAudit(email) {
    return (_data.pausedAudits || {})[email.toLowerCase()] || null;
  }
  function getAllPausedAudits() { return _data.pausedAudits || {}; }
  function clearPausedAudit(email) {
    if (_data.pausedAudits) { delete _data.pausedAudits[email.toLowerCase()]; _save(); }
  }

  // Pending users — ghost Firebase Auth accounts awaiting profile creation on next login
  function setPendingUser(email, name, role) {
    if (!_data.pendingUsers) _data.pendingUsers = {};
    _data.pendingUsers[email.toLowerCase()] = { name, role, createdAt: new Date().toISOString() };
    _save();
  }
  function getPendingUser(email) {
    return (_data.pendingUsers || {})[email.toLowerCase()] || null;
  }
  function removePendingUser(email) {
    if (_data.pendingUsers) { delete _data.pendingUsers[email.toLowerCase()]; _save(); }
  }

  // ── Pending Deployments ──────────────────────────────────────────────
  function addPendingDeployment(pd)   { if(!_data.pendingDeployments) _data.pendingDeployments=[]; _data.pendingDeployments.push(pd); _save(); }
  function getPendingDeployments()    { return _data.pendingDeployments || []; }
  function removePendingDeployment(id){ _data.pendingDeployments = (_data.pendingDeployments||[]).filter(p => p.id !== id); _save(); }
  function updatePendingDeployment(id, changes) {
    const idx = (_data.pendingDeployments||[]).findIndex(p => p.id === id);
    if (idx > -1) { _data.pendingDeployments[idx] = { ..._data.pendingDeployments[idx], ...changes }; _save(); }
  }


  // ── Document Uploads (Firebase Storage) ─────────────────────────────
  let _storage = null;
  async function _getStorage() {
    if (_storage) return _storage;
    const { getStorage } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js');
    const { getApps } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
    _storage = getStorage(getApps()[0]);
    return _storage;
  }

  async function uploadDocument(entityType, entityId, file) {
    const { ref, uploadBytes, getDownloadURL } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js');
    const storage = await _getStorage();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `documents/${entityType}-${entityId}/${Date.now()}_${safeName}`;
    const storageRef = ref(storage, path);
    const snap = await uploadBytes(storageRef, file);
    const url = await getDownloadURL(snap.ref);
    return { name: file.name, url, size: file.size, path, uploadedAt: new Date().toISOString() };
  }

  function addDocumentToShipment(id, docMeta) {
    const i = _data.shipments.findIndex(s => s.id === id);
    if (i > -1) {
      if (!_data.shipments[i].documents) _data.shipments[i].documents = [];
      _data.shipments[i].documents.push(docMeta);
      _save();
    }
  }

  function removeDocumentFromShipment(shipmentId, docPath) {
    const i = _data.shipments.findIndex(s => s.id === shipmentId);
    if (i > -1) {
      _data.shipments[i].documents = (_data.shipments[i].documents || []).filter(d => d.path !== docPath);
      _save();
    }
  }

  function addDocumentToOrder(id, docMeta) {
    if (!_data.orders) return;
    const i = _data.orders.findIndex(o => o.id === id);
    if (i > -1) {
      if (!_data.orders[i].documents) _data.orders[i].documents = [];
      _data.orders[i].documents.push(docMeta);
      _save();
    }
  }

  init();
  return { onReady, getData, save:_save, addMovement, setThreshold, getThreshold, addShipment, updateShipment, removeShipment, setSerialCost, getSerialCost, setProductCost, setHubspotCompanyId, getHubspotCompanyId, getHubspotCompanyMap, deleteSerial, renameSerial, updateSerialCondition, getSerialCondition, savePO, getPO, getAllPOs, getPONumbers, getPOUnitCost, setSerialPO, getSerialPO, addCustomSupplier, addCustomLocation, getCustomSuppliers, getCustomLocations, addOrder, updateOrder, removeOrder, getOrders, addSupplier, updateSupplier, removeSupplier, getSupplierRecords, addProductRecord, updateProductRecord, removeProductRecord, getProductRecords, addAuditRecord, getAuditRecords, setPendingUser, getPendingUser, removePendingUser, addPendingDeployment, getPendingDeployments, removePendingDeployment, updatePendingDeployment, savePausedAudit, getPausedAudit, getAllPausedAudits, clearPausedAudit, exportJSON, importJSON, uploadDocument, addDocumentToShipment, removeDocumentFromShipment, addDocumentToOrder };
})();

let _currentView = 'dashboard';
function _refreshView() {
  try {
    if      (_currentView==='dashboard')  UI.renderDashboard();
    else if (_currentView==='stock-list') { UI.populateStockListFilters(); UI.renderStockList(); }
    else if (_currentView==='deployed')   { UI.populateDeployedFilters(); UI.renderDeployed(); }
    else if (_currentView==='history')    UI.renderHistory();
    else if (_currentView==='transit')    UI.renderTransitList();
    else if (_currentView==='orders')     UI.renderOrderList();
    else if (_currentView==='shipment-history') UI.renderShipmentHistory();
  } catch(e) {}
}
