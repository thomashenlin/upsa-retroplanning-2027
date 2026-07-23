// ─── SWISSMEDIC SETTINGS ─────────────────────────────────────────────────────

async function loadSmcSettings() {
  try {
    const { data, error } = await supa.from('swissmedic_settings').select('procedures').eq('id','default').maybeSingle();
    if (!error && data?.procedures) {
      // Merge saved durations into SMC_PROCEDURES
      Object.entries(data.procedures).forEach(([key, saved]) => {
        if (SMC_PROCEDURES[key] && saved.steps) {
          SMC_PROCEDURES[key].phases.forEach(ph => {
            ph.steps.forEach(step => {
              const savedStep = saved.steps.find(s => s.name === step.name);
              if (savedStep?.weeks !== undefined) step.weeks = savedStep.weeks;
            });
          });
          if (saved.totalCD) SMC_PROCEDURES[key].totalCD = saved.totalCD;
        }
      });
    }
  } catch(e) {}
}

async function saveSmcSettings() {
  const procedures = {};
  Object.entries(SMC_PROCEDURES).forEach(([key, proc]) => {
    procedures[key] = {
      totalCD: proc.totalCD,
      steps: proc.phases.flatMap(ph => ph.steps.map(s => ({ name: s.name, weeks: parseFloat(s.weeks) || 0 })))
    };
  });
  await supa.from('swissmedic_settings').upsert({
    id: 'default',
    procedures,
    updated_at: new Date().toISOString(),
    updated_by: currentUser?.email || ''
  });
  notify('Swissmedic settings saved ✓');
}

function renderSettings() {
  const container = document.getElementById('settings-content');
  if (!container) return;

  let html = `
  <div style="max-width:800px">
    <h2 style="font-size:17px;font-weight:600;margin-bottom:6px">Swissmedic Procedure Settings</h2>
    <p style="font-size:13px;color:var(--tx3);margin-bottom:20px">Edit the standard durations (in weeks) for each Swissmedic procedure. These values are used when creating new innovations. Changes do not affect existing retroplannings.</p>
    <p style="font-size:11px;color:var(--tx3);margin-bottom:20px">Source: Swissmedic ZL000_00_014 v10.0 (01.09.2025)</p>`;

  Object.entries(SMC_PROCEDURES).forEach(([key, proc]) => {
    const totalWks = proc.phases.flatMap(ph=>ph.steps).reduce((a,s)=>a+(parseFloat(s.weeks)||0),0);
    html += `
    <div style="background:var(--s0);border:1px solid var(--bd);border-radius:12px;margin-bottom:16px;overflow:hidden">
      <div style="background:var(--s1);padding:12px 16px;border-bottom:1px solid var(--bd);display:flex;align-items:center;gap:10px">
        <div style="font-size:13px;font-weight:600;flex:1">${esc(proc.label)}</div>
        <div style="font-size:12px;color:var(--tx3)">Total: <strong>${totalWks} wks</strong> (${proc.totalCD||'?'} CD)</div>
      </div>
      <table style="width:100%;border-collapse:collapse">
        <thead><tr>
          <th style="text-align:left;padding:8px 16px;font-size:11px;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid var(--bd)">Step</th>
          <th style="width:80px;padding:8px 16px;font-size:11px;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid var(--bd);text-align:center">Weeks</th>
          <th style="width:120px;padding:8px 16px;font-size:11px;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid var(--bd)">Owner</th>
        </tr></thead>
        <tbody>`;
    proc.phases.forEach(ph => {
      ph.steps.forEach(step => {
        html += `<tr style="border-bottom:1px solid var(--bd)">
          <td style="padding:8px 16px;font-size:13px">
            <div style="display:flex;align-items:center;gap:6px">
              <div style="width:3px;height:14px;border-radius:2px;background:${ph.color};flex-shrink:0"></div>
              ${esc(step.name)}
            </div>
          </td>
          <td style="padding:6px 16px;text-align:center">
            <input type="number" min="0" step="0.5" value="${step.weeks}"
              onchange="updateSmcStepWeeks('${key}','${esc(ph.id)}','${esc(step.id)}',parseFloat(this.value)||0)"
              style="width:56px;padding:5px;text-align:center;border:1px solid var(--bd2);border-radius:var(--r);font-size:13px;font-family:inherit">
          </td>
          <td style="padding:8px 16px;font-size:12px;color:var(--tx3)">${esc(step.owner||'')}</td>
        </tr>`;
      });
    });
    html += `</tbody></table></div>`;
  });

  html += `
    <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:8px">
      <button class="btn" onclick="resetSmcSettings()">Reset to defaults</button>
      <button class="btn btn-primary" onclick="saveSmcSettings()">Save settings</button>
    </div>`;

  // User management section (admin only)
  if (currentRole === 'admin') {
    html += `
    <hr style="margin:32px 0;border:none;border-top:1px solid var(--bd)">
    <h2 style="font-size:17px;font-weight:600;margin-bottom:6px">User Management</h2>
    <p style="font-size:13px;color:var(--tx3);margin-bottom:16px">Add team members and assign their access level.</p>
    <div style="background:var(--s0);border:1px solid var(--bd);border-radius:12px;padding:16px;margin-bottom:16px">
      <div style="font-size:12px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:12px">Add a new user</div>
      <div style="display:grid;grid-template-columns:1fr 1fr auto auto;gap:8px;align-items:end">
        <div>
          <label style="display:block;font-size:11px;color:var(--tx3);margin-bottom:3px">Email</label>
          <input id="new-user-email" type="email" placeholder="beat@upsa.ch" style="width:100%;padding:7px 10px;font-size:13px;border:1px solid var(--bd2);border-radius:var(--r);font-family:inherit">
        </div>
        <div>
          <label style="display:block;font-size:11px;color:var(--tx3);margin-bottom:3px">Temporary password</label>
          <input id="new-user-password" type="password" placeholder="Min 8 characters" style="width:100%;padding:7px 10px;font-size:13px;border:1px solid var(--bd2);border-radius:var(--r);font-family:inherit">
        </div>
        <div>
          <label style="display:block;font-size:11px;color:var(--tx3);margin-bottom:3px">Role</label>
          <select id="new-user-role" style="padding:7px 10px;font-size:13px;border:1px solid var(--bd2);border-radius:var(--r);font-family:inherit">
            <option value="editor">Editor</option>
            <option value="viewer">Viewer</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <button class="btn btn-primary" onclick="createUser()" style="white-space:nowrap">+ Add user</button>
      </div>
      <div id="user-create-error" style="color:var(--err);font-size:12px;margin-top:6px"></div>
      <p style="font-size:11px;color:var(--tx3);margin-top:8px">The user will be prompted to change their password on first login.</p>
    </div>
    <div style="background:var(--s0);border:1px solid var(--bd);border-radius:12px;padding:16px">
      <div style="font-size:12px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Current users</div>
      <div id="user-list"></div>
    </div>`;
    setTimeout(renderUserManagement, 100);
  }

  html += '</div>';
  container.innerHTML = html;
}

function updateSmcStepWeeks(procKey, phaseId, stepId, weeks) {
  const proc = SMC_PROCEDURES[procKey];
  if (!proc) return;
  proc.phases.forEach(ph => {
    if (ph.id === phaseId) {
      ph.steps.forEach(s => { if (s.id === stepId) s.weeks = weeks; });
    }
  });
}

function resetSmcSettings() {
  if (!confirm('Reset all Swissmedic durations to official defaults (ZL000_00_014)?')) return;
  // Reload defaults from SMC_PROCEDURES_DEFAULT if we stored them
  location.reload();
}
