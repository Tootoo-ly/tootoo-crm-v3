'use strict';

const PAGE = 15;
const SK = 'tootoo_session';

let contacts = [];
let filtered = [];
let editId = null;
let page = 1;
let sortF = null;
let sortD = 1;
let token = null;
let childRowCount = 0;
let toastT = null;

// ===== SESSION =====
function loadSession() {
  try {
    const s = JSON.parse(localStorage.getItem(SK) || 'null');
    if (s && s.expires > Date.now()) { token = s.token; return true; }
    localStorage.removeItem(SK);
    return false;
  } catch(e) { return false; }
}
function saveSession(t, exp) {
  token = t;
  localStorage.setItem(SK, JSON.stringify({ token: t, expires: exp }));
}
function clearSession() { token = null; localStorage.removeItem(SK); }

// ===== INIT =====
document.addEventListener('DOMContentLoaded', async () => {
  const fl = document.getElementById('form-link');
  if (fl) fl.value = window.location.origin + '/form';

  if (loadSession()) {
    await loadContacts();
    showMain();
  }

  document.getElementById('login-email')?.addEventListener('keydown', e => { if(e.key==='Enter') doLogin(); });
  document.getElementById('login-pass')?.addEventListener('keydown',  e => { if(e.key==='Enter') doLogin(); });
  document.addEventListener('keydown', e => { if(e.key==='Escape'){closeModal();closeConfirm();} });
});

// ===== LOGIN =====
async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-pass').value;
  const err   = document.getElementById('login-error');
  err.style.display = 'none';
  if (!email || !pass) { err.textContent = 'אנא הזן מייל וסיסמה'; err.style.display = 'flex'; return; }

  const btn = document.getElementById('login-btn');
  btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader"></i> נכנס...';

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pass }),
    });
    const data = await res.json();
    if (!res.ok) {
      err.textContent = data.error === 'invalid_credentials' ? 'מייל או סיסמה שגויים' : 'שגיאה. נסה שוב.';
      err.style.display = 'flex';
    } else {
      saveSession(data.token, data.expires);
      document.getElementById('hdr-email').textContent = email;
      document.getElementById('hdr-av').textContent = email[0].toUpperCase();
      await loadContacts();
      showMain();
    }
  } catch(e) {
    err.textContent = 'שגיאת חיבור. בדוק אינטרנט.';
    err.style.display = 'flex';
  }
  btn.disabled = false; btn.innerHTML = '<i class="ti ti-login"></i> כניסה';
}

function doLogout() {
  clearSession(); contacts = []; filtered = [];
  document.getElementById('screen-main').classList.remove('active');
  document.getElementById('screen-login').classList.add('active');
  tab('dashboard');
}

function showMain() {
  document.getElementById('screen-login').classList.remove('active');
  document.getElementById('screen-main').classList.add('active');
  filter(); updateStats(); renderChart();
}

// ===== API =====
async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch('/api/' + path, opts);
  return res.json();
}

async function loadContacts() {
  try { const d = await api('GET', 'contacts'); if (d.contacts) contacts = d.contacts; }
  catch(e) { contacts = []; }
}

// ===== TABS =====
function tab(name) {
  document.querySelectorAll('.nav-tab').forEach((t,i) => {
    t.classList.toggle('active', ['dashboard','contacts','form-tab','settings'][i] === name);
  });
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-' + name)?.classList.add('active');
  if (name === 'contacts') filter();
  if (name === 'dashboard') { updateStats(); renderChart(); }
}

// ===== FILTER & SORT =====
function filter() {
  const g = id => document.getElementById(id)?.value || '';
  const fFirst = g('f-first').toLowerCase(), fLast = g('f-last').toLowerCase();
  const fGender = g('f-gender'), fStatus = g('f-status'), fRel = g('f-religion');
  const fVisa = g('f-visa'), fCity = g('f-city').toLowerCase();
  const fAgeMin = parseInt(g('f-age-min')) || 0, fAgeMax = parseInt(g('f-age-max')) || 999;

  filtered = contacts.filter(c => {
    if (fFirst && !c.firstName?.toLowerCase().includes(fFirst)) return false;
    if (fLast  && !c.lastName?.toLowerCase().includes(fLast))  return false;
    if (fGender && c.gender !== fGender) return false;
    if (fStatus && c.status !== fStatus) return false;
    if (fRel    && c.religion !== fRel)  return false;
    if (fVisa   && c.visa !== fVisa)     return false;
    if (fCity   && !c.city?.toLowerCase().includes(fCity)) return false;
    if ((c.age||0) < fAgeMin || (c.age||0) > fAgeMax) return false;
    return true;
  });

  if (sortF) {
    filtered.sort((a,b) => {
      const av = a[sortF]||'', bv = b[sortF]||'';
      return typeof av === 'number' ? (av-bv)*sortD : String(av).localeCompare(String(bv),'he')*sortD;
    });
  }

  page = 1; renderTable();
  const fi = document.getElementById('filter-info');
  if (fi) fi.textContent = filtered.length === contacts.length ? `${contacts.length} אנשי קשר` : `מציג ${filtered.length} מתוך ${contacts.length}`;
  const cb = document.getElementById('count-badge');
  if (cb) cb.textContent = contacts.length;
}

function sortBy(f) { sortD = sortF === f ? -sortD : 1; sortF = f; filter(); }

function clearFilter() {
  ['f-first','f-last','f-gender','f-status','f-religion','f-visa','f-city','f-age-min','f-age-max']
    .forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
  filter();
}

// ===== TABLE =====
const VB = { 'אזרח':'badge-green','תושב קבע':'badge-blue','Citizen':'badge-green','Permanent Resident':'badge-blue','Tourist Visa':'badge-purple','Work Visa':'badge-amber','Student Visa':'badge-blue','פגת תוקף':'badge-red' };

function renderTable() {
  const tbody = document.getElementById('contacts-tbody');
  if (!tbody) return;
  const slice = filtered.slice((page-1)*PAGE, page*PAGE);
  if (!slice.length) {
    tbody.innerHTML = '<tr><td colspan="13" style="text-align:center;color:var(--txt2);padding:2rem">אין תוצאות</td></tr>';
  } else {
    tbody.innerHTML = slice.map(c => {
      const children = Array.isArray(c.children) && c.children.length
        ? c.children.map(ch => `${esc(ch.name)} (${ch.age||0})`).join(', ')
        : c.hasChildren === true ? 'כן' : c.hasChildren === false ? 'לא' : '-';
      const bd = c.birthdate ? new Date(c.birthdate).toLocaleDateString('he-IL') : '-';
      return `<tr>
        <td style="font-weight:500">${esc(c.firstName)}</td>
        <td>${esc(c.lastName)}</td>
        <td><span class="badge ${c.gender==='זכר'||c.gender==='Male'?'badge-blue':'badge-purple'}">${esc(c.gender||'-')}</span></td>
        <td>${esc(c.status||'-')}</td>
        <td>${esc(c.religion||'-')}</td>
        <td style="font-size:12px;direction:ltr;text-align:right">${esc(c.email||'-')}</td>
        <td style="font-size:12px">${esc(c.address||'-')}</td>
        <td>${esc(c.city||'-')}</td>
        <td style="font-size:12px">${bd}</td>
        <td style="text-align:center;font-weight:500">${c.age||'-'}</td>
        <td><span class="badge ${VB[c.visa]||'badge-amber'}">${esc(c.visa||'-')}</span></td>
        <td style="font-size:12px">${children}</td>
        <td><div style="display:flex;gap:4px">
          <button class="btn btn-sm" onclick="editContact(${c.id})"><i class="ti ti-edit"></i></button>
          <button class="btn btn-sm btn-danger" onclick="delContact(${c.id})"><i class="ti ti-trash"></i></button>
        </div></td>
      </tr>`;
    }).join('');
  }
  renderPagination();
}

function renderPagination() {
  const total = Math.ceil(filtered.length / PAGE);
  const pag = document.getElementById('pagination');
  if (!pag || total <= 1) { if(pag) pag.innerHTML = ''; return; }
  let html = '';
  if (page > 1) html += `<button class="page-btn" onclick="goPage(${page-1})"><i class="ti ti-chevron-right"></i></button>`;
  for (let i=1;i<=total;i++) html += `<button class="page-btn ${i===page?'active':''}" onclick="goPage(${i})">${i}</button>`;
  if (page < total) html += `<button class="page-btn" onclick="goPage(${page+1})"><i class="ti ti-chevron-left"></i></button>`;
  pag.innerHTML = html;
}
function goPage(p) { page = p; renderTable(); }

// ===== STATS =====
function updateStats() {
  if (!document.getElementById('st-total')) return;
  document.getElementById('st-total').textContent  = contacts.length;
  document.getElementById('st-visa-ok').textContent  = contacts.filter(c => c.visa && !['פגת תוקף'].includes(c.visa)).length;
  document.getElementById('st-visa-exp').textContent = contacts.filter(c => c.visa === 'פגת תוקף').length;
  const week = Date.now() - 7*86400000;
  document.getElementById('st-week').textContent = contacts.filter(c => c.createdAt > week).length;
  const cb = document.getElementById('count-badge'); if(cb) cb.textContent = contacts.length;
}

function renderChart() {
  const wrap = document.getElementById('visa-chart'); if (!wrap) return;
  const counts = {}; contacts.forEach(c => { if(c.visa) counts[c.visa] = (counts[c.visa]||0)+1; });
  const total = contacts.length || 1;
  const cols = {'אזרח':'var(--green)','תושב קבע':'var(--blue)','Citizen':'var(--green)','Permanent Resident':'var(--blue)','Tourist Visa':'var(--purple)','Work Visa':'var(--amber)','Student Visa':'#378ADD','פגת תוקף':'var(--red)'};
  wrap.innerHTML = Object.entries(counts).sort((a,b)=>b[1]-a[1]).map(([k,v]) => `
    <div style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px"><span>${k}</span><span style="color:var(--txt2)">${v} (${Math.round(v/total*100)}%)</span></div>
      <div style="height:6px;background:var(--bg2);border-radius:99px;overflow:hidden"><div style="height:100%;width:${Math.round(v/total*100)}%;background:${cols[k]||'var(--blue)'};border-radius:99px"></div></div>
    </div>`).join('');
}

// ===== AGE CALC =====
function calcAge() {
  const bd = document.getElementById('m-birthdate')?.value;
  const el = document.getElementById('m-age');
  if (bd && el) el.value = age(bd);
}
function age(d) {
  if (!d) return 0;
  const t = new Date(), b = new Date(d);
  let a = t.getFullYear() - b.getFullYear();
  const m = t.getMonth() - b.getMonth();
  if (m < 0 || (m===0 && t.getDate() < b.getDate())) a--;
  return a < 0 ? 0 : a;
}

// ===== CHILDREN ROWS =====
function addChildRow(name='', dob='') {
  childRowCount++;
  const id = childRowCount;
  const div = document.createElement('div');
  div.id = 'cr-' + id;
  div.style.cssText = 'display:grid;grid-template-columns:1fr 1fr auto;gap:8px;align-items:end;padding:8px;background:var(--bg2);border-radius:6px';
  div.innerHTML = `
    <div class="form-row" style="margin:0"><label style="font-size:11px">שם הילד</label><input id="cn-${id}" value="${esc(name)}" placeholder="שם מלא" /></div>
    <div class="form-row" style="margin:0"><label style="font-size:11px">תאריך לידה</label><input type="date" id="cd-${id}" value="${dob}" /></div>
    <button type="button" class="btn btn-sm btn-danger" style="margin-bottom:1px" onclick="document.getElementById('cr-${id}').remove()"><i class="ti ti-x"></i></button>`;
  document.getElementById('children-wrap').appendChild(div);
}

function getChildren() {
  const kids = [];
  document.querySelectorAll('[id^="cr-"]').forEach(row => {
    const id = row.id.replace('cr-','');
    const name = document.getElementById('cn-'+id)?.value.trim();
    const dob  = document.getElementById('cd-'+id)?.value || '';
    if (name) kids.push({ name, birthdate: dob, age: age(dob) });
  });
  return kids;
}

// ===== MODAL =====
function openModal(id=null) {
  editId = id;
  document.getElementById('modal-title').textContent = id ? 'ערוך איש קשר' : 'הוסף איש קשר';
  document.getElementById('modal-error').style.display = 'none';
  document.getElementById('children-wrap').innerHTML = '';
  childRowCount = 0;

  const fields = ['first','last','gender','status','religion','email','address','city','age','visa'];
  if (id) {
    const c = contacts.find(x => x.id === id);
    if (c) {
      const map = { first:'firstName', last:'lastName' };
      fields.forEach(f => { const el = document.getElementById('m-'+f); if(el) el.value = c[map[f]||f] || ''; });
      const bd = document.getElementById('m-birthdate'); if(bd) bd.value = c.birthdate || '';
      if (Array.isArray(c.children)) c.children.forEach(ch => addChildRow(ch.name, ch.birthdate));
    }
  } else {
    fields.forEach(f => { const el = document.getElementById('m-'+f); if(el) el.value = ''; });
    const bd = document.getElementById('m-birthdate'); if(bd) bd.value = '';
  }
  document.getElementById('modal').classList.add('open');
  document.getElementById('m-first')?.focus();
}

function editContact(id) { openModal(id); }
function closeModal() { document.getElementById('modal').classList.remove('open'); editId = null; }

async function saveContact() {
  const first = document.getElementById('m-first').value.trim();
  const last  = document.getElementById('m-last').value.trim();
  const err   = document.getElementById('modal-error');
  if (!first || !last) { err.textContent = 'שם פרטי ושם משפחה הם שדות חובה'; err.style.display = 'flex'; return; }
  err.style.display = 'none';

  const bd = document.getElementById('m-birthdate').value;
  const data = {
    firstName: first, lastName: last,
    gender:   document.getElementById('m-gender').value,
    status:   document.getElementById('m-status').value,
    religion: document.getElementById('m-religion').value,
    email:    document.getElementById('m-email').value.trim(),
    address:  document.getElementById('m-address').value.trim(),
    city:     document.getElementById('m-city').value.trim(),
    birthdate: bd, age: age(bd),
    visa:     document.getElementById('m-visa').value,
    children: getChildren(),
    hasChildren: getChildren().length > 0,
  };

  try {
    if (editId) {
      await api('PUT', 'contacts', { ...data, id: editId });
      const i = contacts.findIndex(c => c.id === editId);
      if (i >= 0) contacts[i] = { ...contacts[i], ...data };
      toast('איש הקשר עודכן');
    } else {
      const res = await api('POST', 'contacts', data);
      if (res.contact) contacts.push(res.contact);
      toast('איש קשר נוסף בהצלחה');
    }
  } catch(e) { toast('שגיאה בשמירה', 'error'); }

  closeModal(); filter(); updateStats(); renderChart();
}

async function delContact(id) {
  confirm2('מחיקת איש קשר', 'האם אתה בטוח?', async () => {
    try {
      await api('DELETE', 'contacts', { id });
      contacts = contacts.filter(c => c.id !== id);
      filter(); updateStats(); renderChart();
      toast('איש הקשר נמחק');
    } catch(e) { toast('שגיאה במחיקה', 'error'); }
  });
}

// ===== CONFIRM =====
function confirm2(title, msg, onOk) {
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-msg').textContent = msg;
  document.getElementById('confirm-ok').onclick = () => { onOk(); closeConfirm(); };
  document.getElementById('confirm-modal').classList.add('open');
}
function closeConfirm() { document.getElementById('confirm-modal').classList.remove('open'); }

// ===== EXPORT =====
function exportPDF() {
  if (!window.jspdf) { toast('ספריית PDF לא נטענה', 'error'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  doc.setFont('helvetica','bold'); doc.setFontSize(18); doc.setTextColor(24,95,165);
  doc.text('Tootoo CRM', 148, 14, { align: 'center' });
  doc.setFont('helvetica','normal'); doc.setFontSize(10); doc.setTextColor(100);
  doc.text(`Report | ${new Date().toLocaleDateString('he-IL')} | ${filtered.length} contacts`, 148, 21, { align: 'center' });
  doc.setDrawColor(200); doc.line(10,24,287,24);
  let y = 32;
  const cols = [
    {l:'First',k:'firstName',w:22},{l:'Last',k:'lastName',w:22},{l:'Gender',k:'gender',w:14},
    {l:'Status',k:'status',w:18},{l:'Religion',k:'religion',w:14},{l:'Email',k:'email',w:48},
    {l:'City',k:'city',w:22},{l:'Birthdate',k:'birthdate',w:22},{l:'Age',k:'age',w:10},{l:'Visa',k:'visa',w:26}
  ];
  const sx = 10;
  doc.setFillColor(24,95,165); doc.rect(sx,y-5,277,9,'F');
  doc.setTextColor(255,255,255); doc.setFontSize(8.5); doc.setFont('helvetica','bold');
  let cx = sx+2; cols.forEach(c => { doc.text(c.l,cx,y); cx+=c.w; });
  doc.setFont('helvetica','normal'); doc.setFontSize(8);
  filtered.forEach((c,ri) => {
    y += 8; if(y>195){doc.addPage();y=20;}
    if(ri%2===0){doc.setFillColor(237,244,254);doc.rect(sx,y-5,277,8,'F');}
    doc.setTextColor(30,30,28); cx=sx+2;
    cols.forEach(col => {
      let v = String(c[col.k]||'');
      if (col.k==='birthdate' && v) v = new Date(v).toLocaleDateString('he-IL');
      const max = Math.floor(col.w/1.8);
      doc.text(v.length>max?v.slice(0,max)+'…':v, cx, y); cx+=col.w;
    });
  });
  doc.save(`tootoo_${new Date().toISOString().slice(0,10)}.pdf`);
  toast('PDF הורד!');
}

function exportJSON() {
  const blob = new Blob([JSON.stringify(contacts,null,2)],{type:'application/json'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `tootoo_backup_${new Date().toISOString().slice(0,10)}.json`; a.click();
  toast('JSON הורד!');
}

function copyLink() {
  const v = document.getElementById('form-link')?.value;
  if (v) navigator.clipboard?.writeText(v).then(() => toast('הקישור הועתק!'));
}

// ===== TOAST =====
function toast(msg, type='success') {
  const t = document.getElementById('toast');
  t.style.background = type==='error' ? 'var(--red-bg)' : 'var(--green-bg)';
  t.style.color = type==='error' ? 'var(--red)' : 'var(--green-txt)';
  t.innerHTML = `<i class="ti ti-${type==='error'?'alert-circle':'check'}"></i> ${msg}`;
  t.style.display = 'flex';
  clearTimeout(toastT); toastT = setTimeout(() => t.style.display='none', 3000);
}

function esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
