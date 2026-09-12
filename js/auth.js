// Shared authentication and profile helpers for protected pages.
const CORE_PROFILE_COLUMNS = 'id, full_name, email, role, branch, admission_year, section_id, semester, roll_no'
const EXTENDED_PROFILE_COLUMNS = `${CORE_PROFILE_COLUMNS}, batch`

async function getSession() {
  const { data, error } = await window.supabaseClient.auth.getSession()
  if (error) throw error
  return data.session
}

async function getAuthenticatedUser(redirectWhenMissing = true) {
  const { data, error } = await window.supabaseClient.auth.getUser()

  if (error || !data.user) {
    if (redirectWhenMissing) window.location.replace('login.html')
    throw error || new Error('Authentication required.')
  }

  let profile = null

  // 1. Attempt fetching extended columns (includes batch if migration was run)
  try {
    const res = await window.supabaseClient
      .from('profiles')
      .select(EXTENDED_PROFILE_COLUMNS)
      .eq('id', data.user.id)
      .maybeSingle()

    if (!res.error && res.data) {
      profile = res.data
    }
  } catch (err) {
    console.warn('Extended profile fetch skipped:', err)
  }

  // 2. Fallback: core profile columns if batch column does not exist yet
  if (!profile) {
    try {
      const res = await window.supabaseClient
        .from('profiles')
        .select(CORE_PROFILE_COLUMNS)
        .eq('id', data.user.id)
        .maybeSingle()

      if (!res.error && res.data) {
        profile = res.data
      }
    } catch (err) {
      console.warn('Core profile fetch skipped:', err)
    }
  }

  // 3. Fallback: select('*')
  if (!profile) {
    try {
      const res = await window.supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .maybeSingle()

      if (!res.error && res.data) {
        profile = res.data
      }
    } catch (err) {
      console.warn('Wildcard profile fetch skipped:', err)
    }
  }

  // 4. Ultimate fallback: synthesize profile from auth metadata if DB row is missing
  if (!profile) {
    const meta = data.user.user_metadata || {}
    profile = {
      id: data.user.id,
      full_name: meta.full_name || meta.name || (data.user.email ? data.user.email.split('@')[0] : 'User'),
      email: data.user.email || '',
      role: meta.role === 'cr' ? 'class_leader' : (meta.role || 'student'),
      branch: meta.branch ? String(meta.branch).toUpperCase() : null,
      semester: meta.semester ? parseInt(meta.semester, 10) : null,
      section_id: null,
      roll_no: meta.roll_no ? parseInt(meta.roll_no, 10) : null,
      batch: meta.batch || null,
    }
  }

  return {
    ...profile,
    authUser: data.user,
    name: profile.full_name || (data.user.email ? data.user.email.split('@')[0] : 'User'),
    department: profile.branch,
    semester: profile.semester,
    batch: profile.batch || null,
  }
}

function canManageContent(user) {
  return ['class_leader', 'professor'].includes(String(user?.role || '').toLowerCase())
}

async function signOut() {
  const { error } = await window.supabaseClient.auth.signOut({ scope: 'local' })
  if (error) throw error
  window.location.replace('login.html')
}

window.CampusAuth = Object.freeze({
  canManageContent,
  getAuthenticatedUser,
  getSession,
  signOut,
})
