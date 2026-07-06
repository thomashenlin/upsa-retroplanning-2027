// ─── RETROPLANNING ───────────────────────────────────────────────────────────
let S = {innovations:[],selectedId:null};

// ─── DATE MATH ────────────────────────────────────────────────────────────────
function addWeeks(dateStr, weeks){const d=new Date(dateStr);d.setDate(d.getDate()+weeks*7);return d.toISOString().slice(0,10);}
function subWeeks(dateStr, weeks){return addWeeks(dateStr,-weeks);}
function fmtDate(d){if(!d)return '';const [y,m,day]=d.split('-');return `${parseInt(day)} ${MONTHS_SHORT[parseInt(m)-1]} ${y}`;}
function fmtWeek(d){if(!d)return '';const dt=new Date(d);const jan1=new Date(dt.getFullYear(),0,1);const w=Math.ceil(((dt-jan1)/86400000+jan1.getDay()+1)/7);return `S${w} ${dt.getFullYear()}`;}

function computeDates(inno){
  const allSteps=[];
  inno.phases.forEach(ph=>ph.steps.forEach(s=>allSteps.push({...s,phaseId:ph.id})));
  if(!allSteps.length) return {};
  const anchor = inno.anchorDate || todayStr();
  const dates={};
  if(inno.mode==='backward'){
    let cursor=anchor;
    [...allSteps].reverse().forEach(s=>{
      const w=parseFloat(s.weeks)||0;
      // If this step has a manual override, pin its start and reset the cursor
      if(s.startOverride){
        const end=addWeeks(s.startOverride,w);
        dates[s.id]={start:s.startOverride, end, pinned:true};
        cursor=s.startOverride; // next step (going backwards) ends where this one starts
      } else {
        const end=cursor, start=subWeeks(end,w);
        dates[s.id]={start,end};
        cursor=start;
      }
    });
  } else {
    let cursor=anchor;
    allSteps.forEach(s=>{
      const w=parseFloat(s.weeks)||0;
      if(s.startOverride){
        const end=addWeeks(s.startOverride,w);
        dates[s.id]={start:s.startOverride, end, pinned:true};
        cursor=end; // next step starts after this one ends
      } else {
        const start=cursor, end=addWeeks(start,w);
        dates[s.id]={start,end};
        cursor=end;
      }
    });
  }
  return dates;
}

function phaseRange(ph,dates){
  const starts=ph.steps.map(s=>dates[s.id]?.start).filter(Boolean);
  const ends=ph.steps.map(s=>dates[s.id]?.end).filter(Boolean);
  if(!starts.length) return {start:null,end:null};
  return {start:starts.sort()[0], end:ends.sort().reverse()[0]};
}
function innoRange(inno){
  const dates=computeDates(inno);
  const all=inno.phases.flatMap(ph=>ph.steps);
  const starts=all.map(s=>dates[s.id]?.start).filter(Boolean);
  const ends=all.map(s=>dates[s.id]?.end).filter(Boolean);
  if(!starts.length) return {start:null,end:null};
  return {start:starts.sort()[0], end:ends.sort().reverse()[0]};
}

// Step is "late" if computed start date is in the past AND status is still 'todo'
function isStepLate(step, computedDates){
  if(step.status !== 'todo') return false;
  const d = computedDates[step.id];
  if(!d || !d.start) return false;
  return d.start < todayStr();
}
function innoHasLateStep(inno){
  const dates = computeDates(inno);
  return inno.phases.some(ph=>ph.steps.some(s=>isStepLate(s,dates)));
}
function countLateWeeks(inno){
  const dates = computeDates(inno);
  let maxLateDays = 0;
  inno.phases.forEach(ph=>ph.steps.forEach(s=>{
    if(isStepLate(s,dates)){
      const days = (new Date(todayStr()) - new Date(dates[s.id].start)) / 86400000;
      maxLateDays = Math.max(maxLateDays, days);
    }
  }));
  return Math.ceil(maxLateDays/7);
}

// ─── NAV ──────────────────────────────────────────────────────────────────────

function showPage(p, btn){
  document.querySelectorAll('.page').forEach(el=>el.classList.remove('active'));
  document.getElementById('page-'+p).classList.add('active');
  document.querySelectorAll('.nav-tab').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  if(p==='global') renderGlobal();
  if(p==='settings') renderSettings();
}

// ─── INNOVATION LIST ─────────────────────────────────────────────────────────

function renderInnoList(){
  const el=document.getElementById('innoList');
  if(!S.innovations.length){ el.innerHTML='<div style="padding:16px;font-size:13px;color:var(--tx3);text-align:center">No innovations yet</div>'; return; }
  // Group by category, preserving CATEGORY_LIST order, then uncategorised at end
  const order = [...CATEGORY_LIST, 'Other'];
  const grouped = {};
  S.innovations.forEach(inno=>{
    const cat = CATEGORY_LIST.includes(inno.category) ? inno.category : 'Other';
    if(!grouped[cat]) grouped[cat]=[];
    grouped[cat].push(inno);
  });
  const cats = order.filter(c=>grouped[c]);
  let html = '';
  cats.forEach(cat=>{
    html += `<div style="padding:6px 14px 4px;font-size:10px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.06em;background:var(--s1);border-bottom:1px solid var(--bd)">${esc(cat)}<span style="float:right;font-weight:400">${grouped[cat].length}</span></div>`;
    grouped[cat].forEach(inno=>{
      const late = innoHasLateStep(inno);
      html += `<div class="inno-item${S.selectedId===inno.id?' active':''}" onclick="selectInno('${inno.id}')">
        <div class="inno-dot" style="background:${inno.color}"></div>
        <div class="inno-info">
          <div class="inno-name">${late?'<span class="inno-risk-flag" style="display:inline-block;margin-right:5px"></span>':''}${esc(inno.name)}</div>
          <div class="inno-meta"><span class="badge ${RESP_CLS[inno.resp]||'badge-gray'}">${inno.resp}</span>${late?' · <span style="color:var(--err);font-weight:500">late</span>':''}</div>
        </div>
      </div>`;
    });
  });
  el.innerHTML = html;
}
function selectInno(id){ S.selectedId=id; save(); renderInnoList(); renderDetail(); }

// ─── DETAIL PANE ─────────────────────────────────────────────────────────────

function renderDetail(){
  const inno=S.innovations.find(i=>i.id===S.selectedId);
  const el=document.getElementById('detailPane');
  if(!inno){ el.innerHTML=`<div class="empty-state"><div class="icon">📋</div><p>Select an innovation</p></div>`; return; }

  const dates=computeDates(inno);
  const range=innoRange(inno);
  const totalW=inno.phases.flatMap(p=>p.steps).reduce((a,s)=>a+(parseFloat(s.weeks)||0),0);
  const lateWeeks = countLateWeeks(inno);
  const hasLate = lateWeeks > 0;

  const isBackward = inno.mode!=='forward';

  // Find critical step (first late or next upcoming todo)
  let criticalLabel = '';
  if(hasLate){
    const lateSteps = [];
    inno.phases.forEach(ph=>ph.steps.forEach(s=>{ if(isStepLate(s,dates)) lateSteps.push(s); }));
    if(lateSteps.length) criticalLabel = lateSteps[0].name;
  }

  let html = `
  <div class="retro-header">
    <div class="retro-title-row">
      <div class="inno-dot" style="background:${inno.color};width:12px;height:12px"></div>
      <div class="retro-title">${esc(inno.name)}</div>
      <span class="badge ${RESP_CLS[inno.resp]||'badge-gray'}">${inno.resp}</span>
      ${inno.status!=='active'
        ? `<span style="font-size:11px;padding:3px 10px;border-radius:99px;background:var(--warn-bg);color:var(--warn);font-weight:600;border:1px solid #fac775">✏ Draft</span>`
        : `<span style="font-size:11px;padding:3px 10px;border-radius:99px;background:var(--ok-bg);color:var(--ok);font-weight:600;border:1px solid #5dcaa5">✓ Validated</span>`
      }
      <button class="btn btn-sm btn-ghost edit-only" onclick="openEditInno('${inno.id}')">✏ Edit</button>
      ${inno.status!=='active'
        ? `<button class="btn btn-sm edit-only" style="border-color:var(--ok);color:var(--ok)" onclick="validateInnovation('${inno.id}')">✓ Validate</button>`
        : `<button class="btn btn-sm btn-ghost" onclick="renderChangeLog('${inno.id}')">📋 History</button>`
      }
      <button class="btn btn-sm btn-danger edit-only" onclick="deleteInno('${inno.id}')">🗑</button>
    </div>

    <div class="anchor-box">
      <div class="anchor-question">How should dates be calculated for this retroplanning?</div>
      <div class="anchor-cards">
        <div class="anchor-card${isBackward?' selected':''}" onclick="setMode('${inno.id}','backward')">
          <div class="anchor-card-title">🚀 I know the launch date</div>
          <div class="anchor-card-sub">The tool calculates when each step needs to start to hit the launch date.</div>
        </div>
        <div class="anchor-card${!isBackward?' selected':''}" onclick="setMode('${inno.id}','forward')">
          <div class="anchor-card-title">📅 I know the start date</div>
          <div class="anchor-card-sub">The tool projects forward and calculates the resulting launch date.</div>
        </div>
      </div>
      <div class="anchor-date-row">
        <span style="font-size:12px;color:var(--tx2);font-weight:500">${isBackward?'Target launch date':'Start date'}</span>
        <input class="anchor-input" type="date" value="${inno.anchorDate||''}" onchange="setAnchor('${inno.id}',this.value)">
      </div>
      <div class="anchor-result">
        ${isBackward
          ? `To launch on <strong>${fmtDate(inno.anchorDate)}</strong>, the first step (<strong>${inno.phases[0]?.steps[0]?.name||'—'}</strong>) must start by <span class="accent">${range.start?fmtDate(range.start):'—'}</span>.`
          : `Starting on <strong>${fmtDate(inno.anchorDate)}</strong>, the launch is expected on <span class="accent">${range.end?fmtDate(range.end):'—'}</span>.`
        }
        &nbsp;· Total duration: <strong>${totalW} weeks</strong>
      </div>
      ${hasLate ? `
        <div class="alert-banner">
          <span class="ic">⚠</span>
          <span><strong>Delay detected</strong> — step "${esc(criticalLabel)}" should have started ${lateWeeks} week${lateWeeks>1?'s':''} ago. If nothing changes, the launch is at risk of slipping by the same amount. Mark late steps as "In progress" or "Done" once actioned, or adjust the dates below.</span>
        </div>` : ''}
    </div>
  </div>`;

  inno.phases.forEach((ph,pi)=>{
    const pr = phaseRange(ph, dates);
    html += renderPhaseBlock(inno, ph, pi, dates, pr);
  });

  html += `<div style="margin-top:12px;display:flex;gap:8px">
    <button class="btn btn-ghost" onclick="addPhase('${inno.id}')">+ Add a phase</button>
  </div>`;

  el.innerHTML = html;
}

function statusMeta(v){ return STEP_STATUSES.find(s=>s.v===v) || STEP_STATUSES[0]; }

function renderPhaseBlock(inno, ph, pi, dates, pr){
  const isOpen = !ph.collapsed;
  let html = `
  <div class="phase-block" id="phblock-${ph.id}">
    <div class="phase-hd" onclick="togglePhase('${inno.id}','${ph.id}')">
      <div class="phase-color" style="background:${ph.color}"></div>
      <div class="phase-title-wrap">
        <div class="phase-title">${esc(ph.name)}</div>
        <div class="phase-dates">${pr.start?fmtDate(pr.start)+' → '+fmtDate(pr.end):'—'} &nbsp;·&nbsp; ${ph.steps.reduce((a,s)=>a+(parseFloat(s.weeks)||0),0)} wks</div>
      </div>
      <div class="phase-actions" onclick="event.stopPropagation()">
        <button class="btn btn-sm btn-ghost" onclick="openEditPhase('${inno.id}','${ph.id}')">✏</button>
        <button class="btn btn-sm btn-ghost" style="color:var(--err)" onclick="deletePhase('${inno.id}','${ph.id}')">🗑</button>
      </div>
      <span class="phase-chevron${isOpen?' open':''}">›</span>
    </div>`;

  if(isOpen){
    html += `<table class="steps-table">
      <thead><tr>
        <th style="min-width:190px">Step</th>
        <th style="width:128px">Status</th>
        <th style="width:90px">Duration</th>
        <th style="width:124px">Start</th>
        <th style="width:124px">End</th>
        <th style="width:36px"></th>
      </tr></thead><tbody>`;

    ph.steps.forEach(step=>{
      const d = dates[step.id]||{};
      const late = isStepLate(step, dates);
      const sm = statusMeta(step.status);
      const rowCls = late ? ' is-late' : '';
      const statusOptions = STEP_STATUSES.map(s=>`<option value="${s.v}"${step.status===s.v?' selected':''}>${s.label}</option>`).join('');

      html += `
      <tr class="step-row${rowCls}" id="sr-${step.id}">
        <td class="step-name-cell">
          <input class="step-name-input" value="${esc(step.name)}" onchange="updateStep('${inno.id}','${ph.id}','${step.id}','name',this.value)" placeholder="Step name">
          <input class="step-note-input" value="${esc(step.note||'')}" onchange="updateStep('${inno.id}','${ph.id}','${step.id}','note',this.value)" placeholder="Note, condition, contact…">
          ${step.owner?`<div style="margin-top:3px"><span class="badge ${RESP_CLS[step.owner]||'badge-ext'}" style="font-size:10px">${esc(step.owner)}</span></div>`:''}
        </td>
        <td class="status-cell">
          <select class="status-select ${late?'status-late':sm.cls}" onchange="updateStep('${inno.id}','${ph.id}','${step.id}','status',this.value)">
            ${late?`<option value="todo" selected>⚠ Late</option>`:''}
            ${statusOptions}
          </select>
        </td>
        <td class="dur-cell">
          <div class="dur-wrap">
            <input class="dur-input" type="number" min="0" step="0.5" value="${step.weeks}" onchange="updateStep('${inno.id}','${ph.id}','${step.id}','weeks',parseFloat(this.value)||0)">
            <span class="dur-unit">wks</span>
          </div>
        </td>
        <td class="date-cell">
          <input class="date-editable" type="date" value="${step.startOverride||d.start||''}" onchange="overrideStart('${inno.id}','${ph.id}','${step.id}',this.value)" title="${step.startOverride?'📌 Manually pinned — overrides calculated date':'Calculated date — edit to pin'}">
          <div class="date-end" style="display:flex;align-items:center;gap:4px">
            ${d.start?fmtWeek(d.start):''}
            ${step.startOverride?`<span style="color:var(--acc);font-size:10px;cursor:pointer" onclick="clearOverride('${inno.id}','${ph.id}','${step.id}')" title="Remove pin — back to calculated date">📌</span>`:''}
          </div>
        </td>
        <td class="date-cell">
          <div class="date-display">${d.end?fmtDate(d.end):'—'}</div>
          <div class="date-end">${d.end?fmtWeek(d.end):''}</div>
        </td>
        <td class="step-actions-cell">
          <button class="del-step" onclick="deleteStep('${inno.id}','${ph.id}','${step.id}')" title="Delete">×</button>
        </td>
      </tr>`;
    });

    html += `</tbody></table>
    <div class="add-step-row"><button class="btn btn-sm btn-ghost" onclick="addStep('${inno.id}','${ph.id}')">+ Add a step</button></div>`;
  }
  html += `</div>`;
  return html;
}

// ─── MUTATIONS ────────────────────────────────────────────────────────────────
function setMode(innoId, mode){ const inno=S.innovations.find(i=>i.id===innoId); inno.mode=mode; save(); renderDetail(); }
function setAnchor(innoId, val){ const inno=S.innovations.find(i=>i.id===innoId); inno.anchorDate=val; save(); renderDetail(); }
function togglePhase(innoId, phId){ const inno=S.innovations.find(i=>i.id===innoId); const ph=inno.phases.find(p=>p.id===phId); ph.collapsed=!ph.collapsed; save(); renderDetail(); }
function updateStep(innoId, phId, stepId, field, val){
  const inno=S.innovations.find(i=>i.id===innoId);
  const ph=inno.phases.find(p=>p.id===phId);
  const step=ph.steps.find(s=>s.id===stepId);
  const oldVal = step[field];
  step[field]=val;
  // Log meaningful changes after validation
  if(['status','weeks','startOverride'].includes(field)){
    logChange(innoId, inno.name, 'STEP_CHANGED', `${step.name} — ${field}`, oldVal, val);
  }
  save(); renderDetail(); renderInnoList();
}
function overrideStart(innoId, phId, stepId, newStart){
  const inno=S.innovations.find(i=>i.id===innoId);
  const ph=inno.phases.find(p=>p.id===phId);
  const step=ph.steps.find(s=>s.id===stepId);
  if(newStart){
    step.startOverride = newStart;
  } else {
    delete step.startOverride;
  }
  save(); renderDetail();
}
function clearOverride(innoId, phId, stepId){
  const inno=S.innovations.find(i=>i.id===innoId);
  const ph=inno.phases.find(p=>p.id===phId);
  const step=ph.steps.find(s=>s.id===stepId);
  delete step.startOverride;
  save(); renderDetail(); notify('Date pin removed — back to calculated date');
}
function addStep(innoId, phId){
  const inno=S.innovations.find(i=>i.id===innoId);
  const ph=inno.phases.find(p=>p.id===phId);
  ph.steps.push({id:uid(), name:'Nouvelle étape', note:'', weeks:1, status:'todo', owner:''});
  save(); renderDetail();
}
function deleteStep(innoId, phId, stepId){
  const inno=S.innovations.find(i=>i.id===innoId);
  const ph=inno.phases.find(p=>p.id===phId);
  ph.steps=ph.steps.filter(s=>s.id!==stepId);
  save(); renderDetail(); renderInnoList();
}
function addPhase(innoId){
  const inno=S.innovations.find(i=>i.id===innoId);
  const col=PHASE_COLORS[inno.phases.length % PHASE_COLORS.length];
  inno.phases.push({id:uid(), name:'Nouvelle phase', color:col, collapsed:false, steps:[{id:uid(),name:'Étape 1',note:'',weeks:2,status:'todo',owner:''}]});
  save(); renderDetail();
}
function deletePhase(innoId, phId){
  if(!confirm('Delete this phase?')) return;
  const inno=S.innovations.find(i=>i.id===innoId);
  inno.phases=inno.phases.filter(p=>p.id!==phId);
  save(); renderDetail(); notify('Phase deleted');
}
function deleteInno(id){
  if(!confirm('Delete this innovation? This action is permanent.')) return;
  S.innovations=S.innovations.filter(i=>i.id!==id);
  S.selectedId=S.innovations[0]?.id||null;
  save(); renderInnoList(); renderDetail(); notify('Innovation deleted');
}

// ─── PHASE EDIT MODAL ───────────────────────────────────────────────────────

function openEditPhase(innoId, phId){
  const inno=S.innovations.find(i=>i.id===innoId);
  const ph=inno.phases.find(p=>p.id===phId);
  const swatches=PHASE_COLORS.map(c=>`<div class="color-swatch${ph.color===c?' selected':''}" style="background:${c}" onclick="document.getElementById('ph-color').value='${c}';document.querySelectorAll('.color-swatch').forEach(s=>s.classList.remove('selected'));this.classList.add('selected')"></div>`).join('');
  document.getElementById('modalBox').innerHTML=`
    <h2>Edit phase</h2>
    <div class="form-row"><label>Phase name</label><input id="ph-name" value="${esc(ph.name)}"></div>
    <div class="form-row"><label>Color</label><div class="phase-colors">${swatches}</div><input type="hidden" id="ph-color" value="${ph.color}"></div>
    <div class="modal-footer">
      <button class="btn" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="savePhase('${innoId}','${phId}')">Save</button>
    </div>`;
  document.getElementById('overlay').style.display='flex';
}
function savePhase(innoId, phId){
  const inno=S.innovations.find(i=>i.id===innoId);
  const ph=inno.phases.find(p=>p.id===phId);
  ph.name=document.getElementById('ph-name').value.trim()||ph.name;
  ph.color=document.getElementById('ph-color').value;
  save(); closeModal(); renderDetail(); notify('Phase updated ✓');
}

// ─── INNOVATION MODAL ────────────────────────────────────────────────────────
function openNewInno(){
  const swatches=PHASE_COLORS.map(c=>`<div class="color-swatch" style="background:${c}" onclick="document.getElementById('in-color').value='${c}';document.querySelectorAll('.color-swatch').forEach(s=>s.classList.remove('selected'));this.classList.add('selected')"></div>`).join('');
  const smcOpts=Object.entries(SMC_PROCEDURES).map(([k,v])=>`<option value="${k}">${v.label}</option>`).join('');
  document.getElementById('modalBox').innerHTML=`
    <h2>New innovation</h2>
    <div class="form-row"><label>Name *</label><input id="in-name" placeholder="E.g. Dafalgan Effervescent 500mg"></div>
    <div class="form-row"><label>Category</label><select id="in-cat">${CATEGORY_LIST.map(c=>`<option value="${c}">${c}</option>`).join('')}</select></div>
    <div class="form-row"><label>Color</label><div class="phase-colors">${swatches}</div><input type="hidden" id="in-color" value="${PHASE_COLORS[0]}"></div>
    <div class="form-row">
      <label style="display:block;font-size:12px;color:var(--tx3);font-weight:600;text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px">Product type</label>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div id="pt-drug" class="toggle-card on" onclick="selectProductType('drug')">
          <div class="toggle-check" id="pt-drug-check"><svg viewBox="0 0 16 16" fill="none"><path d="M3 8.5L6.5 12L13 4.5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
          <div><div class="toggle-title">💊 Drug</div><div class="toggle-sub">Regulated by Swissmedic. Includes regulatory submission process.</div></div>
        </div>
        <div id="pt-food" class="toggle-card" onclick="selectProductType('food')">
          <div class="toggle-check" id="pt-food-check"><svg viewBox="0 0 16 16" fill="none"><path d="M3 8.5L6.5 12L13 4.5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
          <div><div class="toggle-title">🌿 Food supplement</div><div class="toggle-sub">No Swissmedic submission. Standard UPSA launch process only.</div></div>
        </div>
      </div>
      <input type="hidden" id="in-product-type" value="drug">
    </div>
    <div id="smc-section" class="form-row">
      <label style="display:block;font-size:12px;color:var(--tx3);font-weight:600;text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px">Swissmedic procedure</label>
      <select id="in-smc" style="width:100%;padding:8px 10px;font-size:13px;border:1px solid var(--bd2);border-radius:var(--r);background:var(--s0);color:var(--tx);font-family:inherit;outline:none">${smcOpts}</select>
      <div id="smc-hint" style="font-size:11px;color:var(--tx3);margin-top:5px"></div>
    </div>
    <div class="modal-footer">
      <button class="btn" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveNewInno()">Create →</button>
    </div>`;
  document.getElementById('overlay').style.display='flex';
  setTimeout(()=>{
    selectProductType('drug');
    const sel=document.getElementById('in-smc');
    const hint=document.getElementById('smc-hint');
    if(!sel||!hint) return;
    const updateHint=()=>{
      const proc=SMC_PROCEDURES[sel.value];
      hint.textContent=proc?.totalCD?`Total Swissmedic timeline: ${proc.totalCD} calendar days (~${Math.round(proc.totalCD/7)} weeks)`:'';
    };
    sel.addEventListener('change', updateHint);
    updateHint();
  }, 0);
}

function selectProductType(type){
  ['drug','food'].forEach(t=>{
    const card=document.getElementById('pt-'+t);
    if(card) card.classList.toggle('on', t===type);
  });
  const smcSection=document.getElementById('smc-section');
  if(smcSection) smcSection.style.display=type==='drug'?'block':'none';
  const hidden=document.getElementById('in-product-type');
  if(hidden) hidden.value=type;
}

function saveNewInno(){
  const name=document.getElementById('in-name').value.trim();
  if(!name){alert('Name is required');return;}
  const productType = document.getElementById('in-product-type')?.value || 'drug';
  const isDrug = productType === 'drug';
  const smcKey = isDrug ? (document.getElementById('in-smc')?.value || Object.keys(SMC_PROCEDURES)[0]) : null;
  const smcPhases = isDrug ? deepCopy(SMC_PROCEDURES[smcKey]?.phases||[]).map(ph=>({...ph,id:uid(),steps:ph.steps.map(s=>({...s,id:uid()}))})) : [];
  const isComarketing = smcKey === 'comarketing';
  const upsaInternal = deepCopy(DEFAULT_PHASES_CORE).map(ph=>({...ph,id:uid(),steps:ph.steps.map(s=>({...s,id:uid()}))}));
  const phases = [
    ...(isComarketing ? [{...deepCopy(COMARKETING_PHASE), id:uid(), steps:deepCopy(COMARKETING_PHASE).steps.map(s=>({...s,id:uid()}))}] : []),
    ...smcPhases,
    ...upsaInternal,
  ];
  const inno={
    id:uid(), name, category:document.getElementById('in-cat').value||CATEGORY_LIST[0],
    resp:RESP_LIST[0],
    color:document.getElementById('in-color').value||PHASE_COLORS[0],
    mode:'backward', anchorDate:new Date(Date.now()+365*86400000).toISOString().slice(0,10),
    status:'draft',
    phases
  };
  S.innovations.push(inno); S.selectedId=inno.id;
  save(); closeModal(); renderInnoList(); renderDetail(); notify('Innovation created ✓');
}
function openEditInno(id){
  const inno=S.innovations.find(i=>i.id===id);
  const respOpts=RESP_LIST.map(r=>`<option value="${r}"${inno.resp===r?' selected':''}>${r}</option>`).join('');
  const catList = CATEGORY_LIST.includes(inno.category) ? CATEGORY_LIST : [inno.category, ...CATEGORY_LIST];
  const catOpts = catList.map(c=>`<option value="${esc(c)}"${inno.category===c?' selected':''}>${esc(c)}</option>`).join('');
  document.getElementById('modalBox').innerHTML=`
    <h2>Edit innovation</h2>
    <div class="form-row"><label>Name</label><input id="in-name" value="${esc(inno.name)}"></div>
    <div class="form-grid">
      <div class="form-row"><label>Category</label><select id="in-cat">${catOpts}</select></div>
      <div class="form-row"><label>UPSA owner</label><select id="in-resp">${respOpts}</select></div>
    </div>
    <div class="modal-footer">
      <button class="btn" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveEditInno('${id}')">Save</button>
    </div>`;
  document.getElementById('overlay').style.display='flex';
}
function saveEditInno(id){
  const inno=S.innovations.find(i=>i.id===id);
  inno.name=document.getElementById('in-name').value.trim()||inno.name;
  inno.category=document.getElementById('in-cat').value;
  inno.resp=document.getElementById('in-resp').value;
  save(); closeModal(); renderInnoList(); renderDetail(); notify('Saved ✓');
}

// ─── GLOBAL GANTT ───────────────────────────────────────────────────────────