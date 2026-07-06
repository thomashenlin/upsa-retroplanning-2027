// ─── AUTH ─────────────────────────────────────────────────────────────────────
let currentUser = null;
let currentRole = null;

async function initAuth() {
  const { data: { session } } = await supa.auth.getSession();
  if (session?.user) {
    await setCurrentUser(session.user);
    return true;
  }
  showLoginScreen();
  return false;
}

async function setCurrentUser(user) {
  currentUser = user;
  const { data } = await supa.from('user_profiles').select('*').eq('id', user.id).single();
  if (data) {
    currentRole = data.role;
    if (data.must_change_password) {
      showChangePasswordScreen();
      return;
    }
  } else {
    // First admin login — create profile
    await supa.from('user_profiles').insert({ id: user.id, email: user.email, role: 'admin', must_change_password: false });
    currentRole = 'admin';
  }
  hideAuthScreens();
  updateUIForRole();
}

function showLoginScreen() {
  document.getElementById('auth-screen').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
}

function hideAuthScreens() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('change-pw-screen').style.display = 'none';
  document.getElementById('app').style.display = 'block';
}

function showChangePasswordScreen() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('change-pw-screen').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
}

async function login() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  errEl.textContent = '';
  if (!email || !password) { errEl.textContent = 'Please enter email and password.'; return; }
  const btn = document.getElementById('login-btn');
  btn.textContent = 'Signing in…'; btn.disabled = true;
  const { data, error } = await supa.auth.signInWithPassword({ email, password });
  btn.textContent = 'Sign in'; btn.disabled = false;
  if (error) { errEl.textContent = error.message; return; }
  await setCurrentUser(data.user);
}

async function logout() {
  await supa.auth.signOut();
  currentUser = null; currentRole = null;
  showLoginScreen();
}

async function changePassword() {
  const pw = document.getElementById('new-password').value;
  const pw2 = document.getElementById('new-password2').value;
  const errEl = document.getElementById('change-pw-error');
  errEl.textContent = '';
  if (pw.length < 8) { errEl.textContent = 'Password must be at least 8 characters.'; return; }
  if (pw !== pw2) { errEl.textContent = 'Passwords do not match.'; return; }
  const { error } = await supa.auth.updateUser({ password: pw });
  if (error) { errEl.textContent = error.message; return; }
  await supa.from('user_profiles').update({ must_change_password: false }).eq('id', currentUser.id);
  hideAuthScreens();
  updateUIForRole();
}

function updateUIForRole() {
  const isViewer = currentRole === 'viewer';
  const isAdmin = currentRole === 'admin';
  // Show/hide edit controls
  document.querySelectorAll('.admin-only').forEach(el => el.style.display = isAdmin ? '' : 'none');
  document.querySelectorAll('.edit-only').forEach(el => el.style.display = isViewer ? 'none' : '');
  // Update user display
  const userEl = document.getElementById('nav-user');
  if (userEl && currentUser) {
    userEl.textContent = currentUser.email.split('@')[0];
  }
  const roleEl = document.getElementById('nav-role');
  if (roleEl) {
    roleEl.textContent = currentRole;
    roleEl.className = `badge ${currentRole === 'admin' ? 'badge-T' : currentRole === 'editor' ? 'badge-B' : 'badge-gray'}`;
  }
}

// ─── ADMIN USER MANAGEMENT ───────────────────────────────────────────────────
async function renderUserManagement() {
  if (currentRole !== 'admin') return;
  const { data: users } = await supa.from('user_profiles').select('*').order('created_at');
  const container = document.getElementById('user-list');
  if (!container) return;
  container.innerHTML = (users || []).map(u => `
    <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--bd)">
      <div style="flex:1">
        <div style="font-size:13px;font-weight:500">${esc(u.email)}</div>
        <div style="font-size:11px;color:var(--tx3)">${u.must_change_password ? '⚠ Must change password' : 'Active'}</div>
      </div>
      <select onchange="updateUserRole('${u.id}',this.value)" style="font-size:12px;padding:4px 8px;border:1px solid var(--bd2);border-radius:var(--r);font-family:inherit">
        <option value="admin" ${u.role==='admin'?'selected':''}>Admin</option>
        <option value="editor" ${u.role==='editor'?'selected':''}>Editor</option>
        <option value="viewer" ${u.role==='viewer'?'selected':''}>Viewer</option>
      </select>
      ${u.id !== currentUser?.id ? `<button class="btn btn-sm btn-danger" onclick="deleteUser('${u.id}')">Remove</button>` : ''}
    </div>
  `).join('') || '<p style="color:var(--tx3);font-size:13px">No users yet.</p>';
}

async function createUser() {
  const email = document.getElementById('new-user-email').value.trim();
  const password = document.getElementById('new-user-password').value;
  const role = document.getElementById('new-user-role').value;
  const errEl = document.getElementById('user-create-error');
  errEl.textContent = '';
  if (!email || !password) { errEl.textContent = 'Email and password required.'; return; }
  if (password.length < 8) { errEl.textContent = 'Password must be at least 8 characters.'; return; }
  // Use admin API via Supabase edge function workaround — create via signUp then update profile
  const { data, error } = await supa.auth.admin?.createUser?.({ email, password, email_confirm: true })
    ?? await supa.functions?.invoke('create-user', { body: { email, password, role } });
  // Fallback: direct signup (works if email confirmation is disabled)
  if (error || !data) {
    // Try direct approach using service role — handled server-side
    errEl.textContent = 'Could not create user automatically. Ask the user to sign up at the login page, then assign their role here.';
    return;
  }
  notify('User created ✓');
  document.getElementById('new-user-email').value = '';
  document.getElementById('new-user-password').value = '';
  await renderUserManagement();
}

async function updateUserRole(userId, role) {
  await supa.from('user_profiles').update({ role }).eq('id', userId);
  notify('Role updated ✓');
}

async function deleteUser(userId) {
  if (!confirm('Remove this user?')) return;
  await supa.from('user_profiles').delete().eq('id', userId);
  await renderUserManagement();
  notify('User removed');
}
