// ─── OVERVIEW + PDF + INIT ───────────────────────────────────────────────────
let _ganttFilter = 'all';

function renderGlobal(){
  const total=S.innovations.length;
  const lateCount=S.innovations.filter(innoHasLateStep).length;
  const onTimeCount=total-lateCount;

  document.getElementById('globalKPIs').innerHTML=`
    <div class="kpi"><div class="lbl">Total innovations 2027</div><div class="val">${total}</div></div>
    <div class="kpi"><div class="lbl">On time</div><div class="val" style="color:${onTimeCount?'var(--ok)':'var(--tx)'}">${onTimeCount}</div></div>
    <div class="kpi"><div class="lbl">Late</div><div class="val" style="color:${lateCount?'var(--err)':'var(--tx)'}">${lateCount}</div></div>
  `;

  if(!S.innovations.length){
    document.getElementById('globalGantt').innerHTML='<div class="empty-state"><div class="icon">📅</div><p>No innovations to display</p></div>';
    return;
  }

  // ── LAUNCH DATE SUMMARY BAR ──
  const launchItems = S.innovations.map(inno=>{
    const range = innoRange(inno);
    const late = innoHasLateStep(inno);
    return {inno, end: range.end, late};
  }).filter(x=>x.end).sort((a,b)=>a.end.localeCompare(b.end));

  const launchBar = launchItems.length ? `
    <div id="launch-summary" style="display:flex;gap:8px;flex-wrap:wrap;padding:10px 16px;background:var(--s1);border-bottom:1px solid var(--bd);overflow-x:auto;scrollbar-width:thin">
      ${launchItems.map(({inno,end,late})=>`
        <div data-inno-filter="${inno.id}" style="display:flex;align-items:center;gap:6px;background:var(--s0);border:1px solid ${late?'var(--err)':'var(--bd)'};border-radius:8px;padding:5px 10px;white-space:nowrap;cursor:pointer;flex-shrink:0">
          <div style="width:8px;height:8px;border-radius:50%;background:${inno.color}"></div>
          <span style="font-size:12px;font-weight:600;color:var(--tx)">${esc(inno.name)}</span>
          <span style="font-size:11px;color:${late?'var(--err)':'var(--tx3)'}">${late?'⚠ ':''} ${fmtDate(end)}</span>
        </div>`).join('')}
    </div>` : '';

  // ── CATEGORY FILTER ──
  const order=[...CATEGORY_LIST,'Other'];
  const grouped={};
  S.innovations.forEach(inno=>{
    const cat=CATEGORY_LIST.includes(inno.category)?inno.category:'Other';
    if(!grouped[cat]) grouped[cat]=[];
    grouped[cat].push(inno);
  });
  const cats=order.filter(c=>grouped[c]);

  const prevFilter = _ganttFilter;

  const filterBar = `
    <div style="display:flex;align-items:center;gap:8px;padding:8px 16px;border-bottom:1px solid var(--bd);background:var(--s0);flex-wrap:wrap">
      <span style="font-size:11px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em">Filter:</span>
      <select id="gantt-cat-filter" onchange="_ganttFilter=this.value;renderGlobal()" style="font-size:12px;padding:4px 10px;border:1px solid var(--bd2);border-radius:var(--r);font-family:inherit;background:var(--s0);color:var(--tx);cursor:pointer">
        <option value="all" ${prevFilter==='all'?'selected':''}>All</option>
        ${cats.map(c=>`<option value="cat:${esc(c)}" ${prevFilter==='cat:'+c?'selected':''}>${esc(c)} (${grouped[c].length})</option>`).join('')}
        <optgroup label="Single innovation">
        ${S.innovations.map(i=>`<option value="inno:${i.id}" ${prevFilter==='inno:'+i.id?'selected':''}>${esc(i.name)}</option>`).join('')}
        </optgroup>
      </select>
      <div id="gantt-nav" style="display:flex;align-items:center;gap:8px;flex:1;margin-left:16px;min-width:0">
        <button class="btn btn-sm btn-ghost" onclick="ganttScroll(-4)" style="flex-shrink:0" title="4 weeks left">◀</button>
        <div style="flex:1;position:relative;height:6px;background:var(--bd);border-radius:99px;cursor:pointer;min-width:60px" id="gantt-scrolltrack" onclick="ganttScrollTrackClick(event)">
          <div id="gantt-scrollthumb" style="position:absolute;top:0;height:6px;background:var(--acc);border-radius:99px;min-width:30px;opacity:.6;pointer-events:none"></div>
        </div>
        <button class="btn btn-sm btn-ghost" onclick="ganttScroll(4)" style="flex-shrink:0" title="4 weeks right">▶</button>
        <button class="btn btn-sm" onclick="ganttScrollToToday()" style="border-color:var(--acc);color:var(--acc);font-size:11px;flex-shrink:0">Today</button>
      </div>
    </div>`;

  // Active filter value
  const activeFilter = prevFilter;
  let visibleInnovations;
  if(activeFilter==='all'){
    visibleInnovations = cats.flatMap(c=>grouped[c]);
  } else if(activeFilter.startsWith('inno:')){
    const innoId = activeFilter.slice(5);
    visibleInnovations = S.innovations.filter(i=>i.id===innoId);
  } else {
    const cat = activeFilter.startsWith('cat:') ? activeFilter.slice(4) : activeFilter;
    visibleInnovations = (grouped[cat]||[]);
  }
  // Recompute visibleCats from visibleInnovations
  const visibleCats = [...new Set(visibleInnovations.map(i=>CATEGORY_LIST.includes(i.category)?i.category:'Other'))].filter(c=>cats.includes(c));

  // ── DATE RANGE ──
  const allDates=[];
  visibleInnovations.forEach(inno=>{
    const dates=computeDates(inno);
    inno.phases.forEach(ph=>ph.steps.forEach(s=>{
      const d=dates[s.id];
      if(d?.start) allDates.push(d.start);
      if(d?.end) allDates.push(d.end);
    }));
  });
  if(!allDates.length){
    document.getElementById('globalGantt').innerHTML=launchBar+filterBar+'<div class="empty-state"><div class="icon">📅</div><p>No innovations to display</p></div>';
    return;
  }
  allDates.sort();

  function mondayOf(dateStr){
    const d=new Date(dateStr); const day=d.getDay();
    const diff=d.getDate()-(day===0?6:day-1); return new Date(d.setDate(diff));
  }
  function toISO(d){ return d.toISOString().slice(0,10); }
  const firstMon=mondayOf(allDates[0]);
  const lastDate=new Date(allDates[allDates.length-1]);
  lastDate.setDate(lastDate.getDate()+14);
  const weeks=[]; let wCur=new Date(firstMon);
  while(wCur<=lastDate){ weeks.push(new Date(wCur)); wCur.setDate(wCur.getDate()+7); }

  const COL=36, LABEL_W=200, DATE_W=140, ROW_H=28, FIXED_W=LABEL_W+DATE_W;
  const totalW=weeks.length*COL;
  const todayISO=todayStr();

  function weekX(dateStr){
    if(!dateStr) return 0;
    const d=new Date(dateStr);
    const diffDays=(d-firstMon)/86400000;
    return Math.max(0,Math.round((diffDays/7)*COL));
  }
  function getWeekNum(d){
    const jan1=new Date(d.getFullYear(),0,1);
    return Math.ceil(((d-jan1)/86400000+jan1.getDay()+1)/7);
  }
  const todayX=weekX(todayISO);

  let monthSpans=[];
  weeks.forEach((w,i)=>{
    const key=`${w.getFullYear()}-${w.getMonth()}`;
    if(!monthSpans.length||monthSpans[monthSpans.length-1].key!==key)
      monthSpans.push({key,label:`${MONTHS_SHORT[w.getMonth()]} ${w.getFullYear()}`,count:1});
    else monthSpans[monthSpans.length-1].count++;
  });

  // ── BUILD HTML ──
  // Use a two-panel approach: left fixed panel + right scrollable timeline
  // We build them in sync then join
  let leftRows = '';
  let rightRows = '';

  // Header row
  const headerLeft = `<div style="display:flex;height:52px;background:var(--s1);border-bottom:1px solid var(--bd);position:sticky;top:0;z-index:30">
    <div style="width:${LABEL_W}px;min-width:${LABEL_W}px;padding:0 12px;font-size:10px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em;display:flex;align-items:flex-end;padding-bottom:4px;border-right:1px solid var(--bd)">Step</div>
    <div style="width:${DATE_W}px;min-width:${DATE_W}px;padding:0 8px;font-size:10px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em;display:flex;align-items:flex-end;padding-bottom:4px;border-right:1px solid var(--bd2)">Start → End · Wks</div>
  </div>`;

  const headerRight = `<div style="min-width:${totalW}px;height:52px;background:var(--s1);border-bottom:1px solid var(--bd);position:sticky;top:0;z-index:30">
    <div style="display:flex;height:26px;border-bottom:1px solid var(--bd)">
      ${monthSpans.map(ms=>`<div style="width:${ms.count*COL}px;font-size:11px;font-weight:600;color:var(--tx2);padding:4px 6px;border-right:1px solid var(--bd);white-space:nowrap;overflow:hidden;flex-shrink:0">${ms.label}</div>`).join('')}
    </div>
    <div style="display:flex;height:26px">
      ${weeks.map(w=>{
        const iso=toISO(w);
        const isNow=iso<=todayISO&&todayISO<toISO(new Date(w.getTime()+7*86400000));
        return `<div style="width:${COL}px;font-size:9px;color:${isNow?'var(--acc)':'var(--tx3)'};font-weight:${isNow?700:400};text-align:center;padding:3px 0;border-right:1px solid var(--bd);flex-shrink:0;background:${isNow?'var(--acc-bg)':''}">W${getWeekNum(w)}</div>`;
      }).join('')}
    </div>
  </div>`;

  function addRow(leftHtml, rightHtml, rowStyle='') {
    leftRows += `<div style="display:flex;border-bottom:1px solid var(--bd);min-height:${ROW_H}px${rowStyle?';'+rowStyle:''}">${leftHtml}</div>`;
    rightRows += `<div style="min-width:${totalW}px;border-bottom:1px solid var(--bd);min-height:${ROW_H}px;position:relative${rowStyle?';'+rowStyle:''}">
      ${rightHtml}
      <div style="position:absolute;top:0;bottom:0;left:${todayX}px;width:2px;background:#e34948;opacity:.35;pointer-events:none"></div>
    </div>`;
  }

  visibleCats.forEach(cat=>{
    const catInno=visibleInnovations.filter(i=>(CATEGORY_LIST.includes(i.category)?i.category:'Other')===cat);
    const catLate=catInno.filter(innoHasLateStep).length;
    // Category header
    addRow(
      `<div style="width:${LABEL_W}px;min-width:${LABEL_W}px;padding:5px 12px;font-size:11px;font-weight:700;color:var(--tx2);text-transform:uppercase;letter-spacing:.05em;display:flex;align-items:center;gap:6px;border-right:1px solid var(--bd)">
        ${esc(cat)}<span style="font-weight:400;color:var(--tx3)">${catInno.length}</span>${catLate?`<span style="color:var(--err);font-size:10px">⚠ ${catLate} late</span>`:''}
      </div>
      <div style="width:${DATE_W}px;min-width:${DATE_W}px;border-right:1px solid var(--bd2)"></div>`,
      '',
      'background:var(--s2)'
    );

    catInno.forEach(inno=>{
      const dates=computeDates(inno);
      const lateFlag=innoHasLateStep(inno);
      const range=innoRange(inno);
      // Innovation header
      addRow(
        `<div style="width:${LABEL_W}px;min-width:${LABEL_W}px;padding:5px 12px;display:flex;align-items:center;gap:6px;border-right:1px solid var(--bd);overflow:hidden;cursor:pointer" data-goto-inno="${inno.id}">     <div style="width:10px;height:10px;border-radius:50%;background:${inno.color};flex-shrink:0"></div>
          <span style="font-size:12px;font-weight:700;color:var(--tx);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${lateFlag?'⚠ ':''}${esc(inno.name)}</span>
        </div>
        <div style="width:${DATE_W}px;min-width:${DATE_W}px;border-right:1px solid var(--bd2);padding:0 8px;display:flex;align-items:center;gap:4px;overflow:hidden">
          <span class="badge ${RESP_CLS[inno.resp]||'badge-gray'}" style="font-size:10px;flex-shrink:0">${inno.resp}</span>
          ${range.end?`<span style="font-size:11px;font-weight:600;color:${lateFlag?'var(--err)':'var(--tx2)'};white-space:nowrap">→ ${fmtDate(range.end)}</span>`:''}
        </div>`,
        '',
        'background:var(--s1)'
      );

      inno.phases.forEach(ph=>{
        // Phase sub-header
        addRow(
          `<div style="width:${LABEL_W}px;min-width:${LABEL_W}px;padding:3px 12px 3px 16px;display:flex;align-items:center;gap:5px;border-right:1px solid var(--bd);overflow:hidden">
            <div style="width:3px;height:14px;border-radius:2px;background:${ph.color};flex-shrink:0"></div>
            <span style="font-size:10px;font-weight:700;color:var(--tx2);text-transform:uppercase;letter-spacing:.04em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(ph.name)}</span>
          </div>
          <div style="width:${DATE_W}px;min-width:${DATE_W}px;border-right:1px solid var(--bd2);padding:0 8px;display:flex;align-items:center">
            <span style="font-size:10px;color:var(--tx3)">${ph.steps.reduce((a,s)=>a+(parseFloat(s.weeks)||0),0)}w total</span>
          </div>`,
          ''
        );

        ph.steps.forEach(step=>{
          const d=dates[step.id]||{};
          const late=isStepLate(step,dates);
          const sm=statusMeta(step.status);
          const x=d.start?weekX(d.start):null;
          const x2=d.end?weekX(d.end):null;
          const barW=x!==null&&x2!==null?Math.max(x2-x,8):0;
          const pinnedIcon=step.startOverride?'📌 ':'';
          addRow(
            `<div style="width:${LABEL_W}px;min-width:${LABEL_W}px;padding:0 12px 0 20px;display:flex;align-items:center;gap:5px;border-right:1px solid var(--bd);overflow:hidden${late?';background:var(--err-bg)':''}">
              <div style="width:3px;height:12px;border-radius:2px;background:${ph.color};flex-shrink:0"></div>
              <span style="font-size:11px;font-weight:500;color:${late?'var(--err)':'var(--tx2)'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1" title="${esc(step.name)}">${pinnedIcon}${esc(step.name)}</span>
              <select class="${late?'status-late':sm.cls}"
                data-step-id="${step.id}"
                style="font-size:10px;padding:2px 5px;border-radius:99px;border:1px solid;flex-shrink:0;white-space:nowrap;cursor:pointer;font-family:inherit;font-weight:500;-webkit-appearance:none;appearance:none;background:transparent"
                onchange="quickUpdateStatus('${inno.id}','${ph.id}','${step.id}',this.value);event.stopPropagation()"
                onclick="event.stopPropagation()">
                ${late?`<option value="todo" selected>⚠ Late</option>`:''}
                ${STEP_STATUSES.map(s=>`<option value="${s.v}" ${step.status===s.v?'selected':''}>${s.label}</option>`).join('')}
              </select>
            </div>
            <div style="width:${DATE_W}px;min-width:${DATE_W}px;padding:0 8px;border-right:1px solid var(--bd2);display:flex;flex-direction:column;justify-content:center;overflow:hidden${late?';background:var(--err-bg)':''}">
              ${d.start?`<span style="font-size:10px;color:${late?'var(--err)':'var(--tx2)'};white-space:nowrap;font-weight:500">${fmtDate(d.start)} → ${fmtDate(d.end)}</span>`:'<span style="font-size:10px;color:var(--tx3)">—</span>'}
              ${d.start?`<span style="font-size:10px;color:var(--tx3);white-space:nowrap">${step.weeks}w${step.startOverride?' 📌':''}</span>`:''}
            </div>`,
            x!==null&&barW>0?`<div style="position:absolute;top:50%;transform:translateY(-50%);left:${x}px;width:${barW}px;height:12px;border-radius:3px;background:${ph.color};opacity:${late?0.4:0.85};${late?'outline:1.5px solid var(--err);outline-offset:1px':''}" title="${esc(step.name)}: ${fmtDate(d.start)} → ${fmtDate(d.end)} · ${step.weeks}w"></div>`:''
          );
        });
      });
    });
  });

  // Build final layout: fixed left + scrollable right, both same rows
  const ganttHtml = `
  ${launchBar}
  ${filterBar}
  <div style="display:flex;overflow:hidden">
    <!-- Fixed left columns -->
    <div style="flex-shrink:0;width:${FIXED_W}px;overflow:hidden;z-index:10;box-shadow:3px 0 8px rgba(0,0,0,.08)">
      ${headerLeft}
      <div id="gantt-left-scroll" style="overflow:hidden;max-height:calc(100vh - 260px)">
        ${leftRows}
      </div>
    </div>
    <!-- Scrollable right timeline -->
    <div id="gantt-scroll-wrap" style="flex:1;overflow-x:auto;overflow-y:auto;max-height:calc(100vh - 260px);scrollbar-width:thin" onscroll="syncGanttScroll(this)">
      ${headerRight}
      <div id="gantt-right-rows">
        ${rightRows}
      </div>
    </div>
  </div>`;

  const ganttEl2 = document.getElementById('globalGantt');
  ganttEl2.innerHTML = ganttHtml;

  // Single event delegation on the container — handles all chip and row clicks
  ganttEl2.addEventListener('click', e=>{
    const chip = e.target.closest('[data-inno-filter]');
    if(chip){
      filterGanttToInno(chip.dataset.innoFilter);
      return;
    }
    const row = e.target.closest('[data-goto-inno]');
    if(row) selectAndGoDetail(row.dataset.gotoInno);
  });

  requestAnimationFrame(()=>ganttScrollToToday());
}


function ganttScroll(weeks){
  const wrap=document.getElementById('gantt-scroll-wrap');
  if(wrap){ wrap.scrollLeft+=weeks*36; updateGanttThumb(wrap); }
}
function ganttScrollToToday(){
  const wrap=document.getElementById('gantt-scroll-wrap');
  if(!wrap) return;
  const allDates=[];
  S.innovations.forEach(inno=>{
    const dates=computeDates(inno);
    inno.phases.forEach(ph=>ph.steps.forEach(s=>{
      const d=dates[s.id];
      if(d?.start) allDates.push(d.start);
    }));
  });
  if(!allDates.length) return;
  allDates.sort();
  function mondayOf(ds){ const d=new Date(ds); const day=d.getDay(); const diff=d.getDate()-(day===0?6:day-1); return new Date(d.setDate(diff)); }
  const firstMon=mondayOf(allDates[0]);
  const today=new Date(todayStr());
  const diffDays=(today-firstMon)/86400000;
  const x=Math.max(0,Math.round((diffDays/7)*36));
  wrap.scrollLeft=Math.max(0, x - wrap.clientWidth/2);
  updateGanttThumb(wrap);
}
function updateGanttThumb(wrap){
  const track=document.getElementById('gantt-scrolltrack');
  const thumb=document.getElementById('gantt-scrollthumb');
  if(!track||!thumb||!wrap) return;
  const ratio=wrap.clientWidth/wrap.scrollWidth;
  const thumbW=Math.max(track.clientWidth*ratio, 30);
  const maxScroll=wrap.scrollWidth-wrap.clientWidth;
  const pos=maxScroll>0?(wrap.scrollLeft/maxScroll)*(track.clientWidth-thumbW):0;
  thumb.style.width=thumbW+'px';
  thumb.style.left=pos+'px';
}
function ganttScrollTrackClick(e){
  const wrap=document.getElementById('gantt-scroll-wrap');
  const track=document.getElementById('gantt-scrolltrack');
  if(!wrap||!track) return;
  const rect=track.getBoundingClientRect();
  const pct=(e.clientX-rect.left)/rect.width;
  wrap.scrollLeft=pct*(wrap.scrollWidth-wrap.clientWidth);
  updateGanttThumb(wrap);
}

function filterGanttToInno(innoId){
  _ganttFilter = 'inno:' + innoId;
  renderGlobal();
}

function selectAndGoDetail(id){
  S.selectedId=id; save();
  document.querySelectorAll('.nav-tab')[0].click();
  renderInnoList(); renderDetail();
}

// ─── MODAL HELPERS ────────────────────────────────────────────────────────────
function closeModal(){document.getElementById('overlay').style.display='none';}
function overlayBg(e){if(e.target.id==='overlay')closeModal();}

// ─── PDF EXPORT ──────────────────────────────────────────────────────────────
function openPdfPicker(){
  const list = document.getElementById('pdf-inno-list');
  if(!S.innovations.length){
    list.innerHTML='<p style="font-size:13px;color:var(--tx3)">No innovations yet.</p>';
  } else {
    const order=[...CATEGORY_LIST,'Other'];
    const grouped={};
    S.innovations.forEach(inno=>{
      const cat=CATEGORY_LIST.includes(inno.category)?inno.category:'Other';
      if(!grouped[cat]) grouped[cat]=[];
      grouped[cat].push(inno);
    });
    let html='';
    order.filter(c=>grouped[c]).forEach(cat=>{
      html+=`<div style="font-size:10px;font-weight:700;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em;padding:8px 0 4px">${esc(cat)}</div>`;
      grouped[cat].forEach(inno=>{
        const range=innoRange(inno);
        html+=`<button onclick="exportPdf('${inno.id}')" style="display:flex;align-items:center;gap:10px;padding:10px 14px;border:1.5px solid var(--bd);border-radius:var(--r);background:var(--s0);cursor:pointer;text-align:left;width:100%;font-family:inherit;transition:border-color .15s" onmouseover="this.style.borderColor='var(--acc)'" onmouseout="this.style.borderColor='var(--bd)'">
          <div style="width:10px;height:10px;border-radius:50%;background:${inno.color};flex-shrink:0"></div>
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:600;color:var(--tx)">${esc(inno.name)}</div>
            <div style="font-size:11px;color:var(--tx3);margin-top:2px">${esc(inno.category)} · ${inno.resp}${range.start?' · '+fmtDate(range.start)+' → '+fmtDate(range.end):''}</div>
          </div>
          <span style="font-size:12px;color:var(--acc);flex-shrink:0">PDF →</span>
        </button>`;
      });
    });
    list.innerHTML=html;
  }
  document.getElementById('pdf-overlay').classList.add('open');
}
function closePdfPicker(e){
  if(e.target.id==='pdf-overlay') document.getElementById('pdf-overlay').classList.remove('open');
}
function closePdfModal(){
  document.getElementById('pdf-overlay').classList.remove('open');
}
function exportPdf(innoId){
  // Select the innovation, switch to detail view, update print header, then print
  S.selectedId=innoId;
  renderInnoList();
  renderDetail();
  // Switch to detail tab if not already there
  const detailTab=document.querySelector('.nav-tab');
  if(detailTab && !detailTab.classList.contains('active')){
    detailTab.click();
  }
  document.getElementById('pdf-overlay').classList.remove('open');
  // Update print header
  const inno=S.innovations.find(i=>i.id===innoId);
  const range=innoRange(inno);
  const totalW=inno.phases.flatMap(p=>p.steps).reduce((a,s)=>a+(parseFloat(s.weeks)||0),0);
  const meta=document.getElementById('print-meta');
  if(meta && inno){
    meta.textContent=`${inno.name} · ${inno.category} · Owner: ${inno.resp} · ${range.start?fmtDate(range.start)+' → '+fmtDate(range.end):''} · ${totalW} weeks total · Exported ${fmtDate(todayStr())}`;
  }
  // Small delay to let render complete, then print
  setTimeout(()=>window.print(), 200);
}

// ─── INIT ────────────────────────────────────────────────────────────────────
function quickUpdateStatus(innoId, phId, stepId, newStatus) {
  const inno = S.innovations.find(i=>i.id===innoId);
  if (!inno) return;
  const ph = inno.phases.find(p=>p.id===phId);
  if (!ph) return;
  const step = ph.steps.find(s=>s.id===stepId);
  if (!step) return;
  const oldStatus = step.status;
  step.status = newStatus;
  logChange(innoId, inno.name, 'STATUS_CHANGED', step.name, oldStatus, newStatus);
  save();
  renderInnoList();
  // Update just the status badge in the current row without full re-render
  const sel = document.querySelector(`[data-step-id="${stepId}"]`);
  if(sel){ sel.className = statusMeta(newStatus).cls; }
}

function syncGanttScroll(rightEl) {
  const leftScroll = document.getElementById('gantt-left-scroll');
  if (leftScroll) leftScroll.scrollTop = rightEl.scrollTop;
  updateGanttThumb(rightEl);
}
