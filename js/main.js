const DBKEY='advance_crm_v3';
const SESSION_KEY='advance_crm_session_v1';

function computeDefaultPassword(fullName){
  let parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  if(parts.length === 0) return 'ad1234';
  if(parts.length === 1 && parts[0].toLowerCase() === 'administrador') return 'ad1234';
  let first = parts[0][0].toLowerCase();
  let last = parts.length > 1 ? parts[parts.length - 1][0].toLowerCase() : parts[0][0].toLowerCase();
  return first + last + '1234';
}

function getInitials(fullName){
  let parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  if(parts.length === 0) return 'U';
  if(parts.length === 1) return parts[0].slice(0,2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const defaultAdminUser = () => ({
  id: 'US0001',
  name: 'Administrador',
  username: 'admin',
  password: computeDefaultPassword('Administrador'),
  role: 'admin',
  active: true,
  mustChangePassword: true,
  avatar: ''
});

const emptyDB=()=>({opportunities:[],petronect:[],companies:[],contacts:[],activities:[],licitacoes:[],portals:[],portalHistory:[],users:[defaultAdminUser()]});
let db=loadDB(),page='dashboard',modalSaveFn=null,dashDueFilter='all',currentUser=null;

function loadDB(){
  try{
    let parsed = JSON.parse(localStorage.getItem(DBKEY)||'{}');
    let merged = {...emptyDB(), ...parsed};
    if(!Array.isArray(merged.users) || merged.users.length === 0){
      merged.users = [defaultAdminUser()];
    }
    return merged;
  }catch(e){
    return emptyDB();
  }
}
function saveDB(){
  localStorage.setItem(DBKEY,JSON.stringify(db));
  updateNotifications();
}

const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today=()=>new Date().toISOString().slice(0,10);
const fmtDate=d=>d?new Date(d+'T12:00:00').toLocaleDateString('pt-BR'):'—';
const money=v=>v?Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):'—';

function daysDiffFromToday(dateStr){
  if(!dateStr) return null;
  let d1 = new Date(today() + 'T12:00:00');
  let d2 = new Date(dateStr + 'T12:00:00');
  return Math.round((d2 - d1) / 86400000);
}

/* ==================== CONTROLE DO MENU LATERAL (DESKTOP & MOBILE) ==================== */
function toggleSidebar(){
  let isMobile = window.innerWidth <= 900;
  let sb = $('#sidebar');
  let bd = $('#sidebarBackdrop');
  if(isMobile){
    let opening = !sb.classList.contains('mobile-open');
    sb.classList.toggle('mobile-open', opening);
    if(bd) bd.classList.toggle('show', opening);
  } else {
    document.body.classList.toggle('sidebar-collapsed');
    localStorage.setItem('advance_sidebar_collapsed', document.body.classList.contains('sidebar-collapsed') ? '1' : '0');
  }
}

function closeMobileSidebar(){
  let sb = $('#sidebar');
  let bd = $('#sidebarBackdrop');
  if(sb) sb.classList.remove('mobile-open');
  if(bd) bd.classList.remove('show');
}

if(localStorage.getItem('advance_sidebar_collapsed') === '1' && window.innerWidth > 900){
  document.body.classList.add('sidebar-collapsed');
}

/* ==================== CENTRAL DE NOTIFICAÇÕES (SININHO) & BUSCA GLOBAL ==================== */
function getAlertItems(){
  let alerts = [];
  let td = today();

  (db.opportunities || []).filter(o => o.nextDate && !o.done && !['Perdido','Cliente ativo'].includes(o.status) && o.nextDate <= td).forEach(o => {
    alerts.push({
      kind: 'opp', id: o.id,
      title: o.company || 'Oportunidade',
      sub: (o.nextDate < td ? '⚠️ Follow-up atrasado: ' : '📅 Follow-up hoje: ') + (o.nextAction || 'Contatar'),
      date: o.nextDate,
      urgent: o.nextDate < td
    });
  });

  (db.petronect || []).filter(p => p.closingDate && !['Declinada','Ganha','Perdida','Encerrada'].includes(p.status)).forEach(p => {
    let diff = daysDiffFromToday(p.closingDate);
    if(diff !== null && diff <= 2){
      alerts.push({
        kind: 'petronect', id: p.id,
        title: 'Petronect: ' + p.opportunity,
        sub: diff < 0 ? '⚠️ Edital vencido' : (diff === 0 ? '🔥 Encerra HOJE!' : `⏳ Encerra em ${diff} dia(s)`),
        date: p.closingDate,
        urgent: diff <= 0
      });
    }
  });

  (db.portals || []).filter(pt => pt.expiryDate && pt.status !== 'Inativo').forEach(pt => {
    let diff = daysDiffFromToday(pt.expiryDate);
    if(diff !== null && diff <= 30){
      alerts.push({
        kind: 'portal', id: pt.id,
        title: 'Portal: ' + pt.name,
        sub: diff < 0 ? '🚫 Cadastro/Certidão VENCIDA' : `⚠️ Vence em ${diff} dia(s)`,
        date: pt.expiryDate,
        urgent: diff < 0
      });
    }
  });

  (db.activities || []).filter(a => !a.done && a.nextDate && a.nextDate <= td).forEach(a => {
    alerts.push({
      kind: 'act', id: a.id,
      title: a.title || a.summary || a.type,
      sub: (a.nextDate < td ? '⚠️ Tarefa atrasada' : '📌 Tarefa vence hoje') + (a.company && a.company !== 'Geral / Interno' ? ' · ' + a.company : ''),
      date: a.nextDate,
      urgent: a.nextDate < td
    });
  });

  return alerts.sort((a,b) => (a.date || '').localeCompare(b.date || ''));
}

function updateNotifications(){
  let items = getAlertItems();
  let badge = $('#notifBadge');
  let countTxt = $('#notifCountText');
  let listEl = $('#notifList');
  if(!badge || !listEl) return;

  if(items.length > 0){
    badge.textContent = items.length > 99 ? '99+' : items.length;
    badge.classList.remove('hide');
  } else {
    badge.classList.add('hide');
  }
  if(countTxt) countTxt.textContent = `${items.length} alerta(s)`;

  if(!items.length){
    listEl.innerHTML = `<div style="padding:20px;text-align:center;color:var(--muted);font-size:12px;">Tudo em dia! Nenhum alerta urgente.</div>`;
    return;
  }

  listEl.innerHTML = items.map(it => {
    let fn = it.kind === 'opp' ? `openOpportunity('${it.id}')` :
             it.kind === 'petronect' ? `openPetronectModal('${it.id}')` :
             it.kind === 'portal' ? `openPortalModal('${it.id}')` : `editActivity('${it.id}')`;
    return `
      <div class="notif-item" onclick="closeNotifDropdown(); ${fn}">
        <div style="display:flex;justify-content:space-between;gap:6px;align-items:center;">
          <b style="color:${it.urgent ? 'var(--red)' : 'var(--text)'};">${esc(it.title)}</b>
          <span class="muted" style="font-size:10px;white-space:nowrap;">${fmtDate(it.date)}</span>
        </div>
        <div class="muted" style="font-size:11px;margin-top:2px;">${esc(it.sub)}</div>
      </div>
    `;
  }).join('');
}

function toggleNotifDropdown(){
  let dd = $('#notifDropdown');
  if(dd){
    updateNotifications();
    dd.classList.toggle('open');
  }
}
function closeNotifDropdown(){
  let dd = $('#notifDropdown');
  if(dd) dd.classList.remove('open');
}

function openGlobalSearchModal(){
  openModal('🔍 Busca Rápida Global', `
    <div style="display:flex;flex-direction:column;gap:12px;">
      <input type="text" id="globalSearchInput" placeholder="Digite empresa, CNPJ, edital Petronect, portal, contato ou tarefa..." oninput="runGlobalSearch(this.value)" style="padding:11px 13px;border:2px solid var(--green);border-radius:10px;font-size:14px;background:var(--surface);color:var(--text);outline:none;">
      <div id="globalSearchResults" style="max-height:360px;overflow-y:auto;"></div>
    </div>
  `, () => closeModal(), `<button class="btn" onclick="closeModal()">Fechar (Esc)</button>`, true);
  setTimeout(() => {
    let inp = $('#globalSearchInput');
    if(inp){ inp.focus(); runGlobalSearch(''); }
  }, 60);
}

function runGlobalSearch(qRaw){
  let q = String(qRaw || '').trim().toLowerCase();
  let resEl = $('#globalSearchResults');
  if(!resEl) return;

  if(!q){
    resEl.innerHTML = `<div class="empty" style="padding:20px;font-size:12px;">Digite qualquer termo para buscar instantaneamente em todas as bases do sistema.</div>`;
    return;
  }

  let results = [];
  (db.opportunities || []).forEach(o => {
    if([o.id, o.company, o.cnpj, o.process, o.source, o.city].join(' ').toLowerCase().includes(q)){
      results.push({ type: 'Oportunidade', pill: 'blue', title: o.company, sub: `${o.id} · ${o.status} · ${o.cnpj || ''}`, action: `closeModal(); openOpportunity('${o.id}')` });
    }
  });
  (db.petronect || []).forEach(p => {
    if([p.id, p.opportunity, p.city, p.status].join(' ').toLowerCase().includes(q)){
      results.push({ type: 'Petronect', pill: 'purple', title: p.opportunity, sub: `${p.id} · ${p.status} · Encerra: ${fmtDate(p.closingDate)}`, action: `closeModal(); openPetronectModal('${p.id}')` });
    }
  });
  (db.portals || []).forEach(pt => {
    if([pt.id, pt.name, pt.company, pt.cnpj, pt.login].join(' ').toLowerCase().includes(q)){
      results.push({ type: 'Portal', pill: 'green', title: pt.name, sub: `${pt.id} · ${pt.company || ''} · Status: ${pt.status}`, action: `closeModal(); openPortalModal('${pt.id}')` });
    }
  });
  (db.companies || []).forEach(c => {
    if([c.id, c.name, c.trade, c.cnpj, c.city].join(' ').toLowerCase().includes(q)){
      results.push({ type: 'Empresa', pill: '', title: c.name, sub: `${c.id} · ${c.cnpj || ''} · ${c.city || ''}`, action: `closeModal(); openCompany('${c.id}')` });
    }
  });
  (db.contacts || []).forEach(ct => {
    if([ct.id, ct.name, ct.company, ct.email, ct.phone].join(' ').toLowerCase().includes(q)){
      results.push({ type: 'Contato', pill: '', title: ct.name, sub: `${ct.company || ''} · ${ct.email || ct.phone || ''}`, action: `closeModal(); openContact('${ct.id}')` });
    }
  });
  (db.activities || []).forEach(a => {
    if([a.id, a.title, a.company, a.summary].join(' ').toLowerCase().includes(q)){
      results.push({ type: 'Tarefa / Atividade', pill: 'amber', title: a.title || a.summary || a.type, sub: `${a.company || 'Geral'} · ${fmtDate(a.date)}`, action: `closeModal(); editActivity('${a.id}')` });
    }
  });

  if(!results.length){
    resEl.innerHTML = `<div class="empty" style="padding:20px;font-size:12px;">Nenhum registro encontrado para "<b>${esc(qRaw)}</b>".</div>`;
    return;
  }

  resEl.innerHTML = results.slice(0, 25).map(r => `
    <div class="gsearch-item" onclick="${r.action}">
      <div style="min-width:0;">
        <b style="display:block;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(r.title)}</b>
        <small class="muted">${esc(r.sub)}</small>
      </div>
      <span class="pill ${r.pill}">${esc(r.type)}</span>
    </div>
  `).join('');
}

document.addEventListener('keydown', e => {
  if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k'){
    if(currentUser){
      e.preventDefault();
      openGlobalSearchModal();
    }
  } else if(e.key === 'Escape'){
    closeNotifDropdown();
    closeUserMenu();
    if(!modalLocked && $('#modalBack')?.classList.contains('show')) closeModal();
  }
});

/* ==================== IDENTIDADE DINÂMICA NA TELA DE LOGIN ==================== */
function updateLoginIdentityPreview(usernameVal){
  let uClean = String(usernameVal || '').trim().toLowerCase();
  let avatarEl = $('#loginAvatarPreview');
  let titleEl = $('#loginTitlePreview');
  let subEl = $('#loginSubtitlePreview');
  if(!avatarEl || !titleEl || !subEl) return;

  if(!uClean){
    avatarEl.innerHTML = 'A';
    titleEl.textContent = 'ADVANCE TINTAS';
    subEl.textContent = 'Advance CRM · Acesso Restrito';
    return;
  }

  let matched = (db.users || []).find(u => u.username.toLowerCase() === uClean);
  if(matched){
    titleEl.textContent = matched.name;
    subEl.textContent = matched.role === 'admin' ? 'Advance Tintas · Administrador' : 'Advance Tintas · Comercial';
    if(matched.avatar){
      avatarEl.innerHTML = `<img src="${matched.avatar}" alt="${esc(matched.name)}">`;
    } else {
      avatarEl.textContent = getInitials(matched.name);
    }
  } else {
    avatarEl.innerHTML = 'A';
    titleEl.textContent = 'ADVANCE TINTAS';
    subEl.textContent = 'Advance CRM · Acesso Restrito';
  }
}

/* ==================== AUTENTICAÇÃO, SESSÃO E PERMISSÕES ==================== */
function isAdmin(){ return currentUser && currentUser.role === 'admin'; }

function updateTopbarUser(){
  if(!currentUser) return;
  let av = $('#topUserAvatar');
  if(av){
    if(currentUser.avatar){
      av.innerHTML = `<img src="${currentUser.avatar}" alt="Avatar">`;
    } else {
      av.textContent = getInitials(currentUser.name);
    }
  }
  if($('#topUserName')) $('#topUserName').textContent = currentUser.name;
  if($('#dropUserName')) $('#dropUserName').textContent = currentUser.name;
  if($('#dropUserRole')) $('#dropUserRole').textContent = currentUser.role === 'admin' ? 'Administrador Geral' : 'Usuário Comercial';
}

function toggleUserMenu(){
  let dd = $('#userDropdown');
  if(dd) dd.classList.toggle('open');
}
function closeUserMenu(){
  let dd = $('#userDropdown');
  if(dd) dd.classList.remove('open');
}
document.addEventListener('click', e => {
  if(!e.target.closest('#userMenuWrap')) closeUserMenu();
  if(!e.target.closest('#notifWrap')) closeNotifDropdown();
});

function checkExistingSession(){
  let savedId = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
  if(savedId){
    let found = (db.users || []).find(u => u.id === savedId);
    if(found && found.active){
      currentUser = found;
      enterApp();
      return;
    }
  }
  $('#loginScreen').style.display = 'flex';
  $('#appContainer').style.display = 'none';
}

function enterApp(){
  $('#loginScreen').style.display = 'none';
  $('#appContainer').style.display = 'block';
  updateTopbarUser();
  updateNotifications();
  render();
  if(currentUser.mustChangePassword){
    setTimeout(() => openChangePasswordModal(true), 120);
  }
}

$('#loginForm').onsubmit = e => {
  e.preventDefault();
  let uInput = $('#loginUser').value.trim().toLowerCase();
  let pInput = $('#loginPass').value;
  let remember = $('#loginRemember').checked;
  let errEl = $('#loginError');

  let found = (db.users || []).find(u => u.username.toLowerCase() === uInput && u.password === pInput);
  if(!found){
    errEl.textContent = 'Usuário ou senha incorretos.';
    errEl.style.display = 'block';
    return;
  }
  if(!found.active){
    errEl.textContent = 'Este usuário está INATIVO. Contate o administrador.';
    errEl.style.display = 'block';
    return;
  }

  errEl.style.display = 'none';
  currentUser = found;
  if(remember){
    localStorage.setItem(SESSION_KEY, found.id);
    sessionStorage.removeItem(SESSION_KEY);
  } else {
    sessionStorage.setItem(SESSION_KEY, found.id);
    localStorage.removeItem(SESSION_KEY);
  }
  $('#loginPass').value = '';
  enterApp();
};

function logoutUser(){
  closeUserMenu();
  closeMobileSidebar();
  currentUser = null;
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
  $('#appContainer').style.display = 'none';
  $('#loginScreen').style.display = 'flex';
  $('#loginUser').value = '';
  $('#loginPass').value = '';
  updateLoginIdentityPreview('');
}

function openChangePasswordModal(forced = false){
  if(!currentUser) return;
  let defaultPass = computeDefaultPassword(currentUser.name);
  let footHtml = forced
    ? `<button class="btn primary" id="modalSaveBtn" style="width:100%;justify-content:center;">Salvar Nova Senha e Continuar</button>`
    : `<button class="btn" onclick="closeModal()">Cancelar</button><button class="btn primary" id="modalSaveBtn">Atualizar Senha</button>`;

  openModal(forced ? '🔐 Primeiro Acesso: Troca Obrigatória de Senha' : '🔑 Alterar Minha Senha', `
    <div style="display:flex;flex-direction:column;gap:13px;">
      ${forced ? `<div class="notice warn" style="margin:0;">Por segurança, você precisa definir uma senha pessoal no seu primeiro acesso (diferente da senha padrão <b>${esc(defaultPass)}</b>).</div>` : ''}
      <div class="field">
        <label>Nova Senha *</label>
        <div style="display:flex;gap:6px;">
          <input type="password" id="cp_new" placeholder="Mínimo 4 caracteres" style="flex:1;">
          <button type="button" class="btn small" onclick="togglePasswordVis('cp_new')">👁️</button>
        </div>
      </div>
      <div class="field">
        <label>Confirmar Nova Senha *</label>
        <div style="display:flex;gap:6px;">
          <input type="password" id="cp_confirm" placeholder="Repita a nova senha" style="flex:1;">
          <button type="button" class="btn small" onclick="togglePasswordVis('cp_confirm')">👁️</button>
        </div>
      </div>
    </div>
  `, () => {
    let n1 = $('#cp_new').value.trim();
    let n2 = $('#cp_confirm').value.trim();
    if(n1.length < 4){ alert('A nova senha deve ter pelo menos 4 caracteres.'); return; }
    if(n1 !== n2){ alert('As senhas digitadas não coincidem.'); return; }
    if(forced && n1 === defaultPass){ alert('Escolha uma senha diferente da senha padrão inicial.'); return; }

    let uObj = db.users.find(u => u.id === currentUser.id);
    if(uObj){
      uObj.password = n1;
      uObj.mustChangePassword = false;
      currentUser = uObj;
      saveDB();
    }
    closeModal(true);
    alert('Senha atualizada com sucesso!');
  }, footHtml, true, forced);
}

function openAvatarModal(){
  if(!currentUser) return;
  openModal('📷 Alterar Foto / Avatar', `
    <div style="display:flex;flex-direction:column;align-items:center;gap:14px;padding:10px 0;">
      <div id="avatarPreviewBox" style="width:92px;height:92px;border-radius:50%;background:#e2f1eb;color:#18734f;display:grid;place-items:center;font-size:32px;font-weight:800;border:3px solid var(--green);overflow:hidden;">
        ${currentUser.avatar ? `<img src="${currentUser.avatar}" style="width:100%;height:100%;object-fit:cover;">` : getInitials(currentUser.name)}
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;">
        <button type="button" class="btn primary" onclick="$('#avatarFileInput').click()">📁 Escolher Imagem</button>
        ${currentUser.avatar ? `<button type="button" class="btn danger" onclick="removeUserAvatar()">🗑️ Remover Foto (Usar Iniciais)</button>` : ''}
      </div>
      <small class="muted" style="text-align:center;">A imagem é redimensionada automaticamente e salva no seu perfil.</small>
    </div>
  `, () => { closeModal(); }, `<button class="btn primary" onclick="closeModal()">Concluir</button>`, true);
}

$('#avatarFileInput').onchange = e => {
  let file = e.target.files[0];
  if(!file) return;
  let reader = new FileReader();
  reader.onload = ev => {
    let img = new Image();
    img.onload = () => {
      let canvas = document.createElement('canvas');
      let size = 160;
      canvas.width = size;
      canvas.height = size;
      let ctx = canvas.getContext('2d');
      let minSide = Math.min(img.width, img.height);
      let sx = (img.width - minSide) / 2;
      let sy = (img.height - minSide) / 2;
      ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
      let dataUrl = canvas.toDataURL('image/jpeg', 0.82);

      let uObj = db.users.find(u => u.id === currentUser.id);
      if(uObj){
        uObj.avatar = dataUrl;
        currentUser = uObj;
        saveDB();
        updateTopbarUser();
        let prev = $('#avatarPreviewBox');
        if(prev) prev.innerHTML = `<img src="${dataUrl}" style="width:100%;height:100%;object-fit:cover;">`;
      }
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
  e.target.value = '';
};

function removeUserAvatar(){
  let uObj = db.users.find(u => u.id === currentUser.id);
  if(uObj){
    uObj.avatar = '';
    currentUser = uObj;
    saveDB();
    updateTopbarUser();
    closeModal();
  }
}

function requireAdminAuth(actionLabel, onAuthorized){
  let adminUsers = (db.users || []).filter(u => u.role === 'admin' && u.active);
  if(adminUsers.length === 0){
    onAuthorized();
    return;
  }
  openModal('🛡️ Autorização do Administrador', `
    <div style="display:flex;flex-direction:column;gap:12px;">
      <p style="margin:0;font-size:13px;">Para <b>${esc(actionLabel)}</b>, informe a senha do Administrador:</p>
      <div class="field">
        <label>Senha do Administrador *</label>
        <div style="display:flex;gap:6px;">
          <input type="password" id="adm_confirm_pass" placeholder="Digite a senha do admin" style="flex:1;">
          <button type="button" class="btn small" onclick="togglePasswordVis('adm_confirm_pass')">👁️</button>
        </div>
      </div>
    </div>
  `, () => {
    let pass = $('#adm_confirm_pass')?.value || '';
    let valid = adminUsers.some(a => a.password === pass);
    if(!valid){
      alert('Senha de administrador incorreta. Ação bloqueada.');
      return;
    }
    closeModal();
    onAuthorized();
  }, `<button class="btn" onclick="closeModal()">Cancelar</button><button class="btn danger" id="modalSaveBtn">Confirmar Exclusão / Ação</button>`, true);
  setTimeout(() => { if($('#adm_confirm_pass')) $('#adm_confirm_pass').focus(); }, 80);
}
/* ========================================================================== */

function copyText(txt, label='Texto'){
  if(!txt){ alert('Nada para copiar.'); return; }
  navigator.clipboard.writeText(txt).then(()=>{
    alert(label + ' copiado para a área de transferência!');
  }).catch(()=>{
    prompt('Copie manualmente:', txt);
  });
}

function toggleTheme(){
  let current = document.body.getAttribute('data-theme');
  let next = current === 'dark' ? 'light' : 'dark';
  document.body.setAttribute('data-theme', next);
  localStorage.setItem('advance_theme', next);
}
let savedTheme = localStorage.getItem('advance_theme') || 'light';
document.body.setAttribute('data-theme', savedTheme);

function exportToOutlook(title, date, desc, location='Portal Petronect'){
  if(!date){ alert('Nenhuma data definida para exportação.'); return; }
  let dStart = date.replace(/-/g, '') + 'T120000Z';
  let dEnd = date.replace(/-/g, '') + 'T130000Z';
  let icsContent = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Advance CRM//PT\nBEGIN:VEVENT\nSUMMARY:" + title + "\nDESCRIPTION:" + desc + "\nLOCATION:" + location + "\nDTSTART:" + dStart + "\nDTEND:" + dEnd + "\nEND:VEVENT\nEND:VCALENDAR";
  let blob = new Blob([icsContent], {type: 'text/calendar;charset=utf-8'});
  let url = URL.createObjectURL(blob);
  let a = document.createElement('a');
  a.href = url;
  a.download = title.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '_outlook.ics';
  a.click();
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
}

function generatePetronectPDF(id){
  let p = db.petronect.find(x => x.id === id);
  if(!p) return;
  let w = window.open('', '_blank');
  let totalGeral = 0;
  let itemsHtml = (p.items||[]).map((item, idx)=>{
    let qty = Number(item.qty)||1;
    let unit = (item.unit||'').trim();
    let vol = Number(item.volume)||1;
    let unitLower = unit.toLowerCase();
    let isLiter = unitLower.includes('litro') || unitLower.includes('ml') || unitLower.includes('mililitro');
    let calcQty = isLiter ? (vol > 0 ? qty / vol : qty) : qty;

    let fp = Number(item.fullPrice)||0;
    let icms = Number(item.icmsDiscountFactor)||1;
    let disc = Number(item.discountPct)||0;
    let baseIcms = fp * icms;
    let finalP = baseIcms * (1 - (disc/100));
    let subTotal = finalP * calcQty;
    totalGeral += subTotal;
    return `<tr><td>${idx+1}</td><td>${esc(item.itemCode||'—')}</td><td>${esc(item.summary)}</td><td>${qty} ${unit}</td><td>${vol}L</td><td>${esc(item.color||'—')}</td><td>${money(finalP)}</td><td><b>${money(subTotal)}</b></td></tr>`;
  }).join('');

  w.document.write(`
    <html><head><title>Proposta Edital ${esc(p.opportunity)}</title>
    <style>body{font-family:Arial,sans-serif;padding:30px;color:#333;}h2{color:#142d48;border-bottom:2px solid #142d48;padding-bottom:5px;}table{width:100%;border-collapse:collapse;margin-top:20px;}th,td{border:1px solid #ddd;padding:8px;font-size:12px;text-align:left;}th{background:#f8fafb;}</style>
    </head><body>
    <h2>ADVANCE TINTAS - PROPOSTA COMERCIAL (PETRONECT)</h2>
    <p><b>Edital / Oportunidade:</b> ${esc(p.opportunity)}</p>
    <p><b>Data de Encerramento:</b> ${fmtDate(p.closingDate)} às ${esc(p.closingTime||'23:59')} · <b>Prazo Entrega:</b> ${esc(p.deliveryTime||'30 dias')}</p>
    <p><b>Local:</b> ${esc(p.city||'—')}/${esc(p.uf||'—')}</p>
    <h3>Relação de Itens da Proposta</h3>
    <table><thead><tr><th>#</th><th>Item</th><th>Descritivo</th><th>Qtd</th><th>Volume</th><th>Cor</th><th>Unit. Final</th><th>Total Item</th></tr></thead><tbody>${itemsHtml}</tbody></table>
    <p style="margin-top:16px;font-size:15px;text-align:right;"><b>Valor Total Estimado da Proposta: ${money(totalGeral)}</b></p>
    <p style="margin-top:30px;font-size:11px;color:#777;text-align:right;">Gerado por Advance CRM em ${fmtDate(today())}</p>
    <script>window.print();<\/script></body></html>
  `);
  w.document.close();
}

function generateOpportunityPDF(id){
  let o = db.opportunities.find(x => x.id === id);
  if(!o) return;
  let w = window.open('', '_blank');
  let items = o.products || [];
  let totalGeral = 0;
  let itemsHtml = items.map((item, idx) => {
    let q = Number(item.qty) || 0;
    let uv = Number(item.unitValue) || 0;
    let tot = q * uv;
    totalGeral += tot;
    return `<tr><td>${idx+1}</td><td><b>${esc(item.name)}</b><br><small style="color:#666;">${esc(item.desc||'')}</small></td><td>${q} ${esc(item.unit||'UN')}</td><td>${money(uv)}</td><td><b>${money(tot)}</b></td></tr>`;
  }).join('') || `<tr><td colspan="5">Nenhum item detalhado na oportunidade.</td></tr>`;

  let primaryContact = (o.contactsList && o.contactsList[0]) ? o.contactsList[0] : null;

  w.document.write(`
    <html><head><title>Proposta Comercial - ${esc(o.company)}</title>
    <style>
      body{font-family:Arial,sans-serif;padding:32px;color:#222;line-height:1.45;}
      .header{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #142d48;padding-bottom:12px;margin-bottom:20px;}
      .header h1{margin:0;color:#142d48;font-size:22px;}
      .box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px;margin-bottom:18px;font-size:13px;}
      table{width:100%;border-collapse:collapse;margin-top:10px;}
      th,td{border:1px solid #cbd5e1;padding:9px;font-size:12px;text-align:left;}
      th{background:#142d48;color:#fff;}
      .total-box{margin-top:16px;text-align:right;font-size:16px;color:#142d48;}
    </style>
    </head><body>
    <div class="header">
      <div><h1>ADVANCE TINTAS</h1><small style="color:#64748b;">Revestimentos Industriais e Alta Performance</small></div>
      <div style="text-align:right;font-size:12px;"><b>PROPOSTA COMERCIAL</b><br>Ref: ${esc(o.id)}<br>Data: ${fmtDate(today())}</div>
    </div>
    <div class="box">
      <b>Cliente:</b> ${esc(o.company)} ${o.cnpj ? '· CNPJ: ' + esc(o.cnpj) : ''}<br>
      <b>Endereço:</b> ${esc(o.address || '—')} (${esc(o.city || '—')}/${esc(o.uf || '—')})<br>
      ${primaryContact ? `<b>A/C:</b> ${esc(primaryContact.name)} ${primaryContact.role ? '('+esc(primaryContact.role)+')' : ''} · ${esc(primaryContact.email || primaryContact.phone || '')}<br>` : ''}
      ${o.process ? `<b>Processo / Cotação:</b> ${esc(o.process)}<br>` : ''}
      ${o.contractTerm ? `<b>Condição / Prazo:</b> ${esc(o.contractTerm)}` : ''}
    </div>
    <table>
      <thead><tr><th>#</th><th>Produto / Especificação Técnica</th><th>Qtd</th><th>Valor Unit.</th><th>Valor Total</th></tr></thead>
      <tbody>${itemsHtml}</tbody>
    </table>
    <div class="total-box">Valor Total da Proposta: <b>${money(totalGeral || o.value || 0)}</b></div>
    ${o.notes ? `<div style="margin-top:20px;font-size:12px;color:#475569;"><b>Observações Comerciais:</b><br>${esc(o.notes)}</div>` : ''}
    <div style="margin-top:36px;border-top:1px solid #e2e8f0;padding-top:10px;font-size:11px;color:#64748b;display:flex;justify-content:space-between;">
      <span>Responsável Comercial: ${esc(o.owner || 'Equipe Advance Tintas')}</span>
      <span>Advance CRM</span>
    </div>
    <script>window.print();<\/script></body></html>
  `);
  w.document.close();
}

function maskCNPJ(v){
 v = v.replace(/\D/g,"").slice(0,14);
 v = v.replace(/^(\d{2})(\d)/,"$1.$2");
 v = v.replace(/^(\d{2})\.(\d{3})(\d)/,"$1.$2.$3");
 v = v.replace(/\.(\d{3})(\d)/,".$1/$2");
 v = v.replace(/(\d{4})(\d)/,"$1-$2");
 return v;
}
function maskPhone(v){
 v = v.replace(/\D/g,"").slice(0,11);
 if(v.length > 10){ v = v.replace(/^(\d{2})(\d{5})(\d{4}).*/,"($1) $2-$3"); }
 else if(v.length > 5){ v = v.replace(/^(\d{2})(\d{4})(\d{0,4}).*/,"($1) $2-$3"); }
 else if(v.length > 2){ v = v.replace(/^(\d{2})(\d{0,5})/,"($1) $2"); }
 else if(v.length > 0){ v = v.replace(/^(\d*)/,"($1"); }
 return v;
}

function generateCustomId(prefix, list){
 const now = new Date();
 const month = String(now.getMonth() + 1).padStart(2, '0');
 const year = now.getFullYear();
 const base = prefix + month + year;
 const matching = list.filter(item => item.id && item.id.startsWith(base));
 const seq = matching.length + 1;
 return base + String(seq).padStart(4, '0');
}

const statusOptions=['Novo lead','Pesquisa em andamento','Contato identificado','Primeiro contato feito','Em negociação','Cotação solicitada','Proposta enviada','Homologação','Vendor List aprovado','Sem retorno','Perdido','Cliente ativo','Reativar futuramente'];
const petronectStatusOptions=['Declinada','Analisando','Sala de colaboração','Postada','Ganha','Perdida','Encerrada'];
const vendorOptions=['Não iniciado','Mapear requisitos','Documentação enviada','Em análise','Aprovado','Reprovado','Não se aplica'];
const activityTypes=['Tarefa / To-Do','Planilha / Relatório','Administrativo','Ligação','E-mail','WhatsApp','Reunião','Cotação','Follow-up','Homologação','Pesquisa','LinkedIn','Envio de apresentação','Outro'];
const lossReasonOptions=['Preço / Condição comercial','Prazo de entrega','Concorrente local / regional','Falta de homologação / especificações','Escopo técnico / produto fora de linha','Cancelado / adiado pelo cliente','Sem retorno do comprador','Outro'];
const petronectChecklistItems=['CRCC Petrobras válido','Certidões Negativas (CND / FGTS / Trabalhista)','Boletim Técnico e FISPQ','Atestado de Capacidade Técnica','Planilha de Custos e Frete revisada','Garantia / Declarações do Edital'];

const portalStatusOptions=['Ativo','Pendente','Em cadastro','Bloqueado','Inativo','Atualização necessária'];
const portalCategoryOptions=['Compras','Licitações','Cadastro de fornecedores','Cotações','Homologação','ERP / Cliente','Outros'];
const portalSegmentOptions=['Revenda','Distribuidor','Consumidor final','Construtoras','Indústria','Órgão público','Colaboradores','Manutenção industrial','Outro'];
const portalHistoryTypes=['Cadastro','Alteração de senha','Atualização cadastral','Bloqueio','Desbloqueio','Acesso','Renovação / Validade','Outro'];

const pillClass=s=>['Cliente ativo','Vendor List aprovado','Aprovado','Ganha','Postada','Sim','Ativo'].includes(s)?'green':['Perdido','Reprovado','Declinada','Perdida','Não','Bloqueado','Inativo'].includes(s)?'red':['Em negociação','Homologação','Em análise','Documentação enviada','Sala de colaboração','Pendente','Atualização necessária'].includes(s)?'amber':['Analisando','Encerrada','Em cadastro'].includes(s)?'purple':'blue';

function setPage(p){
 page=p;
 closeMobileSidebar();
 document.querySelectorAll('[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===p));

 const isOppGroup=['opportunities','companies','contacts'].includes(p);
 const oppSub=$('#oppSubmenu'), oppBtn=$('#oppMenuBtn');
 if(oppSub) oppSub.classList.toggle('open', isOppGroup);
 if(oppBtn) oppBtn.classList.toggle('expanded', isOppGroup);

 const isPortalsGroup=['portals_panel','portals_base','portals_history'].includes(p);
 const portalsSub=$('#portalsSubmenu'), portalsBtn=$('#portalsMenuBtn');
 if(portalsSub) portalsSub.classList.toggle('open', isPortalsGroup);
 if(portalsBtn) {
   portalsBtn.classList.toggle('expanded', isPortalsGroup);
   if(p==='portals_base' || p==='portals_history') portalsBtn.classList.remove('active');
 }

 render();
}
$('#nav').addEventListener('click',e=>{let b=e.target.closest('[data-page]');if(b)setPage(b.dataset.page)});
document.querySelectorAll('.nav button[data-page]').forEach(b=>b.addEventListener('click',()=>setPage(b.dataset.page)));

let modalLocked = false;
function closeModal(force=false){
  if(modalLocked && !force) return;
  modalLocked = false;
  $('#modalBack').classList.remove('show');
  $('#modalBox').classList.remove('modal-sm');
  $('#modalCloseBtn').style.display = 'block';
  modalSaveFn=null;
}
$('#modalCloseBtn').onclick = () => closeModal(false);
$('#modalCancelBtn').onclick = () => closeModal(false);
$('#modalSaveBtn').onclick = () => { if(modalSaveFn) modalSaveFn(); };

function openModal(title,body,save,customFoot='',small=false,locked=false){
 modalLocked = locked;
 $('#modalTitle').textContent=title;
 $('#modalBody').innerHTML=body;
 modalSaveFn=save;
 $('#modalBox').classList.toggle('modal-sm', !!small);
 $('#modalCloseBtn').style.display = locked ? 'none' : 'block';
 let foot=$('#modalFoot');
 if(customFoot){
  foot.innerHTML=customFoot;
  let sBtn = foot.querySelector('#modalSaveBtn');
  if(sBtn) sBtn.onclick = () => { if(modalSaveFn) modalSaveFn(); };
 } else {
  foot.innerHTML=`<button class="btn" id="modalCancelBtn" onclick="closeModal()">Cancelar</button><button class="btn primary" id="modalSaveBtn">Salvar registro</button>`;
  $('#modalSaveBtn').onclick = () => { if(modalSaveFn) modalSaveFn(); };
 }
 $('#modalBack').classList.add('show');
}

function head(title,sub,action=''){return `<div class="page-head"><div><h1>${title}</h1><p>${sub}</p></div>${action}</div>`}
function stat(label,value,icon,sub){return `<div class="stat"><div class="stat-top"><span>${label}</span><span class="stat-icon">${icon}</span></div><strong>${value}</strong><small>${sub}</small></div>`}
function render(){
  const names={
    dashboard:'Dashboard',
    opportunities:'Oportunidades',
    petronect:'Petronect',
    portals_panel:'Portais / Painel',
    portals_base:'Portais / Base de Portais',
    portals_history:'Portais / Histórico',
    companies:'Oportunidades / Empresas',
    contacts:'Oportunidades / Contatos',
    activities:'Tarefas e Atividades',
    vendor:'Vendor List',
    reports:'Relatórios',
    settings:'Backup e configurações'
  };
  $('#crumb').textContent=names[page]||'Dashboard';
  const root=$('#content');
  ({
    dashboard:dashboardPage,
    opportunities:opportunitiesPage,
    petronect:petronectPage,
    portals_panel:portalsPanelPage,
    portals_base:portalsBasePage,
    portals_history:portalsHistoryPage,
    companies:companiesPage,
    contacts:contactsPage,
    activities:activitiesPage,
    vendor:vendorPage,
    reports:reportsPage,
    settings:settingsPage
  }[page]||dashboardPage)(root);
}

/* ==================== DASHBOARD PRINCIPAL (CENTRO DE COMANDO GERAL) ==================== */
function setDashDueFilter(f){
 dashDueFilter = f;
 render();
}

function dashboardPage(root){
 const portalsList = db.portals || [];
 const openOppsList = db.opportunities.filter(o=>!['Perdido','Cliente ativo'].includes(o.status)&&!o.done);
 const openOpps = openOppsList.length;
 const overdueOpps = openOppsList.filter(o=>o.nextDate&&o.nextDate<today()).length;
 const staleOpps = openOppsList.filter(o => {
  let refDate = o.updated || o.created;
  let diff = daysDiffFromToday(refDate);
  return diff !== null && diff <= -15;
 });

 const petronectActive = db.petronect.filter(p=>!['Declinada','Ganha','Perdida','Encerrada'].includes(p.status)).length;
 const petronectAnalisando = db.petronect.filter(p=>p.status==='Analisando').length;
 const petronectPostada = db.petronect.filter(p=>p.status==='Postada').length;
 const petronectGanha = db.petronect.filter(p=>p.status==='Ganha').length;

 const portalsActive = portalsList.filter(p=>p.status==='Ativo').length;
 const portalsAttention = portalsList.filter(p=>['Pendente','Bloqueado','Atualização necessária','Em cadastro'].includes(p.status) || (p.expiryDate && daysDiffFromToday(p.expiryDate) <= 30 && p.status !== 'Inativo')).length;
 const vendorActive = db.opportunities.filter(o=>o.vendor && !['Não iniciado','Não se aplica','Aprovado','Reprovado'].includes(o.vendor)).length;

 const pendingTasks = db.activities.filter(a=>!a.done);
 const overdueTasks = pendingTasks.filter(a=>a.nextDate && a.nextDate < today()).length;

 let oppDue = openOppsList.filter(o=>o.nextDate).map(o=>({
  type:'opp', id:o.id, title:o.company||'Empresa não informada', date:o.nextDate, desc:o.nextAction||'Follow-up comercial'
 }));
 let petronectDue = db.petronect.filter(p=>p.closingDate&&p.status!=='Declinada'&&!['Ganha','Perdida','Encerrada'].includes(p.status)).map(p=>({
  type:'petronect', id:p.id, title:'Petronect: '+p.opportunity, date:p.closingDate, desc:'Encerramento do edital'
 }));
 let actDue = pendingTasks.filter(a=>a.nextDate).map(a=>({
  type:'act', id:a.id, title:a.title || a.summary || a.type, date:a.nextDate,
  desc:(a.company && a.company !== 'Geral / Interno' ? a.company + ' · ' : '') + (a.next || a.type)
 }));
 let portalDue = portalsList.filter(pt=>pt.expiryDate && pt.status !== 'Inativo').map(pt=>({
  type:'portal', id:pt.id, title:'Portal: '+pt.name, date:pt.expiryDate,
  desc:'Validade / Vencimento ('+(pt.company||'—')+')'
 }));
 let portalHistDue = (db.portalHistory||[]).filter(h=>!h.done && h.deadline).map(h=>({
  type:'portal_hist', id:h.id, title:'Portal ('+h.portalName+'): '+(h.nextAction||h.type), date:h.deadline,
  desc:h.description||'Pendência de portal'
 }));

 let allDue = [...oppDue, ...petronectDue, ...actDue, ...portalDue, ...portalHistDue].sort((a,b)=>a.date.localeCompare(b.date));
 let filteredDue = dashDueFilter === 'all' ? allDue : allDue.filter(item => {
  if(dashDueFilter === 'portal') return item.type === 'portal' || item.type === 'portal_hist';
  return item.type === dashDueFilter;
 });

 let movActs = db.activities.map(a=>({
  date: a.date || '',
  origin: 'Atividade / Tarefa',
  pill: 'blue',
  subject: a.title || a.summary || a.type,
  context: a.company || 'Geral / Interno',
  detail: a.summary || a.type
 }));
 let movPortals = (db.portalHistory||[]).map(h=>({
  date: h.date || '',
  origin: 'Portal · ' + h.type,
  pill: 'purple',
  subject: h.portalName || 'Portal',
  context: h.responsible || 'Sistema',
  detail: h.description || '—'
 }));
 let recentMovements = [...movActs, ...movPortals].sort((a,b)=>(b.date||'').localeCompare(a.date||'')).slice(0, 25);

 root.innerHTML = head('Centro de Comando Geral','Visão consolidada de oportunidades, editais Petronect, portais, homologações e tarefas do dia.') +

 (staleOpps.length ? `
  <div class="notice warn" style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
   <div><b>⏳ Leads sem movimentação (+15 dias):</b> Você tem <b>${staleOpps.length}</b> oportunidade(s) aberta(s) sem atualização há mais de 15 dias (${staleOpps.slice(0,3).map(x=>esc(x.company)).join(', ')}${staleOpps.length>3?'...':''}).</div>
   <button class="btn small" onclick="openOpportunity('${staleOpps[0].id}')">Revisar primeiro</button>
  </div>
 ` : '') +

 `<div class="cards">
  ${stat('Oportunidades Abertas', openOpps, '◎', `${overdueOpps} follow-up(s) atrasado(s) · ${staleOpps.length} parada(s) +15d`)}
  ${stat('Editais Petronect Ativos', petronectActive, '◈', `${petronectAnalisando} analisando · ${petronectPostada} postada(s)`)}
  ${stat('Portais & Homologações', `${portalsActive} / ${portalsList.length}`, '⊕', `${portalsAttention} portal(is) pendente/vencendo · ${vendorActive} Vendor List`)}
  ${stat('Tarefas Pendentes (To-Do)', pendingTasks.length, '✓', `${overdueTasks} atrasada(s) · Rotina e acompanhamento`)}
 </div>

 <div class="grid2">
  <div style="display:flex;flex-direction:column;gap:16px;">
   <div class="panel">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:6px;">
     <h3 style="margin:0;">Saúde dos Portais & Petronect</h3>
     <div style="display:flex;gap:6px;">
      <button class="btn small" onclick="setPage('portals_panel')">Ver Portais</button>
      <button class="btn small" onclick="setPage('petronect')">Ver Petronect</button>
     </div>
    </div>
    <div class="mini-summary-grid">
     <div class="mini-box"><span>⊕ Portais Ativos</span><span class="pill green">${portalsActive}</span></div>
     <div class="mini-box"><span>⚠ Portais Atenção / Vencendo</span><span class="pill ${portalsAttention?'red':'blue'}">${portalsAttention}</span></div>
     <div class="mini-box"><span>◈ Petronect em Análise</span><span class="pill purple">${petronectAnalisando}</span></div>
     <div class="mini-box"><span>★ Petronect Ganhas</span><span class="pill green">${petronectGanha}</span></div>
    </div>
    <div style="font-size:12px;font-weight:700;color:var(--muted);margin:10px 0 6px;text-transform:uppercase;letter-spacing:.5px;">Pipeline de Oportunidades</div>
    ${statusOptions.slice(0,7).map(s=>{let n=db.opportunities.filter(o=>o.status===s&&!o.done).length;return `<div class="bar-row"><span>${esc(s)}</span><div class="bar"><i style="width:${db.opportunities.length?100*n/db.opportunities.length:0}%"></i></div><b>${n}</b></div>`}).join('')||'<div class="empty">Cadastre oportunidades para visualizar o pipeline.</div>'}
   </div>
  </div>

  <div class="panel">
   <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:12px;flex-wrap:wrap;">
    <h3 style="margin:0;">Agenda Unificada e Prazos</h3>
    <div style="display:flex;gap:4px;flex-wrap:wrap;">
     <button class="btn small ${dashDueFilter==='all'?'primary':''}" style="padding:4px 8px;font-size:11px;" onclick="setDashDueFilter('all')">Todos (${allDue.length})</button>
     <button class="btn small ${dashDueFilter==='act'?'primary':''}" style="padding:4px 8px;font-size:11px;" onclick="setDashDueFilter('act')">Tarefas (${actDue.length})</button>
     <button class="btn small ${dashDueFilter==='petronect'?'primary':''}" style="padding:4px 8px;font-size:11px;" onclick="setDashDueFilter('petronect')">Editais (${petronectDue.length})</button>
     <button class="btn small ${dashDueFilter==='portal'?'primary':''}" style="padding:4px 8px;font-size:11px;" onclick="setDashDueFilter('portal')">Portais (${portalDue.length+portalHistDue.length})</button>
     <button class="btn small ${dashDueFilter==='opp'?'primary':''}" style="padding:4px 8px;font-size:11px;" onclick="setDashDueFilter('opp')">Oportunidades (${oppDue.length})</button>
    </div>
   </div>
   ${filteredDue.length?`
    <div class="due-scroll-container">
     ${filteredDue.map(item=>{
      let diff = daysDiffFromToday(item.date);
      let isExp = diff !== null && diff < 0;
      let isTom = diff === 1;
      let isSoon30 = item.type === 'portal' && diff !== null && diff >= 0 && diff <= 30;
      let badgeText = isExp ? 'Vencido' : (diff === 0 ? 'Vence Hoje' : (isTom ? 'Vence Amanhã' : (isSoon30 ? `Vence em ${diff}d` : 'Agendado')));
      let badgeClass = isExp ? 'red' : ((diff === 0 || isTom || isSoon30) ? 'amber' : 'blue');
      let clickFn = item.type==='opp' ? `openOpportunity('${item.id}')` : (item.type==='petronect' ? `openPetronectModal('${item.id}')` : (item.type==='portal' ? `openPortalModal('${item.id}')` : (item.type==='portal_hist' ? `openPortalHistoryModal('${item.id}')` : `editActivity('${item.id}')`)));
      let typeLabel = item.type==='petronect' ? 'Edital' : (item.type==='opp' ? 'Oportunidade' : (item.type==='portal' || item.type==='portal_hist' ? 'Portal' : 'Tarefa'));
      let doneBtn = item.type==='opp' ? `<button class="btn small" onclick="event.stopPropagation(); toggleOpportunityDone('${item.id}')" title="Concluir">✓</button>` : (item.type==='act' ? `<button class="btn small" onclick="event.stopPropagation(); toggleActivityDone('${item.id}')" title="Concluir">✓</button>` : (item.type==='portal_hist' ? `<button class="btn small" onclick="event.stopPropagation(); togglePortalHistoryDone('${item.id}')" title="Concluir">✓</button>` : ''));
      return `<div class="activity-card" onclick="${clickFn}">
       <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;">
        <strong>${esc(item.title)}</strong>
        <div style="display:flex;gap:4px;flex-shrink:0;">
         <button class="btn small" onclick="event.stopPropagation(); exportToOutlook('${esc(item.title)}', '${item.date}', '${esc(item.desc)}')" title="Exportar para Outlook (.ics)">📅</button>
         ${doneBtn}
        </div>
       </div>
       <small style="display:block;margin:4px 0;">${fmtDate(item.date)} · ${esc(item.desc)}</small>
       <div><span class="pill ${badgeClass}" style="font-size:10px;padding:2px 6px;">${badgeText}</span> <span class="pill" style="font-size:9px;padding:2px 4px;">${typeLabel}</span></div>
      </div>`;
     }).join('')}
    </div>
   `:'<div class="empty"><b>Nenhum prazo pendente neste filtro</b>Tudo em dia por aqui!</div>'}
  </div>
 </div>

 <div class="grid2" style="margin-top:16px;">
  <div class="panel">
   <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
    <h3 style="margin:0;">Minhas Tarefas Pendentes (To-Do)</h3>
    <button class="btn small" onclick="setPage('activities')">Ver todas</button>
   </div>
   ${pendingTasks.length ? `
    <div style="display:flex;flex-direction:column;gap:8px;max-height:238px;overflow-y:auto;padding-right:2px;">
     ${pendingTasks.slice(0,12).map(t=>`
      <div class="todo-item">
       <input type="checkbox" style="margin-top:3px;" onchange="toggleActivityDone('${t.id}')" title="Marcar como concluída">
       <div style="flex:1;min-width:0;cursor:pointer;" onclick="editActivity('${t.id}')">
        <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;">
         <b style="font-size:13px;">${esc(t.title || t.summary || t.type)}</b>
         <span class="pill" style="font-size:10px;padding:2px 6px;">${esc(t.type)}</span>
        </div>
        <div class="muted" style="font-size:11px;margin-top:2px;">
         ${esc(t.company || 'Geral / Interno')} ${t.nextDate ? '· Prazo: <b>'+fmtDate(t.nextDate)+'</b>' : ''}
        </div>
       </div>
      </div>
     `).join('')}
    </div>
   ` : '<div class="empty"><b>Nenhuma tarefa pendente</b>Acesse "Tarefas e Atividades" para adicionar suas pendências do dia.</div>'}
  </div>

  <div class="panel">
   <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
    <h3 style="margin:0;">Últimas Movimentações (Geral)</h3>
    <span class="muted" style="font-size:11px;">Role para ver mais (${recentMovements.length})</span>
   </div>
   ${recentMovements.length ? `
    <div class="table-wrap movements-scroll-container">
     <table style="min-width:440px;">
      <thead><tr><th style="padding:8px 10px;">Data</th><th style="padding:8px 10px;">Origem</th><th style="padding:8px 10px;">Assunto / Portal</th><th style="padding:8px 10px;">Detalhes</th></tr></thead>
      <tbody>
       ${recentMovements.map(m=>`
        <tr>
         <td style="white-space:nowrap;padding:8px 10px;font-size:12px;">${fmtDate(m.date)}</td>
         <td style="padding:8px 10px;"><span class="pill ${m.pill}" style="font-size:10px;padding:3px 7px;">${esc(m.origin)}</span></td>
         <td style="padding:8px 10px;font-size:12px;"><b>${esc(m.subject)}</b><div class="muted" style="font-size:11px;">${esc(m.context)}</div></td>
         <td style="padding:8px 10px;font-size:12px;">${esc(m.detail)}</td>
        </tr>
       `).join('')}
      </tbody>
     </table>
    </div>
   ` : '<div class="empty">Nenhuma movimentação registrada ainda.</div>'}
  </div>
 </div>`;
}
/* ======================================================================================= */

function toolbar(placeholder,filters=''){return `<div class="toolbar"><input id="search" placeholder="${placeholder}">${filters}<button class="btn small" onclick="exportCSVCurrent()">⇩ Exportar CSV</button></div>`}

function opportunitiesPage(root){
 root.innerHTML=head('Oportunidades','Registre licitações, contratos, projetos e potenciais negócios.',`<button class="btn primary" onclick="openOpportunity()">＋ Nova oportunidade</button>`)+toolbar('Buscar empresa, produto, processo ou CNPJ...',`<select id="statusFilter"><option value="">Todos os status</option>${statusOptions.map(s=>`<option>${s}</option>`).join('')}</select><select id="priorityFilter"><option value="">Todas prioridades</option><option>Urgente</option><option>Alta</option><option>Normal</option><option>Baixa</option></select>`)+`<div class="panel"><div class="table-wrap"><table><thead><tr><th>Status</th><th>ID</th><th>Empresa / oportunidade</th><th>Produtos / Valor</th><th>Origem / processo</th><th>Prioridade</th><th>Status</th><th>Próximo contato</th><th>Ações</th></tr></thead><tbody id="rows"></tbody></table></div></div>`;
 const draw=()=>{
  let q=$('#search').value.toLowerCase(),s=$('#statusFilter').value,p=$('#priorityFilter').value;
  let arr=db.opportunities.filter(o=>{
   let prodText=(o.products||[]).map(i=>i.name+' '+i.desc).join(' ');
   let matchText=[o.id,o.company,prodText,o.process,o.cnpj,o.source,o.address].join(' ').toLowerCase();
   return matchText.includes(q)&&(!s||o.status===s)&&(!p||o.priority===p);
  });
  $('#rows').innerHTML=arr.length?arr.map(o=>{
   let refDate = o.updated || o.created;
   let isStale = !o.done && !['Perdido','Cliente ativo'].includes(o.status) && refDate && daysDiffFromToday(refDate) <= -15;
   return `
   <tr style="${o.done?'opacity:0.5;background:var(--bg);':''}">
    <td style="text-align:center;"><input type="checkbox" ${o.done?'checked':''} onchange="toggleOpportunityDone('${o.id}')" title="Marcar como concluído"></td>
    <td><code style="font-size:12px;background:var(--line);padding:2px 6px;border-radius:4px;color:var(--text);font-weight:700;">${esc(o.id)}</code></td>
    <td>
     <b style="${o.done?'text-decoration:line-through;':''}">${esc(o.company||'Sem empresa')}</b>
     ${isStale ? '<span class="pill amber" style="font-size:9px;padding:2px 5px;margin-left:4px;">Parado +15d</span>' : ''}
     <div class="muted">${esc(o.city||'')}${o.uf?'/'+esc(o.uf):''} · ${esc(o.segment||'')}</div>
    </td>
    <td>
     <div>${esc((o.products||[]).length > 0 ? `${o.products.length} item(ns)` : '0')}</div>
     <div class="muted" style="font-size:11px;"><b>${money(o.value)}</b></div>
    </td>
    <td>${esc(o.source||'—')}<div class="muted">${esc(o.process||'')}</div></td>
    <td><span class="pill ${['Alta','Urgente'].includes(o.priority)?'green':''}">${esc(o.priority||'—')}</span></td>
    <td>
     <span class="pill ${pillClass(o.status)}">${esc(o.status)}</span>
     ${o.status === 'Perdido' && o.lossReason ? `<div class="muted" style="font-size:10px;margin-top:2px;">Motivo: ${esc(o.lossReason)}</div>` : ''}
    </td>
    <td>${fmtDate(o.nextDate)}</td>
    <td>
     <div style="display:flex;gap:5px;">
      <button class="btn small" onclick="editOpportunity('${o.id}')">Editar</button>
      <button class="btn small danger" onclick="deleteOpportunity('${o.id}')">Excluir</button>
     </div>
    </td>
   </tr>
  `}).join(''):`<tr><td colspan="9"><div class="empty"><b>Nenhuma oportunidade encontrada</b>Experimente alterar os filtros ou cadastrar uma oportunidade.</div></td></tr>`;
 };
 $('#search').oninput=draw;$('#statusFilter').onchange=draw;$('#priorityFilter').onchange=draw;draw();
}

function toggleOpportunityDone(id){
 let opp = db.opportunities.find(o => o.id === id);
 if(opp){ opp.done = !opp.done; opp.updated = today(); saveDB(); render(); }
}

function toggleActivityDone(actId){
 let act = db.activities.find(a => a.id === actId);
 if(act){ act.done = !act.done; saveDB(); render(); }
}

function togglePortalHistoryDone(histId){
 let h = (db.portalHistory||[]).find(x => x.id === histId);
 if(h){ h.done = !h.done; saveDB(); render(); }
}

/* ==================== PORTAIS (PAINEL, BASE E HISTÓRICO) ==================== */
function portalsNavBar(activeTab){
 return `
  <div style="display:flex;gap:8px;margin-bottom:18px;border-bottom:1px solid var(--line);padding-bottom:12px;flex-wrap:wrap;">
   <button class="btn small ${activeTab==='panel'?'primary':''}" onclick="setPage('portals_panel')">◫ Painel</button>
   <button class="btn small ${activeTab==='base'?'primary':''}" onclick="setPage('portals_base')">▤ Base de Portais</button>
   <button class="btn small ${activeTab==='history'?'primary':''}" onclick="setPage('portals_history')">◷ Histórico de Alterações</button>
  </div>
 `;
}

function portalsPanelPage(root){
 let list = db.portals || [];
 let total = list.length;
 let ativos = list.filter(p => p.status === 'Ativo').length;
 let pendentes = list.filter(p => p.status === 'Pendente').length;
 let emCadastro = list.filter(p => p.status === 'Em cadastro').length;
 let bloqueados = list.filter(p => p.status === 'Bloqueado').length;
 let inativos = list.filter(p => p.status === 'Inativo').length;
 let atualizacao = list.filter(p => p.status === 'Atualização necessária').length;
 let vencidosOuVencendo = list.filter(p => p.expiryDate && daysDiffFromToday(p.expiryDate) <= 30 && p.status !== 'Inativo').length;

 const distItems = [
  { label: 'Ativo', count: ativos, color: '#24966b' },
  { label: 'Pendente', count: pendentes, color: '#d69e2e' },
  { label: 'Em cadastro', count: emCadastro, color: '#805ad5' },
  { label: 'Bloqueado', count: bloqueados, color: '#e53e3e' },
  { label: 'Inativo', count: inativos, color: '#718096' },
  { label: 'Atualização necessária', count: atualizacao, color: '#dd6b20' }
 ];

 let gradientParts = [];
 let accPct = 0;
 if(total > 0){
  distItems.forEach(item => {
   if(item.count > 0){
    let pct = (item.count / total) * 100;
    gradientParts.push(`${item.color} ${accPct.toFixed(2)}% ${(accPct + pct).toFixed(2)}%`);
    accPct += pct;
   }
  });
 }
 let conicBg = gradientParts.length ? `conic-gradient(${gradientParts.join(', ')})` : 'conic-gradient(var(--line) 0% 100%)';

 root.innerHTML = head('Gestão de Portais · Painel','Visão geral de homologações, acessos, credenciais e vencimentos.',`<div style="display:flex;gap:8px;flex-wrap:wrap;"><button class="btn" onclick="openPortalHistoryModal()">＋ Registrar Alteração</button><button class="btn primary" onclick="openPortalModal()">＋ Novo Portal</button></div>`) +
 portalsNavBar('panel') +
 `<div class="cards-6">
  ${stat('Total Cadastrados', total, '⊕', 'Todos os portais registrados na base comercial.')}
  ${stat('Ativos', ativos, '✓', 'Ativo: cadastro realizado e acesso funcionando normalmente.')}
  ${stat('Pendentes', pendentes, '◷', 'Pendente: cadastro aguardando alguma etapa ou aprovação.')}
  ${stat('Bloqueados', bloqueados, '✕', 'Bloqueado: acesso impedido ou conta bloqueada.')}
  ${stat('Atualização Necessária', atualizacao, '↻', 'Atualização necessária: cadastro ou documentação que precisa de atualização.')}
  ${stat('Vencidos / < 30 dias', vencidosOuVencendo, '⚠', 'Portais com validade expirada ou vencendo nos próximos 30 dias.')}
 </div>

 <div class="panel">
  <h3>Distribuição por Status</h3>
  <div class="grid2" style="align-items:center;">
   <div>
    ${distItems.map(item => `
     <div class="bar-row" style="grid-template-columns:165px 1fr 45px;">
      <span><b>${esc(item.label)}</b></span>
      <div class="bar"><i style="width:${total ? (100 * item.count / total) : 0}%;background:${item.color};"></i></div>
      <b>${item.count}</b>
     </div>
    `).join('')}
   </div>
   <div class="donut-wrap">
    <div class="donut-chart" style="background:${conicBg};">
     <div class="donut-hole">
      <strong style="font-size:24px;line-height:1;">${total}</strong>
      <small class="muted" style="font-size:11px;">Portais</small>
     </div>
    </div>
    <div class="donut-legend">
     ${distItems.map(item => `
      <div class="legend-item">
       <div style="display:flex;align-items:center;gap:8px;">
        <span class="legend-dot" style="background:${item.color};"></span>
        <span>${esc(item.label)}</span>
       </div>
       <b>${item.count} <span class="muted" style="font-weight:400;">(${total ? Math.round((item.count/total)*100) : 0}%)</span></b>
      </div>
     `).join('')}
    </div>
   </div>
  </div>
 </div>`;
}

function portalsBasePage(root){
 root.innerHTML = head('Gestão de Portais · Base de Portais','Cadastro centralizado de acessos, credenciais, responsáveis e validades.',`<button class="btn primary" onclick="openPortalModal()">＋ Novo Portal</button>`) +
 portalsNavBar('base') +
 toolbar('Buscar portal, empresa/órgão, login, CNPJ ou responsável...',`
  <select id="portalStatusFilter"><option value="">Todos os status</option>${portalStatusOptions.map(s=>`<option>${s}</option>`).join('')}</select>
  <select id="portalCatFilter"><option value="">Todas categorias</option>${portalCategoryOptions.map(c=>`<option>${c}</option>`).join('')}</select>
 `) +
 `<div class="panel"><div class="table-wrap"><table><thead><tr><th>ID</th><th>Portal / Empresa</th><th>Categoria / Seg.</th><th>Login / Acesso</th><th>Responsável</th><th>Status</th><th>Últ. Atualização</th><th>Validade</th><th>Ações</th></tr></thead><tbody id="rows"></tbody></table></div></div>`;

 const draw = () => {
  let q = $('#search').value.toLowerCase();
  let st = $('#portalStatusFilter').value;
  let cat = $('#portalCatFilter').value;
  let arr = (db.portals || []).filter(p => {
   let txt = [p.id, p.name, p.company, p.category, p.segment, p.cnpj, p.login, p.responsible, p.email].join(' ').toLowerCase();
   return txt.includes(q) && (!st || p.status === st) && (!cat || p.category === cat);
  });

  $('#rows').innerHTML = arr.length ? arr.map(p => {
   let diff = (p.expiryDate && p.status !== 'Inativo') ? daysDiffFromToday(p.expiryDate) : null;
   let isExpired = diff !== null && diff < 0;
   let isSoon30 = diff !== null && diff >= 0 && diff <= 30;
   return `
    <tr>
     <td><code style="font-size:12px;background:var(--line);padding:2px 6px;border-radius:4px;color:var(--text);font-weight:700;">${esc(p.id)}</code></td>
     <td>
      <b>${esc(p.name)}</b>
      <div class="muted" style="font-size:12px;">${esc(p.company || '—')} ${p.cnpj ? '· ' + esc(p.cnpj) : ''}</div>
     </td>
     <td>
      <div>${esc(p.category || '—')}</div>
      <div class="muted" style="font-size:11px;">${esc(p.segment || '—')}</div>
     </td>
     <td>
      <div style="font-size:12px;"><b>User:</b> ${esc(p.login || '—')}</div>
      <div style="display:flex;gap:4px;margin-top:4px;flex-wrap:wrap;">
       ${p.login ? `<button class="btn small" style="padding:2px 6px;font-size:11px;" onclick="copyText('${esc(p.login)}','Login')" title="Copiar Login">📋 User</button>` : ''}
       ${p.password ? `<button class="btn small" style="padding:2px 6px;font-size:11px;" onclick="copyText('${esc(p.password)}','Senha')" title="Copiar Senha">🔑 Senha</button>` : ''}
       ${p.link ? `<a href="${esc(p.link)}" target="_blank" class="btn small" style="padding:2px 6px;font-size:11px;text-decoration:none;" title="Abrir Portal">🔗 Portal</a>` : ''}
       ${p.docsLink ? `<a href="${esc(p.docsLink)}" target="_blank" class="btn small" style="padding:2px 6px;font-size:11px;text-decoration:none;" title="Pasta de Documentos">📂 Docs</a>` : ''}
      </div>
     </td>
     <td>${esc(p.responsible || '—')}</td>
     <td><span class="pill ${pillClass(p.status)}">${esc(p.status)}</span></td>
     <td>${fmtDate(p.lastUpdate)}</td>
     <td>
      ${fmtDate(p.expiryDate)}
      ${isExpired ? '<div><span class="pill red" style="font-size:10px;padding:2px 6px;">Vencido</span></div>' : ''}
      ${isSoon30 ? `<div><span class="pill amber" style="font-size:10px;padding:2px 6px;">Vence em ${diff}d</span></div>` : ''}
     </td>
     <td>
      <div style="display:flex;gap:5px;">
       <button class="btn small" onclick="openPortalModal('${p.id}')">Editar</button>
       <button class="btn small danger" onclick="deletePortal('${p.id}')">Excluir</button>
      </div>
     </td>
    </tr>
   `;
  }).join('') : `<tr><td colspan="9"><div class="empty"><b>Nenhum portal cadastrado</b>Clique em "+ Novo Portal" para adicionar o primeiro acesso.</div></td></tr>`;
 };

 $('#search').oninput = draw;
 $('#portalStatusFilter').onchange = draw;
 $('#portalCatFilter').onchange = draw;
 draw();
}

function portalsHistoryPage(root){
 let portalsList = db.portals || [];
 root.innerHTML = head('Gestão de Portais · Histórico','Registro de alterações cadastrais, senhas, acessos e pendências dos portais.',`<button class="btn primary" onclick="openPortalHistoryModal()">＋ Nova Alteração</button>`) +
 portalsNavBar('history') +
 toolbar('Buscar descrição, responsável ou ação...',`
  <select id="histPortalFilter"><option value="">Todos os portais</option>${portalsList.map(p=>`<option value="${esc(p.id)}">${esc(p.name)} (${esc(p.id)})</option>`).join('')}</select>
  <select id="histTypeFilter"><option value="">Todos os tipos</option>${portalHistoryTypes.map(t=>`<option>${t}</option>`).join('')}</select>
 `) +
 `<div class="panel"><div class="table-wrap"><table><thead><tr><th style="width:55px;text-align:center;">Concluído</th><th>Data</th><th>Portal</th><th>Tipo de Alteração</th><th>Descrição / Motivo</th><th>Responsável</th><th>Próxima Ação / Prazo</th><th>Ações</th></tr></thead><tbody id="rows"></tbody></table></div></div>`;

 const draw = () => {
  let q = $('#search').value.toLowerCase();
  let pFilter = $('#histPortalFilter').value;
  let tFilter = $('#histTypeFilter').value;
  let arr = [...(db.portalHistory || [])].sort((a,b) => (b.date || '').localeCompare(a.date || '')).filter(h => {
   let txt = [h.portalName, h.type, h.description, h.responsible, h.nextAction].join(' ').toLowerCase();
   return txt.includes(q) && (!pFilter || h.portalId === pFilter) && (!tFilter || h.type === tFilter);
  });

  $('#rows').innerHTML = arr.length ? arr.map(h => `
   <tr style="${h.done ? 'opacity:0.55;background:var(--bg);' : ''}">
    <td style="text-align:center;">
     <input type="checkbox" ${h.done ? 'checked' : ''} onchange="togglePortalHistoryDone('${h.id}')" title="Marcar como concluído">
     <div style="font-size:10px;font-weight:700;color:${h.done ? 'var(--green)' : 'var(--muted)'};">${h.done ? 'Sim' : 'Não'}</div>
    </td>
    <td>${fmtDate(h.date)}</td>
    <td><b>${esc(h.portalName || '—')}</b></td>
    <td><span class="pill ${pillClass(h.type === 'Bloqueio' ? 'Bloqueado' : (h.type === 'Desbloqueio' ? 'Ativo' : h.type))}">${esc(h.type)}</span></td>
    <td>${esc(h.description || '—')}</td>
    <td>${esc(h.responsible || '—')}</td>
    <td>
     <div>${esc(h.nextAction || '—')}</div>
     ${h.deadline ? `<small class="muted">Prazo: <b>${fmtDate(h.deadline)}</b></small>` : ''}
    </td>
    <td>
     <div style="display:flex;gap:5px;">
      <button class="btn small" onclick="openPortalHistoryModal('${h.id}')">Editar</button>
      <button class="btn small danger" onclick="deletePortalHistory('${h.id}')">Excluir</button>
     </div>
    </td>
   </tr>
  `).join('') : `<tr><td colspan="8"><div class="empty"><b>Nenhum registro no histórico</b>Registre alterações de senha, atualizações cadastrais ou acessos.</div></td></tr>`;
 };

 $('#search').oninput = draw;
 $('#histPortalFilter').onchange = draw;
 $('#histTypeFilter').onchange = draw;
 draw();
}

function togglePasswordVis(inputId){
 let el = document.getElementById(inputId);
 if(el) el.type = el.type === 'password' ? 'text' : 'password';
}

function openPortalModal(id = null){
 if(!db.portals) db.portals = [];
 if(!db.portalHistory) db.portalHistory = [];
 let p = db.portals.find(x => x.id === id) || {};
 let pHistory = id ? db.portalHistory.filter(h => h.portalId === id).sort((a,b) => (b.date || '').localeCompare(a.date || '')) : [];
 let defaultResp = p.responsible || (currentUser ? currentUser.name : '');

 openModal(id ? 'Editar Portal' : 'Novo Portal', `
  <div style="display:flex;flex-direction:column;gap:15px;">
   ${id ? `<div class="field"><label>ID do Portal</label><input type="text" readonly value="${esc(p.id)}" style="background:var(--line);font-weight:700;"></div>` : ''}

   <div style="background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:15px;">
    <h3 style="margin:0 0 12px 0;font-size:14px;color:var(--text);border-bottom:1px solid var(--line);padding-bottom:6px;">📌 1. Identificação do Portal</h3>
    <div class="form-grid">
     ${field('Nome do Portal *','pt_name',p.name)}
     ${field('Empresa / Órgão','pt_company',p.company)}
     ${field('Categoria','pt_category',p.category || 'Compras','text',portalCategoryOptions)}
     ${field('Segmento','pt_segment',p.segment || 'Indústria','text',portalSegmentOptions)}
     ${field('CNPJ Cadastrado','pt_cnpj',p.cnpj)}
     ${field('Data de Cadastro','pt_created',p.createdDate || today(),'date')}
     ${field('Link de Acesso (URL)','pt_link',p.link,'url')}
     ${field('Link Pasta de Documentos (Drive / Rede)','pt_docs_link',p.docsLink,'url')}
    </div>
   </div>

   <div style="background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:15px;">
    <h3 style="margin:0 0 12px 0;font-size:14px;color:var(--text);border-bottom:1px solid var(--line);padding-bottom:6px;">🔑 2. Credenciais e Contato Vinculado</h3>
    <div class="form-grid">
     ${field('Login / Usuário','pt_login',p.login)}
     <div class="field">
      <label>Senha</label>
      <div style="display:flex;gap:6px;">
       <input id="pt_password" type="password" value="${esc(p.password || '')}" style="flex:1;">
       ${isAdmin() ? `<button type="button" class="btn small" onclick="togglePasswordVis('pt_password')" title="Mostrar/Ocultar">👁️</button>` : ''}
       <button type="button" class="btn small" onclick="copyText(val('pt_password'),'Senha')" title="Copiar">📋</button>
      </div>
     </div>
     ${field('E-mail Vinculado','pt_email',p.email,'email')}
     ${field('Telefone / Contato','pt_phone',p.phone,'tel')}
    </div>
   </div>

   <div style="background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:15px;">
    <h3 style="margin:0 0 12px 0;font-size:14px;color:var(--text);border-bottom:1px solid var(--line);padding-bottom:6px;">📅 3. Status, Datas e Responsável</h3>
    <div class="form-grid">
     ${field('Status do Portal','pt_status',p.status || 'Ativo','text',portalStatusOptions)}
     ${field('Responsável Interno','pt_responsible',defaultResp)}
     ${field('Último Acesso','pt_last_access',p.lastAccess,'date')}
     ${field('Última Atualização','pt_last_update',p.lastUpdate || today(),'date')}
     ${field('Validade / Vencimento','pt_expiry',p.expiryDate,'date')}
     <div class="field full">${field('Observações','pt_obs',p.obs,'textarea',null,true)}</div>
    </div>
   </div>

   ${id ? `
   <div style="background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:15px;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;border-bottom:1px solid var(--line);padding-bottom:6px;flex-wrap:wrap;gap:6px;">
     <h3 style="margin:0;font-size:14px;color:var(--text);">◷ 4. Histórico de Alterações deste Portal</h3>
     <button type="button" class="btn small primary" onclick="closeModal(); openPortalHistoryModal(null, '${p.id}')">＋ Registrar Alteração</button>
    </div>
    ${pHistory.length ? `
     <div class="table-wrap">
      <table style="min-width:500px;">
       <thead><tr><th>Data</th><th>Tipo</th><th>Descrição / Motivo</th><th>Responsável</th><th>Concluído</th></tr></thead>
       <tbody>
        ${pHistory.map(h => `
         <tr>
          <td>${fmtDate(h.date)}</td>
          <td><span class="pill">${esc(h.type)}</span></td>
          <td>${esc(h.description || '—')}</td>
          <td>${esc(h.responsible || '—')}</td>
          <td><span class="pill ${h.done ? 'green' : 'amber'}">${h.done ? 'Sim' : 'Não'}</span></td>
         </tr>
        `).join('')}
       </tbody>
      </table>
     </div>
    ` : '<div class="empty" style="padding:15px;font-size:12px;">Nenhuma alteração registrada no histórico para este portal ainda.</div>'}
   </div>
   ` : ''}
  </div>
 `, () => {
  let name = val('pt_name');
  if(!name){ alert('Informe o nome do portal.'); return; }
  let recordId = p.id ? p.id : generateCustomId('PT', db.portals);
  let data = {
   id: recordId,
   name,
   company: val('pt_company'),
   category: val('pt_category'),
   segment: val('pt_segment'),
   cnpj: val('pt_cnpj'),
   createdDate: val('pt_created'),
   link: val('pt_link'),
   docsLink: val('pt_docs_link'),
   login: val('pt_login'),
   password: val('pt_password'),
   email: val('pt_email'),
   phone: val('pt_phone'),
   status: val('pt_status'),
   responsible: val('pt_responsible'),
   lastAccess: val('pt_last_access'),
   lastUpdate: val('pt_last_update'),
   expiryDate: val('pt_expiry'),
   obs: val('pt_obs')
  };

  if(p.id){
   db.portals = db.portals.map(x => x.id === id ? data : x);
  } else {
   db.portals.unshift(data);
   db.portalHistory.unshift({
    id: generateCustomId('PH', db.portalHistory),
    date: data.createdDate || today(),
    portalId: recordId,
    portalName: name,
    type: 'Cadastro',
    description: 'Cadastro inicial do portal no sistema.',
    responsible: data.responsible,
    nextAction: '',
    deadline: '',
    done: true
   });
  }

  saveDB(); closeModal(); render();
 });
}

function deletePortal(id){
 requireAdminAuth('excluir este portal', () => {
  db.portals = (db.portals || []).filter(p => p.id !== id);
  saveDB(); render();
 });
}

function openPortalHistoryModal(editId = null, preselectedPortalId = null){
 if(!db.portals) db.portals = [];
 if(!db.portalHistory) db.portalHistory = [];
 if(db.portals.length === 0){
  alert('Cadastre primeiro um portal na Base de Portais antes de registrar um histórico.');
  return;
 }

 let h = editId ? db.portalHistory.find(x => x.id === editId) : null;
 let selectedPortalId = h ? h.portalId : (preselectedPortalId || db.portals[0].id);
 let defaultResp = h ? h.responsible : (currentUser ? currentUser.name : '');

 openModal(h ? 'Editar Registro de Histórico' : 'Registrar Alteração no Portal', `
  <div style="display:flex;flex-direction:column;gap:15px;">
   <div style="background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:15px;">
    <h3 style="margin:0 0 12px 0;font-size:14px;color:var(--text);border-bottom:1px solid var(--line);padding-bottom:6px;">📌 1. Dados da Alteração</h3>
    <div class="form-grid">
     ${field('Data *','ph_date', h ? h.date : today(),'date')}
     <div class="field">
      <label>Portal *</label>
      <select id="ph_portal">
       ${db.portals.map(p => `<option value="${esc(p.id)}" ${p.id === selectedPortalId ? 'selected' : ''}>${esc(p.name)} (${esc(p.id)})</option>`).join('')}
      </select>
     </div>
     ${field('Tipo de Alteração','ph_type', h ? h.type : 'Atualização cadastral','text',portalHistoryTypes)}
     ${field('Responsável','ph_responsible', defaultResp)}
     <div class="field full">${field('Descrição / Motivo *','ph_desc', h ? h.description : '','textarea',null,true)}</div>
    </div>
   </div>

   <div style="background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:15px;">
    <h3 style="margin:0 0 12px 0;font-size:14px;color:var(--text);border-bottom:1px solid var(--line);padding-bottom:6px;">🕒 2. Acompanhamento</h3>
    <div class="form-grid">
     ${field('Próxima Ação','ph_next', h ? h.nextAction : '')}
     ${field('Prazo','ph_deadline', h ? h.deadline : '','date')}
     <div class="field">
      <label>Concluído?</label>
      <select id="ph_done">
       <option value="false" ${h && !h.done ? 'selected' : (!h ? 'selected' : '')}>Não</option>
       <option value="true" ${h && h.done ? 'selected' : ''}>Sim</option>
      </select>
     </div>
    </div>
   </div>
  </div>
 `, () => {
  let portalId = val('ph_portal');
  let portalObj = db.portals.find(p => p.id === portalId);
  let desc = val('ph_desc');
  let dateVal = val('ph_date') || today();
  let typeVal = val('ph_type');
  if(!portalObj){ alert('Selecione um portal válido.'); return; }
  if(!desc){ alert('Informe a descrição ou motivo da alteração.'); return; }

  let recordId = h ? h.id : generateCustomId('PH', db.portalHistory);
  let data = {
   id: recordId,
   date: dateVal,
   portalId: portalObj.id,
   portalName: portalObj.name,
   type: typeVal,
   description: desc,
   responsible: val('ph_responsible'),
   nextAction: val('ph_next'),
   deadline: val('ph_deadline'),
   done: val('ph_done') === 'true'
  };

  if(h){
   db.portalHistory = db.portalHistory.map(x => x.id === editId ? data : x);
  } else {
   db.portalHistory.unshift(data);
  }

  portalObj.lastUpdate = dateVal;
  if(typeVal === 'Acesso') portalObj.lastAccess = dateVal;
  if(typeVal === 'Bloqueio') portalObj.status = 'Bloqueado';
  if(typeVal === 'Desbloqueio') portalObj.status = 'Ativo';

  saveDB(); closeModal(); render();
 });
}

function deletePortalHistory(id){
 requireAdminAuth('excluir este registro do histórico de portais', () => {
  db.portalHistory = (db.portalHistory || []).filter(h => h.id !== id);
  saveDB(); render();
 });
}
/* ============================================================================ */

let petronectViewMode = 'table';

function petronectPage(root){
 root.innerHTML=head('Portal Petronect','Gerenciamento de editais, prazos de postagem e precificação de propostas.',`
  <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
   <div style="background:var(--line);padding:3px;border-radius:8px;display:flex;gap:3px;">
    <button class="btn small ${petronectViewMode==='table'?'primary':''}" onclick="petronectViewMode='table';render()">📋 Tabela</button>
    <button class="btn small ${petronectViewMode==='kanban'?'primary':''}" onclick="petronectViewMode='kanban';render()">📊 Kanban</button>
   </div>
   <button class="btn primary" onclick="openPetronectModal()">＋ Novo Edital Petronect</button>
  </div>
 `)+toolbar('Buscar edital, oportunidade, cidade ou item...',`<select id="petronectStatusFilter"><option value="">Todos os status</option>${petronectStatusOptions.map(s=>`<option>${s}</option>`).join('')}</select>`)+`<div id="petronectContent"></div>`;

 const draw=()=>{
  let q=$('#search').value.toLowerCase(),s=$('#petronectStatusFilter').value;
  let arr=db.petronect.filter(p=>{
   let itemText=(p.items||[]).map(i=>i.itemCode+' '+i.summary+' '+i.obs).join(' ');
   let matchText=[p.id,p.opportunity,p.city,p.uf,p.closingDate,itemText].join(' ').toLowerCase();
   return matchText.includes(q)&&(!s||p.status===s);
  });

  let container = $('#petronectContent');
  if(!container) return;

  if(petronectViewMode === 'table'){
   container.innerHTML = `<div class="panel"><div class="table-wrap"><table><thead><tr><th>ID</th><th>Data</th><th>Oportunidade / Edital</th><th>Participar?</th><th>Status Petronect</th><th>Encerramento</th><th>Trimestre</th><th>Cidade/UF</th><th>Ações</th></tr></thead><tbody id="petronectRows"></tbody></table></div></div>`;
   let rowsEl = $('#petronectRows');
   rowsEl.innerHTML = arr.length ? arr.map(p=>{
    let isDeclined = p.status === 'Declinada';
    let isExpired = p.closingDate && p.closingDate < today() && !['Ganha','Perdida','Declinada','Encerrada'].includes(p.status);
    let isTomorrow = p.closingDate && (new Date(p.closingDate+'T12:00:00') - new Date(today()+'T12:00:00') === 86400000) && p.status !== 'Declinada';
    let docsChecked = (p.checklist || []).length;

    return `
     <tr style="${isDeclined?'opacity:0.4;text-decoration:line-through;':''}">
      <td><code style="font-size:12px;background:var(--line);padding:2px 6px;border-radius:4px;color:var(--text);font-weight:700;">${esc(p.id)}</code></td>
      <td>${fmtDate(p.date)}</td>
      <td>
       <b>${esc(p.opportunity)}</b>
       ${docsChecked > 0 ? `<div class="muted" style="font-size:10px;">Docs: ${docsChecked}/${petronectChecklistItems.length}</div>` : ''}
      </td>
      <td><span class="pill ${pillClass(p.participate||'Pendente')}">${esc(p.participate||'Pendente')}</span></td>
      <td>
       <span class="pill ${pillClass(p.status)}">${esc(p.status)}</span>
       ${p.status === 'Perdida' && p.lossReason ? `<div class="muted" style="font-size:10px;margin-top:2px;">Motivo: ${esc(p.lossReason)}</div>` : ''}
      </td>
      <td>${fmtDate(p.closingDate)} ${p.closingTime?'('+p.closingTime+')':''} ${isExpired?'<span class="pill red" style="font-size:10px;">Vencido</span>':''} ${isTomorrow?'<span class="pill amber" style="font-size:10px;">Vence Amanhã</span>':''}</td>
      <td><b>${esc(p.quarter||'—')}</b></td>
      <td>${esc(p.city||'—')}${p.uf?'/'+esc(p.uf):''}</td>
      <td>
       <div style="display:flex;gap:4px;">
        <button class="btn small" onclick="exportToOutlook('Edital Petronect: ${esc(p.opportunity)}', '${p.closingDate}', 'Prazo final de envio da proposta Petronect')" title="Outlook">📅</button>
        <button class="btn small" onclick="openPetronectModal('${p.id}')">Editar</button>
        <button class="btn small danger" onclick="deletePetronect('${p.id}')">✕</button>
       </div>
      </td>
     </tr>
    `;
   }).join('') : `<tr><td colspan="9"><div class="empty"><b>Nenhum edital Petronect encontrado</b>Cadastre um novo edital para iniciar.</div></td></tr>`;
  } else {
   container.innerHTML = `
    <div class="kanban-board">
     ${petronectStatusOptions.map(status=>{
      let colItems = arr.filter(p=>p.status===status);
      return `
       <div class="kanban-col" ondragover="event.preventDefault()" ondrop="dropPetronect(event, '${status}')">
        <h4><span>${esc(status)}</span> <span class="pill">${colItems.length}</span></h4>
        <div class="kanban-cards">
         ${colItems.map(p=>`
          <div class="kanban-card" draggable="true" ondragstart="dragPetronect(event, '${p.id}')" style="${p.status==='Declinada'?'opacity:0.5;text-decoration:line-through;':''}">
           <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
            <code style="font-size:11px;font-weight:bold;color:var(--text);">${esc(p.id)}</code>
            <span class="pill ${pillClass(p.participate||'Pendente')}" style="font-size:10px;padding:2px 6px;">Part: ${esc(p.participate||'Pendente')}</span>
           </div>
           <b style="font-size:13px;display:block;margin-bottom:4px;">${esc(p.opportunity)}</b>
           <div class="muted" style="font-size:12px;margin-bottom:8px;">Prazo: ${fmtDate(p.closingDate)}</div>
           <div style="display:flex;justify-content:flex-end;gap:4px;">
            <button class="btn small" onclick="exportToOutlook('Edital: ${esc(p.opportunity)}', '${p.closingDate}', 'Prazo edital')">📅</button>
            <button class="btn small" onclick="openPetronectModal('${p.id}')">Editar</button>
           </div>
          </div>
         `).join('')}
        </div>
       </div>
      `;
     }).join('')}
    </div>
   `;
  }
 };

 $('#search').oninput=draw;
 $('#petronectStatusFilter').onchange=draw;
 draw();
}

let draggedPetronectId = null;
function dragPetronect(e, id){ draggedPetronectId = id; }
function dropPetronect(e, newStatus){
 e.preventDefault();
 if(!draggedPetronectId) return;
 let item = db.petronect.find(p=>p.id === draggedPetronectId);
 if(item){
  if(newStatus === 'Perdida' && !item.lossReason){
   draggedPetronectId = null;
   openPetronectModal(item.id, 'Perdida');
   return;
  }
  item.status = newStatus;
  saveDB(); render();
 }
 draggedPetronectId = null;
}
function deletePetronect(id){
 requireAdminAuth('excluir este edital Petronect', () => {
  db.petronect = db.petronect.filter(p=>p.id !== id);
  saveDB();
  render();
 });
}

let currentPetronectItems = [];

function updatePetronectFinanceSummary(){
 let box = $('#pnFinanceSummaryBox');
 if(!box) return;
 let isParticipating = $('#pn_participate') ? $('#pn_participate').value === 'Sim' : false;
 if(!isParticipating || currentPetronectItems.length === 0){
  box.style.display = 'none';
  return;
 }
 box.style.display = 'grid';

 let totalRevenue = 0;
 let totalCost = 0;

 currentPetronectItems.forEach(item => {
  let qty = Number(item.qty) || 1;
  let unit = (item.unit || '').trim().toLowerCase();
  let volume = Number(item.volume) || 1;
  let isLiter = unit.includes('litro') || unit.includes('ml') || unit.includes('mililitro');
  let calcQty = isLiter ? (volume > 0 ? (qty / volume) : qty) : qty;

  let fullPrice = Number(item.fullPrice) || 0;
  let icmsDiscountFactor = Number(item.icmsDiscountFactor) || 1;
  let discountPct = Number(item.discountPct) || 0;
  let costPrice = Number(item.costPrice) || 0;

  let finalUnitPrice = (fullPrice * icmsDiscountFactor) * (1 - (discountPct / 100));
  totalRevenue += finalUnitPrice * calcQty;
  totalCost += costPrice * calcQty;
 });

 let netProfit = totalRevenue - totalCost;
 let avgMargin = (totalRevenue > 0 && totalCost > 0) ? ((netProfit / totalRevenue) * 100).toFixed(1) + '%' : '—';
 let marginColor = (totalRevenue > 0 && totalCost > 0 && (netProfit / totalRevenue) < 0.1) ? 'var(--red)' : 'var(--green)';

 box.innerHTML = `
  <div class="pn-fin-box"><small>Receita Total Proposta</small><strong>${money(totalRevenue)}</strong></div>
  <div class="pn-fin-box"><small>Custo Total Estimado</small><strong>${totalCost > 0 ? money(totalCost) : '—'}</strong></div>
  <div class="pn-fin-box"><small>Lucro Bruto Estimado</small><strong style="color:${totalCost > 0 ? marginColor : 'var(--text)'};">${totalCost > 0 ? money(netProfit) : '—'}</strong></div>
  <div class="pn-fin-box"><small>Margem Média</small><strong style="color:${marginColor};">${avgMargin}</strong></div>
 `;
}

function renderPetronectItems(){
 let isParticipating = $('#pn_participate') ? $('#pn_participate').value === 'Sim' : false;
 let container = $('#petronectItemsContainer');
 if(!container) return;

 container.innerHTML = currentPetronectItems.map((item, index)=>{
  let qty = Number(item.qty) || 1;
  let unit = (item.unit || '').trim();
  let volume = Number(item.volume) || 1;
  let unitLower = unit.toLowerCase();
  
  let isLiter = unitLower.includes('litro') || unitLower.includes('ml') || unitLower.includes('mililitro');
  let computedTotalQty = isLiter ? (volume > 0 ? (qty / volume).toFixed(2) : qty) : qty;

  let fullPrice = Number(item.fullPrice) || 0;
  let icmsDiscountFactor = Number(item.icmsDiscountFactor) || 1; 
  let discountPct = Number(item.discountPct) || 0; 
  let costPrice = Number(item.costPrice) || 0;

  let stepIcmsVal = fullPrice * icmsDiscountFactor;
  let finalPrice = stepIcmsVal * (1 - (discountPct / 100));
  let pricePerLiter = isLiter ? (volume > 0 ? (finalPrice / volume) : 0) : 0;
  
  let profitMargin = costPrice > 0 ? (((finalPrice - costPrice) / finalPrice) * 100).toFixed(1) : '—';
  let marginColor = (profitMargin !== '—' && Number(profitMargin) < 10) ? 'var(--red)' : 'var(--green)';

  if(!isParticipating){
   return `
    <div class="product-item-row" data-index="${index}">
     <div class="product-item-grid" style="display:grid;grid-template-columns: 80px 2.5fr 100px 110px 90px 110px 130px 40px;gap:6px;align-items:end;min-width:760px;">
      <div class="field"><label>Item</label><input type="text" value="${esc(item.itemCode||'')}" oninput="updatePetronectItem(${index}, 'itemCode', this.value)" placeholder="Ex: 01"></div>
      <div class="field"><label>Descritivo</label><input type="text" value="${esc(item.summary)}" oninput="updatePetronectItem(${index}, 'summary', this.value)" placeholder="Especificação técnica"></div>
      <div class="field"><label>Quantidade</label><input type="number" value="${qty}" oninput="updatePetronectItem(${index}, 'qty', this.value)"></div>
      <div class="field"><label>Unidade</label><input type="text" value="${esc(unit)}" oninput="updatePetronectItem(${index}, 'unit', this.value)" placeholder="Litros, Galão"></div>
      <div class="field"><label>Volume (L)</label><input type="number" step="0.01" value="${volume}" oninput="updatePetronectItem(${index}, 'volume', this.value)"></div>
      <div class="field"><label>Cor do Item</label><input type="text" value="${esc(item.color||'')}" oninput="updatePetronectItem(${index}, 'color', this.value)"></div>
      <div class="field"><label>Total Calc</label><input type="text" readonly value="${computedTotalQty} ${isLiter?'L':unit}" style="background:var(--line);font-weight:700;"></div>
      <div style="padding-bottom:2px;"><button type="button" class="btn small danger" onclick="removePetronectItem(${index})">✕</button></div>
     </div>
    </div>
   `;
  } else {
   return `
    <div class="product-item-row" data-index="${index}">
     <div class="pricing-item-grid">
      <div class="field"><label>Item</label><input type="text" value="${esc(item.itemCode||'')}" oninput="updatePetronectItem(${index}, 'itemCode', this.value)"></div>
      <div class="field"><label>Descritivo</label><input type="text" value="${esc(item.summary)}" oninput="updatePetronectItem(${index}, 'summary', this.value)"></div>
      <div class="field"><label>Qtd</label><input type="number" value="${qty}" oninput="updatePetronectItem(${index}, 'qty', this.value)"></div>
      <div class="field"><label>Unid</label><input type="text" value="${esc(unit)}" oninput="updatePetronectItem(${index}, 'unit', this.value)"></div>
      <div class="field"><label>Vol (L)</label><input type="number" step="0.01" value="${volume}" oninput="updatePetronectItem(${index}, 'volume', this.value)"></div>
      <div class="field"><label>Cor</label><input type="text" value="${esc(item.color||'')}" oninput="updatePetronectItem(${index}, 'color', this.value)"></div>
      <div class="field"><label>Preço Cheio</label><input type="number" step="0.01" value="${fullPrice}" oninput="updatePetronectItem(${index}, 'fullPrice', this.value)"></div>
      <div class="field"><label>Fator ICMS</label><input type="number" step="0.01" value="${icmsDiscountFactor}" oninput="updatePetronectItem(${index}, 'icmsDiscountFactor', this.value)"></div>
      <div class="field"><label>Desc (%)</label><input type="number" step="0.1" value="${discountPct}" oninput="updatePetronectItem(${index}, 'discountPct', this.value)"></div>
      <div class="field"><label>Custo Base</label><input type="number" step="0.01" value="${costPrice}" oninput="updatePetronectItem(${index}, 'costPrice', this.value)"></div>
      <div style="padding-bottom:2px;"><button type="button" class="btn small danger" onclick="removePetronectItem(${index})">✕</button></div>
     </div>
     <div style="margin-top:6px;font-size:11px;color:var(--text);display:flex;justify-content:space-between;border-top:1px dashed var(--line);padding-top:4px;flex-wrap:wrap;gap:8px;">
      <span>Total Qtd: <b>${computedTotalQty} ${isLiter?'L':unit}</b></span>
      <span>Base c/ ICMS: <b>${money(stepIcmsVal)}</b></span>
      <span>Preço Final c/ Desconto: <b style="color:var(--green);">${money(finalPrice)}</b></span>
      <span>Preço/Litro: <b>${isLiter ? money(pricePerLiter) + ' / L' : 'N/A'}</b></span>
      <span>Margem Lucro: <b style="color:${marginColor};">${profitMargin}${profitMargin!=='—'?'%':''}</b></span>
     </div>
    </div>
   `;
  }
 }).join('') || '<div class="empty" style="padding:15px;font-size:13px;">Nenhum item cadastrado. Clique no botão abaixo para incluir.</div>';

 updatePetronectFinanceSummary();
}

function addPetronectItem(){
 currentPetronectItems.push({itemCode:'', summary:'', qty:141.8, unit:'Litros', volume:3.6, color:'', fullPrice:692.36, icmsDiscountFactor:0.82, discountPct:35, costPrice:0});
 renderPetronectItems();
}

function removePetronectItem(index){
 currentPetronectItems.splice(index, 1);
 renderPetronectItems();
}

function updatePetronectItem(index, fieldName, val){
 if(currentPetronectItems[index]){
  currentPetronectItems[index][fieldName] = val;
  updatePricingRowCalculations(index);
  updatePetronectFinanceSummary();
 }
}

function updatePricingRowCalculations(index){
 let item = currentPetronectItems[index];
 let row = document.querySelector(`.product-item-row[data-index="${index}"]`);
 if(!row || !item) return;

 let qty = Number(item.qty) || 1;
 let unit = (item.unit || '').trim();
 let volume = Number(item.volume) || 1;
 let unitLower = unit.toLowerCase();
 let isLiter = unitLower.includes('litro') || unitLower.includes('ml') || unitLower.includes('mililitro');
 let computedTotalQty = isLiter ? (volume > 0 ? (qty / volume).toFixed(2) : qty) : qty;

 let fullPrice = Number(item.fullPrice) || 0;
 let icmsDiscountFactor = Number(item.icmsDiscountFactor) || 1;
 let discountPct = Number(item.discountPct) || 0;
 let costPrice = Number(item.costPrice) || 0;

 let stepIcmsVal = fullPrice * icmsDiscountFactor;
 let finalPrice = stepIcmsVal * (1 - (discountPct / 100));
 let pricePerLiter = isLiter ? (volume > 0 ? (finalPrice / volume) : 0) : 0;
 let profitMargin = costPrice > 0 ? (((finalPrice - costPrice) / finalPrice) * 100).toFixed(1) : '—';
 let marginColor = (profitMargin !== '—' && Number(profitMargin) < 10) ? 'var(--red)' : 'var(--green)';

 let spans = row.querySelectorAll('div[style*="margin-top"] span');
 if(spans.length >= 5){
  spans[0].innerHTML = `Total Qtd: <b>${computedTotalQty} ${isLiter?'L':unit}</b>`;
  spans[1].innerHTML = `Base c/ ICMS: <b>${money(stepIcmsVal)}</b>`;
  spans[2].innerHTML = `Preço Final c/ Desconto: <b style="color:var(--green);">${money(finalPrice)}</b>`;
  spans[3].innerHTML = `Preço/Litro: <b>${isLiter ? money(pricePerLiter) + ' / L' : 'N/A'}</b>`;
  spans[4].innerHTML = `Margem Lucro: <b style="color:${marginColor};">${profitMargin}${profitMargin!=='—'?'%':''}</b>`;
 }
}

function computeQuarter(dateStr){
 if(!dateStr) return '';
 let month = parseInt(dateStr.split('-')[1], 10);
 if(month >= 1 && month <= 3) return 'Q1';
 if(month >= 4 && month <= 6) return 'Q2';
 if(month >= 7 && month <= 9) return 'Q3';
 return 'Q4';
}

function handleClosingDateChange(dateVal){
 let qVal = computeQuarter(dateVal);
 if($('#pn_quarter')) $('#pn_quarter').value = qVal;
}

function toggleParticipationBlock(val){ renderPetronectItems(); }
function toggleAccordion(id){ $('#'+id).classList.toggle('show'); }

function togglePetronectLossReason(statusVal){
 let wrap = $('#pnLossReasonWrap');
 if(wrap) wrap.style.display = statusVal === 'Perdida' ? 'flex' : 'none';
}

function openPetronectModal(id=null, forceStatus=null){
 let p = db.petronect.find(x=>x.id===id)||{};
 let currentStatus = forceStatus || p.status || 'Analisando';
 let savedChecklist = Array.isArray(p.checklist) ? p.checklist : [];
 currentPetronectItems = p.items ? JSON.parse(JSON.stringify(p.items)) : [];

 openModal(id?'Editar Edital Petronect':'Novo Edital Petronect',`
  <div style="display:flex;flex-direction:column;gap:15px;">
   ${id?`<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;"><div class="field" style="flex:1;"><label>ID do Registro</label><input type="text" readonly value="${esc(p.id)}" style="background:var(--line);font-weight:700;"></div><div><button type="button" class="btn primary" onclick="generatePetronectPDF('${p.id}')">📄 Gerar Proposta PDF</button></div></div>`:''}
   
   <div style="background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:15px;">
    <h3 style="margin:0 0 12px 0;font-size:14px;color:var(--text);border-bottom:1px solid var(--line);padding-bottom:6px;">📌 1. Informações do Edital e Decisão</h3>
    <div class="form-grid">
     ${field('Data de Cadastro','pn_date',p.date||today(),'date')}
     <div class="field">
      <label>Status Petronect</label>
      <select id="pn_status" onchange="togglePetronectLossReason(this.value)">
       ${petronectStatusOptions.map(s=>`<option ${s===currentStatus?'selected':''}>${esc(s)}</option>`).join('')}
      </select>
     </div>
     <div class="field full" id="pnLossReasonWrap" style="display:${currentStatus==='Perdida'?'flex':'none'};">
      <label style="color:var(--red);">Motivo da Perda do Edital *</label>
      <select id="pn_loss_reason">
       <option value="">Selecione o motivo...</option>
       ${lossReasonOptions.map(r=>`<option ${r===p.lossReason?'selected':''}>${esc(r)}</option>`).join('')}
      </select>
     </div>
     <div class="field"><label>Vai Participar?</label><select id="pn_participate" onchange="toggleParticipationBlock(this.value)"><option ${p.participate==='Pendente'?'selected':''}>Pendente</option><option ${p.participate==='Sim'?'selected':''}>Sim</option><option ${p.participate==='Não'?'selected':''}>Não</option></select></div>
     ${field('Oportunidade / Número do Edital','pn_opportunity',p.opportunity)}
     ${field('Data de Encerramento','pn_closing',p.closingDate,'date')}
     <div class="field"><label>Trimestre (Automático)</label><input id="pn_quarter" type="text" readonly value="${esc(p.quarter||'Q1')}" style="background:var(--line);font-weight:700;"></div>
     ${field('Hora Limite','pn_time',p.closingTime||'23:59','time')}
     ${field('Prazo de Entrega Proposta','pn_delivery',p.deliveryTime||'30 dias','text')}
     ${field('Cidade','pn_city',p.city)}
     ${field('UF','pn_uf',p.uf)}
    </div>
   </div>

   <div style="background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:15px;">
    <h3 style="margin:0 0 12px 0;font-size:14px;color:var(--text);border-bottom:1px solid var(--line);padding-bottom:6px;">✅ 2. Checklist de Documentação & Habilitação</h3>
    <div class="doc-checklist-grid">
     ${petronectChecklistItems.map((docLabel, idx) => `
      <label class="doc-check-card">
       <input type="checkbox" class="pn-doc-chk" value="${esc(docLabel)}" ${savedChecklist.includes(docLabel) ? 'checked' : ''}>
       <span>${esc(docLabel)}</span>
      </label>
     `).join('')}
    </div>
   </div>

   <div style="background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:15px;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;border-bottom:1px solid var(--line);padding-bottom:6px;flex-wrap:wrap;gap:6px;">
     <h3 style="margin:0;font-size:14px;color:var(--text);">📦 3. Itens / Descritivo do Edital (Proposta)</h3>
     <button type="button" class="btn small primary" onclick="addPetronectItem()">＋ Adicionar Item</button>
    </div>
    <div id="pnFinanceSummaryBox" class="pn-finance-bar" style="display:none;"></div>
    <div id="petronectItemsContainer" style="max-height:380px;overflow-y:auto;border:1px solid var(--line);padding:10px;border-radius:8px;background:var(--surface);"></div>
   </div>

   <div style="background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:15px;">
    <h3 style="margin:0 0 12px 0;font-size:14px;color:var(--text);border-bottom:1px solid var(--line);padding-bottom:6px;">📝 4. Observações</h3>
    <div class="form-grid"><div class="field full">${field('Observações','pn_obs',p.obs,'textarea',null,true)}</div></div>
   </div>
  </div>
 `,()=>{
  let opp = val('pn_opportunity');
  if(!opp){alert('Informe a oportunidade / número do edital.');return}
  let statusVal = val('pn_status');
  let lossReasonVal = val('pn_loss_reason');
  if(statusVal === 'Perdida' && !lossReasonVal){
   alert('Informe o motivo da perda do edital antes de salvar.');
   return;
  }

  let checkedDocs = [...document.querySelectorAll('.pn-doc-chk:checked')].map(el => el.value);
  let closingVal = val('pn_closing');
  let quarterVal = computeQuarter(closingVal);
  let recordId = p.id ? p.id : generateCustomId('PN', db.petronect);

  let data = {
   id: recordId,
   date: val('pn_date'),
   status: statusVal,
   lossReason: statusVal === 'Perdida' ? lossReasonVal : '',
   participate: val('pn_participate'),
   opportunity: opp,
   closingDate: closingVal,
   quarter: quarterVal,
   closingTime: val('pn_time'),
   deliveryTime: val('pn_delivery'),
   city: val('pn_city'),
   uf: val('pn_uf').toUpperCase(),
   checklist: checkedDocs,
   items: currentPetronectItems,
   obs: val('pn_obs')
  };

  if(p.id) db.petronect = db.petronect.map(x=>x.id===id?data:x);
  else db.petronect.unshift(data);

  saveDB(); closeModal(); render();
 });

 renderPetronectItems();
 if($('#pn_closing')) $('#pn_closing').oninput = e => handleClosingDateChange(e.target.value);
}

function companiesPage(root){
 root.innerHTML=head('Empresas','Sua base de contas e potenciais clientes.',`<button class="btn primary" onclick="openCompany()">＋ Nova empresa</button>`)+toolbar('Buscar por empresa, CNPJ, cidade ou segmento...')+`<div class="panel"><div class="table-wrap"><table><thead><tr><th>ID</th><th>Empresa</th><th>CNPJ</th><th>Segmento</th><th>Localização</th><th>Oportunidades</th><th>Contato</th><th>Ações</th></tr></thead><tbody id="rows"></tbody></table></div></div>`;
 const draw=()=>{let q=$('#search').value.toLowerCase(),arr=db.companies.filter(c=>[c.id,c.name,c.cnpj,c.segment,c.city].join(' ').toLowerCase().includes(q));$('#rows').innerHTML=arr.length?arr.map(c=>`<tr><td><code style="font-size:12px;background:var(--line);padding:2px 6px;border-radius:4px;color:var(--text);font-weight:700;">${esc(c.id)}</code></td><td><b>${esc(c.name)}</b><div class="muted">${esc(c.trade||'')}</div></td><td>${esc(c.cnpj||'—')}</td><td>${esc(c.segment||'—')}</td><td>${esc(c.city||'—')}${c.uf?'/'+esc(c.uf):''}</td><td>${db.opportunities.filter(o=>o.companyId===c.id).length}</td><td>${esc(c.phone||c.email||'—')}</td><td><div style="display:flex;gap:5px;"><button class="btn small" onclick="editCompany('${c.id}')">Editar</button><button class="btn small danger" onclick="deleteCompany('${c.id}')">Excluir</button></div></td></tr>`).join(''):'<tr><td colspan="8"><div class="empty">Nenhuma empresa cadastrada.</div></td></tr>'};$('#search').oninput=draw;draw();
}

function contactsPage(root){
 root.innerHTML=head('Contatos','Compradores, suprimentos, engenharia e responsáveis por homologação.',`<button class="btn primary" onclick="openContact()">＋ Novo contato</button>`)+toolbar('Buscar nome, empresa, cargo, e-mail...')+`<div class="panel"><div class="table-wrap"><table><thead><tr><th>ID</th><th>Nome</th><th>Empresa</th><th>Cargo / área</th><th>Telefone</th><th>E-mail</th><th>Último contato</th><th>Ações</th></tr></thead><tbody id="rows"></tbody></table></div></div>`;
 const draw=()=>{let q=$('#search').value.toLowerCase(),arr=db.contacts.filter(c=>[c.id,c.name,c.company,c.role,c.email,c.phone].join(' ').toLowerCase().includes(q));$('#rows').innerHTML=arr.length?arr.map(c=>`<tr><td><code style="font-size:12px;background:var(--line);padding:2px 6px;border-radius:4px;color:var(--text);font-weight:700;">${esc(c.id)}</code></td><td><b>${esc(c.name)}</b></td><td>${esc(c.company||'—')}</td><td>${esc(c.role||'—')}</td><td>${esc(c.phone||'—')}</td><td>${esc(c.email||'—')}</td><td>${fmtDate(c.lastDate)}</td><td><div style="display:flex;gap:5px;"><button class="btn small" onclick="editContact('${c.id}')">Editar</button><button class="btn small danger" onclick="deleteContact('${c.id}')">Excluir</button></div></td></tr>`).join(''):'<tr><td colspan="8"><div class="empty">Nenhum contato cadastrado.</div></td></tr>'};$('#search').oninput=draw;draw();
}

function activitiesPage(root){
 root.innerHTML=head('Tarefas e Histórico de Atividades','Gerencie suas pendências do dia a dia (To-Do) e o histórico comercial.',`<button class="btn primary" onclick="openActivity()">＋ Nova tarefa / atividade</button>`)+toolbar('Buscar tarefa, planilha, empresa, contato ou resumo...',`<select id="actStatusFilter"><option value="all">Todas (Pendentes e Concluídas)</option><option value="pending" selected>Apenas Pendentes (To-Do)</option><option value="done">Concluídas</option></select><select id="actTypeFilter"><option value="">Todos os tipos</option>${activityTypes.map(t=>`<option>${t}</option>`).join('')}</select>`)+`<div class="panel"><div class="table-wrap"><table><thead><tr><th style="width:45px;text-align:center;">Feito</th><th>ID</th><th>Data</th><th>Tarefa / Assunto</th><th>Vínculo / Empresa</th><th>Tipo</th><th>Detalhes / Andamento</th><th>Prazo / Próximo passo</th><th>Ações</th></tr></thead><tbody id="rows"></tbody></table></div></div>`;
 const draw=()=>{
  let q=$('#search').value.toLowerCase();
  let st=$('#actStatusFilter').value;
  let tp=$('#actTypeFilter').value;
  let arr=[...db.activities].sort((a,b)=>(b.date||'').localeCompare(a.date||'')).filter(a=>{
   let matchQ=[a.id,a.title,a.company,a.contact,a.type,a.summary,a.next].join(' ').toLowerCase().includes(q);
   let matchSt=st==='all' || (st==='pending' && !a.done) || (st==='done' && a.done);
   let matchTp=!tp || a.type===tp;
   return matchQ && matchSt && matchTp;
  });
  $('#rows').innerHTML=arr.length?arr.map(a=>{
   let isGeral = !a.company || a.company === 'Geral / Interno';
   let mainTitle = a.title || a.summary || a.type;
   return `
    <tr style="${a.done?'opacity:0.55;background:var(--bg);':''}">
     <td style="text-align:center;"><input type="checkbox" ${a.done?'checked':''} onchange="toggleActivityDone('${a.id}')" title="Marcar como concluída"></td>
     <td><code style="font-size:12px;background:var(--line);padding:2px 6px;border-radius:4px;color:var(--text);font-weight:700;">${esc(a.id)}</code></td>
     <td>${fmtDate(a.date)}</td>
     <td><b style="${a.done?'text-decoration:line-through;':''}">${esc(mainTitle)}</b>${a.contact?`<div class="muted" style="font-size:12px;">Contato: ${esc(a.contact)}</div>`:''}</td>
     <td>${isGeral?'<span class="pill blue">Geral / Interno</span>':`<b>${esc(a.company)}</b>`}</td>
     <td><span class="pill">${esc(a.type)}</span></td>
     <td>${esc(a.summary||'—')}</td>
     <td>${a.nextDate?`<div><b>${fmtDate(a.nextDate)}</b></div>`:''}<span class="muted">${esc(a.next||'—')}</span></td>
     <td>
      <div style="display:flex;gap:5px;">
       <button class="btn small" onclick="editActivity('${a.id}')">Editar</button>
       <button class="btn small danger" onclick="deleteActivity('${a.id}')">Excluir</button>
      </div>
     </td>
    </tr>
   `;
  }).join(''):'<tr><td colspan="9"><div class="empty"><b>Nenhuma tarefa ou atividade encontrada</b>Clique em "+ Nova tarefa / atividade" para registrar.</div></td></tr>';
 };
 $('#search').oninput=draw;$('#actStatusFilter').onchange=draw;$('#actTypeFilter').onchange=draw;draw();
}

function vendorPage(root){
 let arr=db.opportunities.filter(o=>o.vendor&&o.vendor!=='Não iniciado'&&o.vendor!=='Não se aplica');
 root.innerHTML=head('Vendor List','Acompanhe cadastros, documentação e homologações de fornecedores.',`<button class="btn primary" onclick="setPage('opportunities')">＋ Gerenciar oportunidades</button>`)+`<div class="cards">${stat('Em mapeamento',arr.filter(o=>o.vendor==='Mapear requisitos').length,'⌕','Requisitos a identificar')}${stat('Documentação enviada',arr.filter(o=>o.vendor==='Documentação enviada').length,'⇧','Aguardando análise')}${stat('Em análise',arr.filter(o=>o.vendor==='Em análise').length,'◷','Processos pendentes')}${stat('Aprovados',arr.filter(o=>o.vendor==='Aprovado').length,'✓','Fornecedores homologados')}</div><div class="panel"><div class="table-wrap"><table><thead><tr><th>ID</th><th>Empresa</th><th>Quantidade de Itens</th><th>Status Vendor List</th><th>Status comercial</th><th>Próxima ação</th></tr></thead><tbody>${arr.length?arr.map(o=>`<tr><td><code style="font-size:12px;background:var(--line);padding:2px 6px;border-radius:4px;color:var(--text);font-weight:700;">${esc(o.id)}</code></td><td><b>${esc(o.company)}</b></td><td>${(o.products||[]).length} item(ns)</td><td><span class="pill ${pillClass(o.vendor)}">${esc(o.vendor)}</span></td><td>${esc(o.status)}</td><td>${esc(o.nextAction||'—')}</td></tr>`).join(''):'<tr><td colspan="6"><div class="empty">Nenhum processo de Vendor List iniciado.<br>Atualize o campo Vendor List nas oportunidades.</div></td></tr>'}</tbody></table></div></div>`;
}

function reportsPage(root){
 let currentYear = new Date().getFullYear();
 let years = [...new Set([...db.opportunities.map(o => (o.created||today()).slice(0,4)), ...db.petronect.map(p => (p.date||today()).slice(0,4))])].sort().reverse();
 if(!years.includes(String(currentYear))) years.unshift(String(currentYear));

 root.innerHTML=head('Relatórios','Visão analítica completa de vendas, prospecção, motivos de perda e pipeline comercial.',`
  <div style="display:flex;flex-wrap:wrap;align-items:center;gap:10px;">
   <div style="display:flex;align-items:center;gap:6px;"><label style="font-size:11px;font-weight:650;">De:</label><input type="date" id="reportStartDate" onchange="renderReportsData()" style="padding:6px;border:1px solid var(--line);border-radius:6px;background:var(--surface);font-size:12px;"></div>
   <div style="display:flex;align-items:center;gap:6px;"><label style="font-size:11px;font-weight:650;">Até:</label><input type="date" id="reportEndDate" onchange="renderReportsData()" style="padding:6px;border:1px solid var(--line);border-radius:6px;background:var(--surface);font-size:12px;"></div>
   <div style="display:flex;align-items:center;gap:6px;"><label style="font-size:11px;font-weight:650;">Ano:</label><select id="reportYearFilter" onchange="renderReportsData()"><option value="">Todos</option>${years.map(y=>`<option value="${y}" ${y==currentYear?'selected':''}>${y}</option>`).join('')}</select></div>
   <button class="btn small" onclick="resetReportFilters()">Limpar Filtros</button>
  </div>
 `)+
 `<div id="reportsContent"></div>`;
 renderReportsData();
}

function resetReportFilters(){
 if($('#reportStartDate')) $('#reportStartDate').value = '';
 if($('#reportEndDate')) $('#reportEndDate').value = '';
 if($('#reportYearFilter')) $('#reportYearFilter').value = new Date().getFullYear();
 renderReportsData();
}

function renderReportsData(){
 let startDate = $('#reportStartDate')?.value || '';
 let endDate = $('#reportEndDate')?.value || '';
 let selYear = $('#reportYearFilter')?.value || '';

 function filterItem(dtStr){
  let d = dtStr || today();
  if(startDate && d < startDate) return false;
  if(endDate && d > endDate) return false;
  let parts = d.split('-');
  let y = parts[0];
  if(selYear && y !== selYear) return false;
  return true;
 }

 let filteredOpps = db.opportunities.filter(o => filterItem(o.created || today()));
 let filteredPetronect = db.petronect.filter(p => filterItem(p.date || today()));

 let totalOpps = filteredOpps.length;
 let totalVal = filteredOpps.reduce((acc,o)=> acc + (Number(o.value)||0), 0);
 let activeClients = filteredOpps.filter(o=>o.status==='Cliente ativo').length;
 let conversionRate = totalOpps > 0 ? ((activeClients / totalOpps) * 100).toFixed(1) : 0;

 const weights = {'Novo lead':0.1, 'Pesquisa em andamento':0.2, 'Contato identificado':0.3, 'Primeiro contato feito':0.4, 'Em negociação':0.5, 'Cotação solicitada':0.7, 'Proposta enviada':0.8, 'Homologação':0.85, 'Vendor List aprovado':0.9, 'Cliente ativo':1.0, 'Perdido':0, 'Sem retorno':0.1, 'Reativar futuramente':0.1};
 let weightedVal = filteredOpps.reduce((acc,o)=>{
  let w = weights[o.status] ?? 0.3;
  return acc + ((Number(o.value)||0) * w);
 }, 0);

 let totalPetronect = filteredPetronect.length;
 let petronectWon = filteredPetronect.filter(p => p.status === 'Ganha').length;
 let petronectLost = filteredPetronect.filter(p => p.status === 'Perdida').length;
 let petronectActiveCount = filteredPetronect.filter(p => !['Declinada','Ganha','Perdida','Encerrada'].includes(p.status)).length;

 let byStatus=statusOptions.map(s=>({s,n:filteredOpps.filter(o=>o.status===s).length})).filter(x=>x.n);
 let byPetronectStatus=petronectStatusOptions.map(s=>({s,n:filteredPetronect.filter(p=>p.status===s).length})).filter(x=>x.n);

 let allLosses = [
  ...filteredOpps.filter(o => o.status === 'Perdido' && o.lossReason).map(o => o.lossReason),
  ...filteredPetronect.filter(p => p.status === 'Perdida' && p.lossReason).map(p => p.lossReason)
 ];
 let lossCounts = lossReasonOptions.map(r => ({ r, n: allLosses.filter(x => x === r).length })).filter(x => x.n > 0).sort((a,b) => b.n - a.n);

 let container = $('#reportsContent');
 if(!container) return;

 container.innerHTML = `
 <div style="font-size:13px;font-weight:700;color:var(--text);margin:5px 0 10px 0;text-transform:uppercase;letter-spacing:.6px;">📈 Indicadores de Oportunidades / Vendas</div>
 <div class="cards">
  ${stat('Total Oportunidades',totalOpps,'◎','Registros no filtro')}
  ${stat('Valor Bruto Oportunidades',money(totalVal),'＄','Soma dos orçamentos')}
  ${stat('Pipeline Ponderado',money(weightedVal),'↗','Previsão de fechamento')}
  ${stat('Taxa de Conversão',conversionRate+'%','★',activeClients+' clientes fechados')}
 </div>
 <div style="font-size:13px;font-weight:700;color:var(--text);margin:20px 0 10px 0;text-transform:uppercase;letter-spacing:.6px;">🏛️ Indicadores de Licitações e Editais Petronect</div>
 <div class="cards">
  ${stat('Total Licitações/Editais',totalPetronect,'◈','Editais no filtro')}
  ${stat('Editais Ativos',petronectActiveCount,'◷','Em andamento')}
  ${stat('Editais Ganhos',petronectWon,'✓','Homologados')}
  ${stat('Editais Perdidos/Declinados',petronectLost+filteredPetronect.filter(p=>p.status==='Declinada').length,'✕','Não convertidos')}
 </div>

 <div class="grid2" style="margin-top:16px;">
  <div class="panel"><h3>Oportunidades por Status</h3>${byStatus.length?byStatus.map(x=>`<div class="bar-row"><span>${esc(x.s)}</span><div class="bar"><i style="width:${100*x.n/Math.max(1,totalOpps)}%"></i></div><b>${x.n}</b></div>`).join(''):'<div class="empty">Sem dados para exibir.</div>'}</div>
  <div class="panel"><h3>Status Licitações Petronect</h3>${byPetronectStatus.length?byPetronectStatus.map(x=>`<div class="bar-row"><span>${esc(x.s)}</span><div class="bar"><i style="width:${100*x.n/Math.max(1,totalPetronect)}%"></i></div><b>${x.n}</b></div>`).join(''):'<div class="empty">Sem dados para exibir.</div>'}</div>
 </div>

 <div class="panel" style="margin-top:16px;">
  <h3>📉 Análise de Motivos de Perda (Oportunidades + Editais Petronect)</h3>
  ${lossCounts.length ? lossCounts.map(x => `<div class="bar-row" style="grid-template-columns:230px 1fr 40px;"><span>${esc(x.r)}</span><div class="bar"><i style="width:${100*x.n/Math.max(1,allLosses.length)}%;background:var(--red);"></i></div><b>${x.n}</b></div>`).join('') : '<div class="empty" style="padding:20px;">Nenhuma perda registrada com motivo neste período.</div>'}
 </div>`;
}

/* ==================== CONFIGURAÇÕES E GESTÃO DE USUÁRIOS (ADMIN) ==================== */
function settingsPage(root){
 let adminHtml = '';
 if(isAdmin()){
  let usersList = db.users || [];
  adminHtml = `
   <div class="panel" style="grid-column:1/-1;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:10px;">
     <div>
      <h3 style="margin:0 0 4px 0;">👥 Gerenciamento de Usuários e Acessos (Exclusivo Admin)</h3>
      <small class="muted">Senha padrão automática: <b>Inicial do Nome + Inicial do Sobrenome + 1234</b> (ex: Carlos Silva = <code>cs1234</code>). No 1º acesso, o usuário é obrigado a redefinir.</small>
     </div>
     <button class="btn primary" onclick="openUserModal()">＋ Novo Usuário</button>
    </div>
    <div class="table-wrap">
     <table>
      <thead><tr><th>ID</th><th>Nome Completo</th><th>Login (Usuário)</th><th>Perfil</th><th>Senha Atual (Visível Admin)</th><th>1º Acesso</th><th>Status</th><th>Ações</th></tr></thead>
      <tbody>
       ${usersList.map((u, idx) => `
        <tr style="${!u.active ? 'opacity:0.55;background:var(--bg);' : ''}">
         <td><code style="font-size:12px;background:var(--line);padding:2px 6px;border-radius:4px;font-weight:700;">${esc(u.id)}</code></td>
         <td>
          <div style="display:flex;align-items:center;gap:8px;">
           <div style="width:28px;height:28px;border-radius:50%;background:#e2f1eb;color:#18734f;display:grid;place-items:center;font-weight:700;font-size:11px;overflow:hidden;flex-shrink:0;">
            ${u.avatar ? `<img src="${u.avatar}" style="width:100%;height:100%;object-fit:cover;">` : getInitials(u.name)}
           </div>
           <b>${esc(u.name)}</b>
          </div>
         </td>
         <td><code>${esc(u.username)}</code></td>
         <td><span class="pill ${u.role==='admin'?'purple':'blue'}">${u.role==='admin'?'Administrador':'Usuário'}</span></td>
         <td>
          <div style="display:flex;align-items:center;gap:6px;">
           <code id="adm_pwd_span_${idx}" data-real="${esc(u.password)}" data-shown="false" style="background:var(--line);padding:3px 7px;border-radius:5px;font-weight:700;">••••••••</code>
           <button type="button" class="btn small" style="padding:2px 6px;font-size:11px;" onclick="toggleAdminRowPwd(${idx})" title="Mostrar/Ocultar Senha">👁️</button>
           <button type="button" class="btn small" style="padding:2px 6px;font-size:11px;" onclick="copyText('${esc(u.password)}','Senha de ${esc(u.name)}')" title="Copiar Senha">📋</button>
          </div>
         </td>
         <td><span class="pill ${u.mustChangePassword?'amber':'green'}">${u.mustChangePassword?'Pendente troca':'Concluído'}</span></td>
         <td><span class="pill ${u.active?'green':'red'}">${u.active?'Ativo':'Inativo'}</span></td>
         <td>
          <div style="display:flex;gap:5px;flex-wrap:wrap;">
           <button class="btn small" onclick="openUserModal('${u.id}')">Editar</button>
           ${u.id !== currentUser.id ? `<button class="btn small" onclick="toggleUserActive('${u.id}')">${u.active?'Inativar':'Ativar'}</button>` : ''}
           ${u.id !== 'US0001' && u.id !== currentUser.id ? `<button class="btn small danger" onclick="deleteUser('${u.id}')">Excluir</button>` : ''}
          </div>
         </td>
        </tr>
       `).join('')}
      </tbody>
     </table>
    </div>
   </div>
  `;
 }

 root.innerHTML=head('Backup e configurações','Proteja seus dados, gerencie acessos e mantenha uma cópia fora do navegador.')+`
 <div class="notice warn"><b>Importante:</b> os registros ficam armazenados neste navegador e neste perfil de usuário. Faça backups regulares.</div>
 <div class="settings-grid">
  ${adminHtml}
  <div class="panel">
   <h3>Exportar backup completo (JSON)</h3>
   <p class="muted">Gera um arquivo JSON contendo empresas, oportunidades, portais, licitações, contatos, atividades e usuários para backup geral.</p>
   <button class="btn primary" onclick="backup()">⇩ Baixar backup completo JSON</button>
  </div>
  <div class="panel">
   <h3>Exportar cadastro específico (CSV)</h3>
   <p class="muted">Escolha qual base específica você deseja baixar separadamente em formato CSV para o Excel:</p>
   <div style="display:flex;gap:8px;align-items:center;margin-top:10px;flex-wrap:wrap;">
    <select id="exportSelectType" style="padding:8px;border-radius:8px;border:1px solid var(--line);background:var(--surface);">
     <option value="companies">Empresas</option>
     <option value="contacts">Contatos</option>
     <option value="activities">Atividades / Tarefas</option>
     <option value="portals">Base de Portais</option>
     <option value="portalHistory">Histórico de Portais</option>
     <option value="petronect">Editais Petronect</option>
     <option value="opportunities">Oportunidades</option>
     <option value="licitacoes">Licitações</option>
    </select>
    <button class="btn" onclick="exportSingleCSV()">⇩ Baixar CSV</button>
   </div>
  </div>
  <div class="panel">
   <h3>Restaurar backup</h3>
   <p class="muted">Importe um backup JSON gerado por este sistema. A restauração exige senha do administrador e substitui os dados atuais.</p>
   <button class="btn" onclick="requireAdminAuth('restaurar um arquivo de backup', () => $('#importFile').click())">⇧ Selecionar arquivo de backup</button>
  </div>
  <div class="panel">
   <h3>Exportar todas as abas em pacote (ZIP)</h3>
   <p class="muted">Gera um arquivo <code>.zip</code> contendo todas as bases do sistema (Oportunidades, Empresas, Contatos, Petronect, Portais, Histórico e Atividades) em planilhas CSV separadas.</p>
   <button class="btn primary" onclick="exportAllCSVsZip()">⇩ Baixar todas as abas (.ZIP)</button>
  </div>
  <div class="panel" style="grid-column:1/-1;">
   <h3>Dados locais armazenados</h3>
   <p class="muted">Registros atuais neste navegador:</p>
   <b>${db.companies.length}</b> empresas · <b>${db.opportunities.length}</b> oportunidades · <b>${(db.portals||[]).length}</b> portais · <b>${db.petronect.length}</b> editais Petronect · <b>${db.contacts.length}</b> contatos · <b>${db.activities.length}</b> tarefas/atividades · <b>${(db.users||[]).length}</b> usuários
  </div>
 </div>`;
}

function toggleAdminRowPwd(idx){
 let el = document.getElementById('adm_pwd_span_' + idx);
 if(!el) return;
 let shown = el.getAttribute('data-shown') === 'true';
 if(shown){
  el.textContent = '••••••••';
  el.setAttribute('data-shown', 'false');
 } else {
  el.textContent = el.getAttribute('data-real');
  el.setAttribute('data-shown', 'true');
 }
}

function openUserModal(id = null){
 if(!isAdmin()) return;
 let u = id ? db.users.find(x => x.id === id) : null;
 let initialPwd = u ? u.password : '';

 openModal(u ? 'Editar Usuário' : 'Novo Usuário', `
  <div style="display:flex;flex-direction:column;gap:14px;">
   <div class="form-grid">
    <div class="field">
     <label>Nome Completo *</label>
     <input type="text" id="usr_name" value="${esc(u ? u.name : '')}" placeholder="Ex: Carlos Silva" oninput="previewNewUserDefaultPwd()">
    </div>
    <div class="field">
     <label>Login (Usuário) *</label>
     <input type="text" id="usr_username" value="${esc(u ? u.username : '')}" placeholder="Ex: carlos.silva">
    </div>
    <div class="field">
     <label>Perfil de Acesso</label>
     <select id="usr_role" ${u && u.id === 'US0001' ? 'disabled' : ''}>
      <option value="user" ${!u || u.role === 'user' ? 'selected' : ''}>Usuário Comercial</option>
      <option value="admin" ${u && u.role === 'admin' ? 'selected' : ''}>Administrador</option>
     </select>
    </div>
    <div class="field">
     <label>Status</label>
     <select id="usr_active" ${u && u.id === currentUser.id ? 'disabled' : ''}>
      <option value="true" ${!u || u.active ? 'selected' : ''}>Ativo (Acesso liberado)</option>
      <option value="false" ${u && !u.active ? 'selected' : ''}>Inativo (Login bloqueado)</option>
     </select>
    </div>
    <div class="field full">
     <label>${u ? 'Senha Atual do Usuário (visível para Admin)' : 'Senha Padrão Gerada Automaticamente'}</label>
     <div style="display:flex;gap:6px;">
      <input type="text" id="usr_password" value="${esc(initialPwd)}" ${!u ? 'readonly style="background:var(--line);font-weight:700;"' : ''}>
      ${u ? `<button type="button" class="btn small" onclick="resetUserToDefaultPwd()">↻ Resetar p/ Padrão</button>` : ''}
     </div>
     <small class="muted" id="usr_pwd_hint">${u ? 'Você pode editar manualmente ou clicar em "Resetar p/ Padrão" para forçar nova senha no próximo login.' : 'Regra: Inicial do primeiro nome + inicial do último sobrenome + 1234.'}</small>
    </div>
   </div>
  </div>
 `, () => {
  let name = val('usr_name');
  let username = val('usr_username').toLowerCase();
  let role = val('usr_role') || 'user';
  let active = val('usr_active') === 'true';
  let pwd = val('usr_password');

  if(!name || !username){ alert('Preencha o Nome Completo e o Login.'); return; }
  let duplicate = db.users.some(x => x.username.toLowerCase() === username && x.id !== id);
  if(duplicate){ alert('Já existe um usuário cadastrado com este login.'); return; }

  if(u){
   let wasReset = pwd === computeDefaultPassword(name) && pwd !== u.password;
   u.name = name;
   u.username = username;
   if(u.id !== 'US0001') u.role = role;
   if(u.id !== currentUser.id) u.active = active;
   if(pwd) u.password = pwd;
   if(wasReset) u.mustChangePassword = true;
   if(u.id === currentUser.id){
    currentUser = u;
    updateTopbarUser();
   }
  } else {
   let genPwd = computeDefaultPassword(name);
   db.users.push({
    id: generateCustomId('US', db.users),
    name,
    username,
    password: genPwd,
    role,
    active,
    mustChangePassword: true,
    avatar: ''
   });
   alert(`Usuário criado com sucesso!\n\nLogin: ${username}\nSenha padrão inicial: ${genPwd}\n\nNo primeiro acesso, o usuário deverá criar uma nova senha.`);
  }
  saveDB(); closeModal(); render();
 }, '', true);
}

function previewNewUserDefaultPwd(){
 let inp = $('#usr_password');
 if(inp && inp.hasAttribute('readonly')){
  let n = val('usr_name');
  inp.value = n ? computeDefaultPassword(n) : '';
 }
}

function resetUserToDefaultPwd(){
 let n = val('usr_name');
 if(!n){ alert('Informe o nome completo primeiro.'); return; }
 let def = computeDefaultPassword(n);
 if($('#usr_password')) $('#usr_password').value = def;
}

function toggleUserActive(id){
 if(!isAdmin()) return;
 let u = db.users.find(x => x.id === id);
 if(!u || u.id === currentUser.id) return;
 u.active = !u.active;
 saveDB(); render();
}

function deleteUser(id){
 if(!isAdmin()) return;
 requireAdminAuth('excluir este usuário do sistema', () => {
  db.users = db.users.filter(x => x.id !== id);
  saveDB(); render();
 });
}
/* ===================================================================================== */

function val(id){return document.getElementById(id)?.value?.trim()||''}
function field(label,id,value='',type='text',opts=null,full=false){
 let input='';
 if(opts){
  input=`<select id="${id}">${opts.map(x=>`<option ${x===value?'selected':''}>${esc(x)}</option>`).join('')}</select>`;
 } else if(type==='textarea'){
  input=`<textarea id="${id}">${esc(value)}</textarea>`;
 } else {
  let onEv = '';
  if(id.includes('cnpj') || id === 'c_cnpj' || id === 'o_cnpj' || id === 'o_buyer_cnpj' || id === 'pt_cnpj') onEv = `oninput="this.value=maskCNPJ(this.value)"`;
  if(id.includes('phone') || id === 'c_phone' || id === 'o_phone' || id === 'pt_phone') onEv = `oninput="this.value=maskPhone(this.value)"`;
  input=`<input id="${id}" type="${type}" value="${esc(value)}" ${onEv}>`;
 }
 return `<div class="field ${full?'full':''}"><label>${label}</label>${input}</div>`;
}

function deleteOpportunity(id){
 requireAdminAuth('excluir esta oportunidade', () => {
  db.opportunities=db.opportunities.filter(o=>o.id!==id);saveDB();render();
 });
}
function deleteCompany(id){
 requireAdminAuth('excluir esta empresa', () => {
  db.companies=db.companies.filter(c=>c.id!==id);saveDB();render();
 });
}
function deleteContact(id){
 requireAdminAuth('excluir este contato', () => {
  db.contacts=db.contacts.filter(c=>c.id!==id);saveDB();render();
 });
}
function deleteActivity(id){
 requireAdminAuth('excluir esta tarefa/atividade', () => {
  db.activities=db.activities.filter(a=>a.id!==id);saveDB();render();
 });
}

let currentProductsList = [];
function renderProductItems(){
 let container = $('#productItemsContainer');
 if(!container) return;
 container.innerHTML = currentProductsList.map((item, index)=>`
  <div class="product-item-row" data-index="${index}">
   <div class="product-item-grid" style="display:grid;grid-template-columns: 2fr 3fr 1fr 1fr 1fr auto;gap:6px;align-items:end;min-width:620px;">
    <div class="field"><label>Produto / item</label><input type="text" value="${esc(item.name)}" oninput="updateProductItem(${index}, 'name', this.value)"></div>
    <div class="field"><label>Descrição / especificação</label><input type="text" value="${esc(item.desc)}" oninput="updateProductItem(${index}, 'desc', this.value)"></div>
    <div class="field"><label>Quantidade</label><input type="number" value="${item.qty||1}" oninput="updateProductItem(${index}, 'qty', this.value)"></div>
    <div class="field"><label>Unidade</label><input type="text" value="${esc(item.unit||'UN')}" oninput="updateProductItem(${index}, 'unit', this.value)"></div>
    <div class="field"><label>Valor unitário (R$)</label><input type="number" step="0.01" value="${item.unitValue||0}" oninput="updateProductItem(${index}, 'unitValue', this.value)"></div>
    <div style="padding-bottom:2px;"><button type="button" class="btn small danger" onclick="removeProductItem(${index})">✕</button></div>
   </div>
   <div style="margin-top:4px;font-size:11px;color:var(--muted);text-align:right;">Valor total: <b class="pi-total">${money((Number(item.qty)||0)*(Number(item.unitValue)||0))}</b></div>
  </div>
 `).join('') || '<div class="empty" style="padding:15px;font-size:13px;">Nenhum produto adicionado.</div>';
}
function addProductItem(){ currentProductsList.push({name:'', desc:'', qty:1, unit:'UN', unitValue:0}); renderProductItems(); }
function removeProductItem(index){ currentProductsList.splice(index, 1); renderProductItems(); }
function updateProductItem(index, fieldName, val){
 if(currentProductsList[index]){
  currentProductsList[index][fieldName] = val;
  if(fieldName === 'qty' || fieldName === 'unitValue'){
   let row = document.querySelector(`.product-item-row[data-index="${index}"]`);
   if(row){
    let q = Number(currentProductsList[index].qty)||0;
    let v = Number(currentProductsList[index].unitValue)||0;
    row.querySelector('.pi-total').textContent = money(q * v);
   }
  }
 }
}

function handleCompanyAutoFill(companyName){
 let found = db.companies.find(c => c.name.toLowerCase() === companyName.toLowerCase());
 if(found){
  if($('#o_cnpj') && !$('#o_cnpj').value) $('#o_cnpj').value = found.cnpj || '';
  if($('#o_address') && !$('#o_address').value) $('#o_address').value = found.address || '';
  if($('#o_segment') && found.segment) $('#o_segment').value = found.segment;
  if($('#o_city') && !$('#o_city').value) $('#o_city').value = found.city || '';
  if($('#o_uf') && !$('#o_uf').value) $('#o_uf').value = found.uf || '';
 }
}

let currentOpportunityContacts = [];

function renderOpportunityContacts(){
  let container = $('#opportunityContactsContainer');
  if(!container) return;
  container.innerHTML = currentOpportunityContacts.map((c, index)=>`
    <div class="product-item-row" data-contact-index="${index}">
      <div class="product-item-grid" style="display:grid;grid-template-columns: 2fr 1.5fr 2fr 1.5fr auto;gap:6px;align-items:end;min-width:580px;">
        <div class="field"><label>Nome do contato</label><input type="text" value="${esc(c.name)}" oninput="updateOpportunityContact(${index}, 'name', this.value)"></div>
        <div class="field"><label>Cargo / área</label><input type="text" value="${esc(c.role)}" oninput="updateOpportunityContact(${index}, 'role', this.value)"></div>
        <div class="field"><label>E-mail</label><input type="email" value="${esc(c.email)}" oninput="updateOpportunityContact(${index}, 'email', this.value)"></div>
        <div class="field"><label>Telefone</label><input type="text" value="${esc(c.phone)}" oninput="this.value=maskPhone(this.value); updateOpportunityContact(${index}, 'phone', this.value)"></div>
        <div style="padding-bottom:2px;"><button type="button" class="btn small danger" onclick="removeOpportunityContact(${index})">✕</button></div>
      </div>
    </div>
  `).join('') || '<div class="empty" style="padding:15px;font-size:13px;">Nenhum contato adicionado.</div>';
}

function addOpportunityContactItem(){ currentOpportunityContacts.push({name:'', role:'', email:'', phone:'', rolebuy:'Compras'}); renderOpportunityContacts(); }
function removeOpportunityContact(index){ currentOpportunityContacts.splice(index, 1); renderOpportunityContacts(); }
function updateOpportunityContact(index, fieldName, val){ if(currentOpportunityContacts[index]) currentOpportunityContacts[index][fieldName] = val; }

function toggleOppLossReason(statusVal){
  let wrap = $('#oppLossReasonWrap');
  if(wrap) wrap.style.display = statusVal === 'Perdido' ? 'flex' : 'none';
}

function openOpportunity(id=null){
  let o=db.opportunities.find(x=>x.id===id)||{};
  currentProductsList = o.products ? JSON.parse(JSON.stringify(o.products)) : [];
  if(currentProductsList.length === 0 && o.product){
    currentProductsList.push({name: o.product, desc: '', qty: o.quantity||1, unit: 'UN', unitValue: o.value||0});
  }
  currentOpportunityContacts = o.contactsList ? JSON.parse(JSON.stringify(o.contactsList)) : [];
  let defaultOwner = o.owner || (currentUser ? currentUser.name : '');
  let curStatus = o.status || 'Novo lead';

  let linkedActivities = id ? db.activities.filter(a => a.oppId === id || (o.company && a.company && a.company.toLowerCase() === o.company.toLowerCase())).sort((a,b) => (b.date||'').localeCompare(a.date||'')) : [];

  openModal(id?'Editar oportunidade':'Nova oportunidade', `
    <div style="display:flex;flex-direction:column;gap:15px;">
      ${id?`
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
          <div class="field" style="flex:1;"><label>ID do Registro</label><input type="text" readonly value="${esc(o.id)}" style="background:var(--line);font-weight:700;"></div>
          <div><button type="button" class="btn primary" onclick="generateOpportunityPDF('${o.id}')">📄 Gerar Proposta PDF</button></div>
        </div>
      `:''}

      <div style="background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:15px;">
        <h3 style="margin:0 0 12px 0;font-size:14px;color:var(--text);border-bottom:1px solid var(--line);padding-bottom:6px;">📌 1. Dados Principais da Empresa</h3>
        <div class="form-grid">
          <div class="field"><label>Empresa / razão social</label><input id="o_company" type="text" value="${esc(o.company)}" oninput="handleCompanyAutoFill(this.value)"></div>
          ${field('CNPJ','o_cnpj',o.cnpj)}
          ${field('Segmento','o_segment',o.segment,'text',['Distribuidor','Indústria','Construtora','Integrador / aplicador','Revenda','Órgão público','Manutenção industrial','Outro'])}
          ${field('Cidade','o_city',o.city)}
          ${field('UF','o_uf',o.uf)}
          <div class="field full">${field('Endereço completo','o_address',o.address,'text',null,true)}</div>
        </div>
      </div>

      <div style="background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:15px;">
        <h3 style="margin:0 0 12px 0;font-size:14px;color:var(--text);border-bottom:1px solid var(--line);padding-bottom:6px;">📋 2. Informações Comerciais e Licitação</h3>
        <div class="form-grid">
          ${field('Origem da oportunidade','o_source',o.source,'text',['PNCP','Compras.gov.br','Portal estadual/municipal','Portal privado','Indicação','LinkedIn','Pesquisa Google','Outro'])}
          ${field('Nº do processo / licitação','o_process',o.process)}
          ${field('Vigência / prazo do contrato','o_contract_term',o.contractTerm,'text')}
          ${field('Responsável interno','o_owner',defaultOwner,'text')}
          ${field('Potencial comercial','o_potential',o.potential||'A validar','text',['Alto','Médio','Baixo','A validar'])}
          ${field('Prioridade','o_priority',o.priority||'Normal','text',['Urgente','Alta','Normal','Baixa'])}
          <div class="field">
            <label>Status comercial</label>
            <select id="o_status" onchange="toggleOppLossReason(this.value)">
              ${statusOptions.map(s=>`<option ${s===curStatus?'selected':''}>${esc(s)}</option>`).join('')}
            </select>
          </div>
          ${field('Status Vendor List','o_vendor',o.vendor||'Não iniciado','text',vendorOptions)}
          <div class="field full" id="oppLossReasonWrap" style="display:${curStatus==='Perdido'?'flex':'none'};">
            <label style="color:var(--red);">Motivo da Perda *</label>
            <select id="o_loss_reason">
              <option value="">Selecione o motivo...</option>
              ${lossReasonOptions.map(r=>`<option ${r===o.lossReason?'selected':''}>${esc(r)}</option>`).join('')}
            </select>
          </div>
          <div class="field full">${field('Link do edital / fonte','o_link',o.link,'url',null,true)}</div>
        </div>
      </div>

      <div class="accordion-header" onclick="toggleAccordion('accBuyer')"><span>🏛️ 3. Órgão Comprador (Clique para expandir)</span><span>▼</span></div>
      <div id="accBuyer" class="accordion-content form-grid" style="background:var(--bg);padding:15px;border:1px solid var(--line);border-radius:8px;">
        ${field('Nome do órgão comprador','o_buyer',o.buyer)}
        ${field('CNPJ do órgão','o_buyer_cnpj',o.buyerCnpj)}
        ${field('Responsável no órgão','o_buyer_resp',o.buyerResp)}
        ${field('Cargo do responsável','o_buyer_cargo',o.buyerCargo)}
        <div class="field full">${field('Endereço do órgão','o_buyer_address',o.buyerAddress,'text',null,true)}</div>
      </div>

      <div style="background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:15px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;border-bottom:1px solid var(--line);padding-bottom:6px;flex-wrap:wrap;gap:6px;">
          <h3 style="margin:0;font-size:14px;color:var(--text);">👥 4. Contatos da Oportunidade</h3>
          <button type="button" class="btn small primary" onclick="addOpportunityContactItem()">＋ Adicionar Contato</button>
        </div>
        <div id="opportunityContactsContainer" style="max-height:280px;overflow-y:auto;border:1px solid var(--line);padding:10px;border-radius:8px;background:var(--surface);"></div>
      </div>

      <div style="background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:15px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;border-bottom:1px solid var(--line);padding-bottom:6px;flex-wrap:wrap;gap:6px;">
          <h3 style="margin:0;font-size:14px;color:var(--text);">📦 5. Produtos / Itens da Oportunidade</h3>
          <button type="button" class="btn small primary" onclick="addProductItem()">＋ Adicionar Item</button>
        </div>
        <div id="productItemsContainer" style="max-height:280px;overflow-y:auto;border:1px solid var(--line);padding:10px;border-radius:8px;background:var(--surface);"></div>
      </div>

      ${id ? `
      <div style="background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:15px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;border-bottom:1px solid var(--line);padding-bottom:6px;flex-wrap:wrap;gap:6px;">
          <h3 style="margin:0;font-size:14px;color:var(--text);">🕒 6. Timeline / Histórico de Interações (${linkedActivities.length})</h3>
          <button type="button" class="btn small primary" onclick="closeModal(); openActivity('${o.id}')">＋ Registrar Follow-up</button>
        </div>
        ${linkedActivities.length ? `
          <div class="opp-timeline">
            ${linkedActivities.map(act => `
              <div class="opp-tl-item">
                <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;margin-bottom:3px;">
                  <b>${esc(act.title || act.type)}</b>
                  <span class="muted" style="font-size:11px;">${fmtDate(act.date)} · <span class="pill" style="font-size:10px;padding:1px 6px;">${esc(act.type)}</span></span>
                </div>
                <div>${esc(act.summary || '—')}</div>
                ${act.next ? `<div class="muted" style="font-size:11px;margin-top:3px;">Próximo passo: ${esc(act.next)} ${act.nextDate ? '('+fmtDate(act.nextDate)+')' : ''}</div>` : ''}
              </div>
            `).join('')}
          </div>
        ` : '<div class="empty" style="padding:15px;font-size:12px;">Nenhuma interação registrada para esta oportunidade ainda. Clique em "+ Registrar Follow-up".</div>'}
      </div>
      ` : ''}

      <div style="background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:15px;">
        <h3 style="margin:0 0 12px 0;font-size:14px;color:var(--text);border-bottom:1px solid var(--line);padding-bottom:6px;">📝 7. Próxima Ação e Observações</h3>
        <div class="form-grid">
          ${field('Próxima ação','o_next',o.nextAction,'text',null,true)}
          ${field('Data do próximo contato','o_nextdate',o.nextDate,'date')}
          <div class="field full">${field('Observações','o_notes',o.notes,'textarea',null,true)}</div>
        </div>
      </div>
    </div>
  `, ()=>{
    let company=val('o_company');
    if(!company){alert('Informe o nome da empresa.');return}
    let statusVal = val('o_status');
    let lossReasonVal = val('o_loss_reason');
    if(statusVal === 'Perdido' && !lossReasonVal){
      alert('Informe o motivo da perda antes de salvar.');
      return;
    }

    let totalValue = currentProductsList.reduce((acc, item)=> acc + ((Number(item.qty)||0)*(Number(item.unitValue)||0)), 0);
    let recordId = o.id ? o.id : generateCustomId('OP', db.opportunities);

    let data={
      id: recordId,
      company,
      cnpj:val('o_cnpj'),
      address:val('o_address'),
      segment:val('o_segment'),
      city:val('o_city'),
      uf:val('o_uf').toUpperCase(),
      products: currentProductsList,
      contactsList: currentOpportunityContacts,
      value: totalValue,
      source:val('o_source'),
      process:val('o_process'),
      link:val('o_link'),
      buyer:val('o_buyer'),
      buyerCnpj:val('o_buyer_cnpj'),
      buyerResp:val('o_buyer_resp'),
      buyerCargo:val('o_buyer_cargo'),
      buyerAddress:val('o_buyer_address'),
      contractTerm:val('o_contract_term'),
      owner:val('o_owner'),
      potential:val('o_potential'),
      priority:val('o_priority'),
      status:statusVal,
      lossReason: statusVal === 'Perdido' ? lossReasonVal : '',
      vendor:val('o_vendor'),
      nextAction:val('o_next'),
      nextDate:val('o_nextdate'),
      notes:val('o_notes'),
      done:o.done||false,
      created:o.created||today(),
      updated:today()
    };

    if(o.id) db.opportunities=db.opportunities.map(x=>x.id===id?data:x);
    else db.opportunities.unshift(data);
    saveDB(); closeModal(); render();
  });

  renderProductItems();
  renderOpportunityContacts();
}

function editOpportunity(id){openOpportunity(id)}

function openCompany(id=null){
 let c=db.companies.find(x=>x.id===id)||{};
 openModal(id?'Editar empresa':'Nova empresa',`
  <div style="display:flex;flex-direction:column;gap:20px;">
   ${id?`<div class="field"><label>ID do Registro</label><input type="text" readonly value="${esc(c.id)}" style="background:var(--line);font-weight:700;"></div>`:''}
   <div style="background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:15px;">
    <h3 style="margin:0 0 12px 0;font-size:14px;color:var(--text);border-bottom:1px solid var(--line);padding-bottom:6px;">📌 1. Dados da Empresa</h3>
    <div class="form-grid">
     ${field('Razão social / empresa','c_name',c.name)}
     ${field('Nome fantasia','c_trade',c.trade)}
     ${field('CNPJ','c_cnpj',c.cnpj)}
     ${field('Segmento','c_segment',c.segment)}
     ${field('Cidade','c_city',c.city)}
     ${field('UF','c_uf',c.uf)}
     <div class="field full">${field('Endereço','c_address',c.address,'text',null,true)}</div>
    </div>
   </div>
   <div style="background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:15px;">
    <h3 style="margin:0 0 12px 0;font-size:14px;color:var(--text);border-bottom:1px solid var(--line);padding-bottom:6px;">📞 2. Contato e Observações</h3>
    <div class="form-grid">
     ${field('Telefone','c_phone',c.phone,'tel')}
     ${field('E-mail','c_email',c.email,'email')}
     <div class="field full">${field('Site','c_site',c.site,'url')}</div>
     <div class="field full">${field('Observações','c_notes',c.notes,'textarea',null,true)}</div>
    </div>
   </div>
  </div>
 `,()=>{let name=val('c_name');if(!name){alert('Informe o nome da empresa.');return}let recordId = c.id ? c.id : generateCustomId('EM', db.companies);let d={id:recordId,name,trade:val('c_trade'),cnpj:val('c_cnpj'),address:val('c_address'),segment:val('c_segment'),city:val('c_city'),uf:val('c_uf'),phone:val('c_phone'),email:val('c_email'),site:val('c_site'),notes:val('c_notes')};if(c.id)db.companies=db.companies.map(x=>x.id===id?d:x);else db.companies.unshift(d);saveDB();closeModal();render()})
}
function editCompany(id){openCompany(id)}

function openContact(id=null){
 let c=db.contacts.find(x=>x.id===id)||{};
 openModal(id?'Editar contato':'Novo contato',`
  <div style="display:flex;flex-direction:column;gap:20px;">
   ${id?`<div class="field"><label>ID do Registro</label><input type="text" readonly value="${esc(c.id)}" style="background:var(--line);font-weight:700;"></div>`:''}
   <div style="background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:15px;">
    <h3 style="margin:0 0 12px 0;font-size:14px;color:var(--text);border-bottom:1px solid var(--line);padding-bottom:6px;">📌 1. Informações do Contato</h3>
    <div class="form-grid">
     ${field('Nome do contato','ct_name',c.name)}
     ${field('Empresa','ct_company',c.company)}
     ${field('Cargo / área','ct_role',c.role)}
     ${field('Papel na compra','ct_rolebuy',c.rolebuy||'Compras','text',['Compras','Suprimentos','Engenharia','Manutenção','Obras','Comercial','Diretoria','Cadastro de fornecedores','Outro'])}
    </div>
   </div>
   <div style="background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:15px;">
    <h3 style="margin:0 0 12px 0;font-size:14px;color:var(--text);border-bottom:1px solid var(--line);padding-bottom:6px;">📞 2. Comunicação e Detalhes</h3>
    <div class="form-grid">
     ${field('Telefone','ct_phone',c.phone,'tel')}
     ${field('E-mail','ct_email',c.email,'email')}
     ${field('LinkedIn','ct_link',c.linkedin,'url')}
     ${field('Canal preferido','ct_channel',c.channel||'E-mail','text',['E-mail','Telefone','WhatsApp','LinkedIn','Portal','Presencial'])}
     ${field('Última validação','ct_date',c.lastDate||today(),'date')}
     <div class="field full">${field('Observações','ct_notes',c.notes,'textarea',null,true)}</div>
    </div>
   </div>
  </div>
 `,()=>{let name=val('ct_name');if(!name){alert('Informe o nome do contato.');return}let recordId = c.id ? c.id : generateCustomId('CT', db.contacts);let d={id:recordId,name,company:val('ct_company'),role:val('ct_role'),rolebuy:val('ct_rolebuy'),phone:val('ct_phone'),email:val('ct_email'),linkedin:val('ct_link'),channel:val('ct_channel'),lastDate:val('ct_date'),notes:val('ct_notes')};if(c.id)db.contacts=db.contacts.map(x=>x.id===id?d:x);else db.contacts.unshift(d);saveDB();closeModal();render()})
}
function editContact(id){openContact(id)}

function openActivity(oppId = null, editId = null){
 let opp = oppId ? db.opportunities.find(o => o.id === oppId) : null;
 let act = editId ? db.activities.find(a => a.id === editId) : null;
 let companyVal = act ? (act.company === 'Geral / Interno' ? '' : act.company) : (opp ? opp.company : '');
 let contactVal = act ? (act.contact || '') : (opp && opp.contactsList && opp.contactsList[0] ? opp.contactsList[0].name : '');

 openModal(act ? 'Editar Tarefa / Atividade' : (opp ? `Registrar Follow-up · ${opp.company}` : 'Nova Tarefa / Atividade'),`
  <div style="display:flex;flex-direction:column;gap:15px;">
   ${act?`<div class="field"><label>ID do Registro</label><input type="text" readonly value="${esc(act.id)}" style="background:var(--line);font-weight:700;"></div>`:''}
   <div style="background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:15px;">
    <h3 style="margin:0 0 12px 0;font-size:14px;color:var(--text);border-bottom:1px solid var(--line);padding-bottom:6px;">📌 1. O que precisa ser feito / Registro</h3>
    <div class="form-grid">
     <div class="field full"><label>Título / Assunto da Tarefa</label><input id="a_title" type="text" value="${esc(act?act.title:(opp?'Follow-up comercial':''))}" placeholder="Ex: Atualizar planilha de canais de vendas, Ligar para cliente X..."></div>
     ${field('Data do registro','a_date',act?act.date:today(),'date')}
     ${field('Tipo','a_type',act?act.type:(opp?'Follow-up':'Tarefa / To-Do'),'text',activityTypes)}
     <div class="field"><label>Empresa vinculada <span class="muted" style="font-weight:400;">(opcional)</span></label><input id="a_company" type="text" value="${esc(companyVal)}" placeholder="Deixe vazio se for tarefa interna"></div>
     <div class="field"><label>Contato <span class="muted" style="font-weight:400;">(opcional)</span></label><input id="a_contact" type="text" value="${esc(contactVal)}" placeholder="Opcional"></div>
    </div>
   </div>
   <div style="background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:15px;">
    <h3 style="margin:0 0 12px 0;font-size:14px;color:var(--text);border-bottom:1px solid var(--line);padding-bottom:6px;">📋 2. Detalhes, Acompanhamento e Prazo</h3>
    <div class="form-grid">
     <div class="field full">${field('Detalhes / Checklist / Resultado','a_summary',act?act.summary:'','textarea',null,true)}</div>
     <div class="field full">${field('Observação / Pendência específica','a_objection',act?act.objection:'','textarea',null,true)}</div>
     ${field('Próximo passo / Ação futura','a_next',act?act.next:(opp?opp.nextAction:''),'text',null,true)}
     ${field('Data limite / Próximo acompanhamento','a_nextdate',act?(act.nextDate||''):(opp?opp.nextDate:''),'date')}
    </div>
   </div>
  </div>
 `,()=>{
  let title = val('a_title');
  let summary = val('a_summary');
  if(!title && !summary){alert('Informe ao menos o título da tarefa ou os detalhes.');return}
  let company = val('a_company') || 'Geral / Interno';
  let recordId = act ? act.id : generateCustomId('AT', db.activities);
  let nextStep = val('a_next');
  let nextDt = val('a_nextdate');

  let data = {
   id: recordId,
   oppId: act ? (act.oppId || null) : (opp ? opp.id : null),
   title: title || summary.slice(0, 60),
   date: val('a_date'),
   company,
   contact: val('a_contact'),
   type: val('a_type'),
   summary: summary,
   objection: val('a_objection'),
   next: nextStep,
   nextDate: nextDt,
   done: act ? act.done : false,
   createdBy: act ? (act.createdBy || '') : (currentUser ? currentUser.name : '')
  };

  if(opp){
   opp.updated = today();
   if(nextStep) opp.nextAction = nextStep;
   if(nextDt) opp.nextDate = nextDt;
  }

  if(act) db.activities = db.activities.map(x => x.id === editId ? data : x);
  else db.activities.unshift(data);
  saveDB(); closeModal(); render();
 });
}
function editActivity(id){openActivity(null, id)}

function backup(){
 let backupData = {...db, backupDate: new Date().toISOString(), app: 'Advance CRM'};
 let blob=new Blob([JSON.stringify(backupData,null,2)],{type:'application/json'});
 downloadBlob(blob,'advance_crm_backup_'+today()+'.json');
}

function exportSingleCSV(){
 let type = $('#exportSelectType')?.value;
 if(!type) return;
 let dataMap = {
  companies: {data: db.companies, name: 'empresas'},
  contacts: {data: db.contacts, name: 'contatos'},
  activities: {data: db.activities, name: 'atividades'},
  portals: {data: db.portals || [], name: 'portais'},
  portalHistory: {data: db.portalHistory || [], name: 'historico_portais'},
  petronect: {data: db.petronect, name: 'editais_petronect'},
  opportunities: {data: db.opportunities, name: 'oportunidades'},
  licitacoes: {data: db.licitacoes || [], name: 'licitacoes'}
 };
 let target = dataMap[type];
 if(!target) return;
 exportCSV(target.data, 'advance_' + target.name + '_' + today() + '.csv');
}

/* ==================== GERADOR DE PACOTE .ZIP NATIVO (TODAS AS ABAS CSV) ==================== */
function rowsToCSVString(rows){
 if(!rows || !rows.length) return '\ufeffSem registros\r\n';
 let keys = [...new Set(rows.flatMap(r => Object.keys(r)))];
 let lines = [
  keys.join(';'),
  ...rows.map(r => keys.map(k => {
   let val = r[k];
   if(val !== null && typeof val === 'object') val = JSON.stringify(val);
   return '"' + String(val ?? '').replace(/"/g, '""') + '"';
  }).join(';'))
 ];
 return '\ufeff' + lines.join('\r\n');
}

function crc32Bytes(buf){
 let table = new Uint32Array(256);
 for(let i = 0; i < 256; i++){
  let c = i;
  for(let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  table[i] = c;
 }
 let crc = 0 ^ (-1);
 for(let i = 0; i < buf.length; i++){
  crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
 }
 return (crc ^ (-1)) >>> 0;
}

function createZipBlob(files){
 const encoder = new TextEncoder();
 let localParts = [];
 let centralParts = [];
 let offset = 0;

 files.forEach(file => {
  let nameBytes = encoder.encode(file.name);
  let dataBytes = encoder.encode(file.content);
  let crc = crc32Bytes(dataBytes);

  let localHeader = new Uint8Array(30 + nameBytes.length);
  let lv = new DataView(localHeader.buffer);
  lv.setUint32(0, 0x04034b50, true);
  lv.setUint16(4, 20, true);
  lv.setUint16(6, 0x0800, true);
  lv.setUint16(8, 0, true);
  lv.setUint16(10, 0, true);
  lv.setUint16(12, 0, true);
  lv.setUint32(14, crc, true);
  lv.setUint32(18, dataBytes.length, true);
  lv.setUint32(22, dataBytes.length, true);
  lv.setUint16(26, nameBytes.length, true);
  lv.setUint16(28, 0, true);
  localHeader.set(nameBytes, 30);

  localParts.push(localHeader, dataBytes);

  let centralHeader = new Uint8Array(46 + nameBytes.length);
  let cv = new DataView(centralHeader.buffer);
  cv.setUint32(0, 0x02014b50, true);
  cv.setUint16(4, 20, true);
  cv.setUint16(6, 20, true);
  cv.setUint16(8, 0x0800, true);
  cv.setUint16(10, 0, true);
  cv.setUint16(12, 0, true);
  cv.setUint16(14, 0, true);
  cv.setUint32(16, crc, true);
  cv.setUint32(20, dataBytes.length, true);
  cv.setUint32(24, dataBytes.length, true);
  cv.setUint16(28, nameBytes.length, true);
  cv.setUint16(30, 0, true);
  cv.setUint16(32, 0, true);
  cv.setUint16(34, 0, true);
  cv.setUint16(36, 0, true);
  cv.setUint32(38, 0, true);
  cv.setUint32(42, offset, true);
  centralHeader.set(nameBytes, 46);

  centralParts.push(centralHeader);
  offset += localHeader.length + dataBytes.length;
 });

 let centralSize = centralParts.reduce((acc, p) => acc + p.length, 0);
 let endRecord = new Uint8Array(22);
 let ev = new DataView(endRecord.buffer);
 ev.setUint32(0, 0x06054b50, true);
 ev.setUint16(4, 0, true);
 ev.setUint16(6, 0, true);
 ev.setUint16(8, files.length, true);
 ev.setUint16(10, files.length, true);
 ev.setUint32(12, centralSize, true);
 ev.setUint32(16, offset, true);
 ev.setUint16(20, 0, true);

 return new Blob([...localParts, ...centralParts, endRecord], {type: 'application/zip'});
}

function exportAllCSVsZip(){
 let d = today();
 let files = [
  { name: `01_oportunidades_${d}.csv`, content: rowsToCSVString(db.opportunities || []) },
  { name: `02_empresas_${d}.csv`, content: rowsToCSVString(db.companies || []) },
  { name: `03_contatos_${d}.csv`, content: rowsToCSVString(db.contacts || []) },
  { name: `04_editais_petronect_${d}.csv`, content: rowsToCSVString(db.petronect || []) },
  { name: `05_portais_${d}.csv`, content: rowsToCSVString(db.portals || []) },
  { name: `06_historico_portais_${d}.csv`, content: rowsToCSVString(db.portalHistory || []) },
  { name: `07_tarefas_atividades_${d}.csv`, content: rowsToCSVString(db.activities || []) },
  { name: `08_licitacoes_${d}.csv`, content: rowsToCSVString(db.licitacoes || []) }
 ];
 let zipBlob = createZipBlob(files);
 downloadBlob(zipBlob, `advance_crm_todas_as_abas_${d}.zip`);
}
/* ========================================================================================= */

function downloadBlob(blob,name){let a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
$('#importFile').onchange=e=>{let f=e.target.files[0];if(!f)return;let r=new FileReader();r.onload=()=>{try{let data=JSON.parse(r.result);if(!data||(!Array.isArray(data.opportunities) && !Array.isArray(data.companies)))throw Error();if(confirm('A restauração substituirá os dados atuais. Deseja continuar?')){db={...emptyDB(),...data};if(!Array.isArray(db.users)||!db.users.length)db.users=[defaultAdminUser()];saveDB();render();alert('Backup restaurado com sucesso.')}}catch(err){alert('Arquivo JSON inválido ou incompatível.')}e.target.value=''};r.readAsText(f)};
function exportCSV(rows,name){if(!rows.length){alert('Não há registros para exportar.');return}let keys=Object.keys(rows[0]),csv=[keys.join(';'),...rows.map(r=>keys.map(k=>'"'+String(r[k]??'').replace(/"/g,'""')+'"').join(';'))].join('\r\n');downloadBlob(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}),name)}
function exportCSVCurrent(){
 if(page==='opportunities')exportCSV(db.opportunities,'advance_oportunidades.csv');
 else if(page==='petronect')exportCSV(db.petronect,'advance_petronect.csv');
 else if(page==='portals_base')exportCSV(db.portals||[],'advance_portais.csv');
 else if(page==='portals_history')exportCSV(db.portalHistory||[],'advance_portais_historico.csv');
 else if(page==='companies')exportCSV(db.companies,'advance_empresas.csv');
 else if(page==='contacts')exportCSV(db.contacts,'advance_contatos.csv');
 else if(page==='activities')exportCSV(db.activities,'advance_atividades.csv');
}

document.querySelectorAll('[data-page]').forEach(b=>b.addEventListener('click',()=>setPage(b.dataset.page)));
checkExistingSession();