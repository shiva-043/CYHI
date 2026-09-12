// Shared authentication and profile helpers for protected pages.
const PROFILE_COLUMNS = 'id, full_name, email, role, branch, admission_year, section_id, semester, roll_no'

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

  const { data: profile, error: profileError } = await window.supabaseClient
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', data.user.id)
    .single()

  if (profileError || !profile) {
    const missingProfileError = new Error('Your account does not have a profile.')
    missingProfileError.name = 'ProfileError'
    missingProfileError.cause = profileError
    throw missingProfileError
  }

  return {
    ...profile,
    authUser: data.user,
    name: profile.full_name,
    department: profile.branch,
    semester: profile.semester,
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
