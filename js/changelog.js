// ─── DRAFT / VALIDATION / CHANGELOG ─────────────────────────────────────────

async function logChange(innoId, innoName, action, field, oldVal, newVal) {
  if (!currentUser) return;
  const inno = S.innovations.find(i => i.id === innoId);
  if (!inno || inno.status === 'draft') return; // don't log changes while in draft
  try {
    await supa.from('change_log').insert({
      innovation_id: innoId,
      innovation_name: innoName || inno?.name || '',
      user_email: currentUser.email,
      action,
      field: field || null,
      old_value: oldVal !== undefined ? String(oldVal) : null,
      new_value: newVal !== undefined ? String(newVal) : null,
    });
  } catch(e) {}
}

async function validateInnovation(innoId) {
  const inno = S.innovations.find(i => i.id === innoId);
  if (!inno) return;
  if (!confirm(`Validate "${inno.name}"?\n\nThis marks the retroplanning as officially approved. From this point, every change (dates, durations, status) will be logged in the history with who made it and when.\n\nYou can still edit after validation — all changes will simply be recorded.`)) return;
  inno.status = 'active';
  inno.validatedAt = new Date().toISOString();
  inno.validatedBy = currentUser?.email || 'unknown';
  await save();
  // Log the validation event
  await logChange(innoId, inno.name, 'VALIDATED', null, null, inno.validatedAt);
  renderDetail();
  notify('Retroplanning validated ✓ — changes will now be logged');
}

async function renderChangeLog(innoId) {
  const modal = document.getElementById('changelog-modal');
  const body = document.getElementById('changelog-body');
  if (!modal || !body) return;
  body.innerHTML = '<div style="color:var(--tx3);font-size:13px">Loading…</div>';
  modal.style.display = 'flex';
  const { data, error } = await supa.from('change_log')
    .select('*')
    .eq('innovation_id', innoId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error || !data?.length) {
    body.innerHTML = '<div style="color:var(--tx3);font-size:13px">No changes recorded yet.</div>';
    return;
  }
  body.innerHTML = data.map(entry => {
    const dt = new Date(entry.created_at);
    const dateStr = `${fmtDate(dt.toISOString().slice(0,10))} ${dt.toLocaleTimeString('en-GB', {hour:'2-digit',minute:'2-digit'})}`;
    let desc = '';
    if (entry.action === 'VALIDATED') desc = '✅ Retroplanning validated';
    else if (entry.field) desc = `<strong>${esc(entry.field)}</strong>: ${esc(entry.old_value||'—')} → ${esc(entry.new_value||'—')}`;
    else desc = esc(entry.action);
    return `<div style="display:flex;gap:12px;padding:8px 0;border-bottom:1px solid var(--bd);align-items:baseline">
      <div style="flex-shrink:0;min-width:130px;font-size:11px;color:var(--tx3)">${dateStr}</div>
      <div style="flex-shrink:0;min-width:110px;font-size:11px;color:var(--acc)">${esc(entry.user_email?.split('@')[0]||'?')}</div>
      <div style="font-size:12px;color:var(--tx)">${desc}</div>
    </div>`;
  }).join('');
}

function closeChangeLog() {
  const modal = document.getElementById('changelog-modal');
  if (modal) modal.style.display = 'none';
}
