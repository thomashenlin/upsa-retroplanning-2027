// ─── NOTES ───────────────────────────────────────────────────────────────────
// Notes are stored in the shared retroplanning_state under S.notes
// Structure: S.notes = { global: "text", byInno: { innoId: "text" } }

function ensureNotes() {
  if (!S.notes) S.notes = { global: '', byInno: {} };
  if (!S.notes.byInno) S.notes.byInno = {};
}

function renderNotes() {
  ensureNotes();
  const container = document.getElementById('notes-content');
  if (!container) return;

  // Build innovation list for tabs
  const order = [...CATEGORY_LIST, 'Other'];
  const grouped = {};
  S.innovations.forEach(inno => {
    const cat = CATEGORY_LIST.includes(inno.category) ? inno.category : 'Other';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(inno);
  });
  const cats = order.filter(c => grouped[c]);

  const activeNoteId = container.dataset.activeNote || 'global';

  // Sidebar tabs
  let tabs = `<div style="display:flex;flex-direction:column;gap:2px">
    <div class="note-tab${activeNoteId==='global'?' active':''}" onclick="switchNote('global')" style="display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:${activeNoteId==='global'?'600':'400'};color:${activeNoteId==='global'?'var(--acc)':'var(--tx)'};background:${activeNoteId==='global'?'var(--acc-bg)':'transparent'}">
      🌐 Team notes
    </div>
    <div style="height:1px;background:var(--bd);margin:6px 0"></div>`;

  cats.forEach(cat => {
    tabs += `<div style="font-size:10px;font-weight:700;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em;padding:4px 12px 2px">${esc(cat)}</div>`;
    grouped[cat].forEach(inno => {
      const hasNote = S.notes.byInno[inno.id]?.trim();
      const isActive = activeNoteId === inno.id;
      tabs += `<div onclick="switchNote('${inno.id}')" style="display:flex;align-items:center;gap:8px;padding:7px 12px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:${isActive?'600':'400'};color:${isActive?'var(--acc)':'var(--tx)'};background:${isActive?'var(--acc-bg)':'transparent'}">
        <div style="width:8px;height:8px;border-radius:50%;background:${inno.color};flex-shrink:0"></div>
        <span style="flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(inno.name)}</span>
        ${hasNote ? '<span style="font-size:9px;color:var(--tx3)">●</span>' : ''}
      </div>`;
    });
  });
  tabs += '</div>';

  // Active note title + content
  let noteTitle, noteText, notePlaceholder;
  if (activeNoteId === 'global') {
    noteTitle = '🌐 Team notes';
    noteText = S.notes.global || '';
    notePlaceholder = 'Shared team notes — visible to everyone. Use this for meeting minutes, decisions, key contacts, open questions…';
  } else {
    const inno = S.innovations.find(i => i.id === activeNoteId);
    noteTitle = inno ? `📝 ${inno.name}` : 'Notes';
    noteText = S.notes.byInno[activeNoteId] || '';
    notePlaceholder = `Notes for ${inno?.name || 'this innovation'} — strategy decisions, open questions, meeting notes, contacts…`;
  }

  // Last saved indicator
  const wordCount = noteText.trim() ? noteText.trim().split(/\s+/).length : 0;

  container.innerHTML = `
  <div style="display:grid;grid-template-columns:220px 1fr;gap:0;height:calc(100vh - 120px);background:var(--s0);border:1px solid var(--bd);border-radius:12px;overflow:hidden">

    <!-- Sidebar -->
    <div style="border-right:1px solid var(--bd);overflow-y:auto;padding:12px 8px;background:var(--s1)">
      ${tabs}
    </div>

    <!-- Editor -->
    <div style="display:flex;flex-direction:column;overflow:hidden">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 20px;border-bottom:1px solid var(--bd);background:var(--s0)">
        <div style="font-size:15px;font-weight:600;color:var(--tx)">${noteTitle}</div>
        <div style="display:flex;align-items:center;gap:12px">
          <span id="note-wordcount" style="font-size:11px;color:var(--tx3)">${wordCount ? wordCount+' words' : ''}</span>
          <span id="note-save-status" style="font-size:11px;color:var(--tx3)"></span>
        </div>
      </div>
      <textarea
        id="note-editor"
        placeholder="${notePlaceholder}"
        oninput="onNoteInput('${activeNoteId}', this.value)"
        style="flex:1;width:100%;padding:20px;font-size:14px;line-height:1.7;font-family:'Inter',sans-serif;color:var(--tx);background:var(--s0);border:none;resize:none;outline:none;box-sizing:border-box"
      >${noteText}</textarea>
    </div>
  </div>`;

  container.dataset.activeNote = activeNoteId;
  // Focus editor
  setTimeout(() => {
    const ed = document.getElementById('note-editor');
    if (ed) ed.focus();
  }, 50);
}

function switchNote(id) {
  const container = document.getElementById('notes-content');
  if (container) container.dataset.activeNote = id;
  renderNotes();
}

let noteSaveTimer = null;
function onNoteInput(id, value) {
  ensureNotes();
  // Update word count live
  const wc = value.trim() ? value.trim().split(/\s+/).length : 0;
  const wcEl = document.getElementById('note-wordcount');
  if (wcEl) wcEl.textContent = wc ? wc + ' words' : '';

  // Update status
  const statusEl = document.getElementById('note-save-status');
  if (statusEl) statusEl.textContent = 'Unsaved…';

  // Store value
  if (id === 'global') {
    S.notes.global = value;
  } else {
    S.notes.byInno[id] = value;
  }

  // Debounce save — 1.5s after last keystroke
  clearTimeout(noteSaveTimer);
  noteSaveTimer = setTimeout(async () => {
    await save();
    const el = document.getElementById('note-save-status');
    if (el) { el.textContent = 'Saved ✓'; setTimeout(() => { if(el) el.textContent = ''; }, 2000); }
  }, 1500);
}
