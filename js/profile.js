const profileState = document.querySelector('#profileState')
const profileIdentity = document.querySelector('#profileIdentity')
const profileName = document.querySelector('#profileName')
const profileRole = document.querySelector('#profileRole')
const profileEmail = document.querySelector('#profileEmail')
const profileDepartment = document.querySelector('#profileDepartment')
const profileSemester = document.querySelector('#profileSemester')
const preferencesButton = document.querySelector('#preferencesButton')
const preferencesMessage = document.querySelector('#preferencesMessage')
const logoutButton = document.querySelector('#logoutButton')

function getRoleLabel(role) {
  switch (String(role || '').toLowerCase()) {
    case 'professor':
      return 'Faculty / Professor'
    case 'class_leader':
    case 'cr':
      return 'Class Representative (CR)'
    case 'student':
    default:
      return 'Student'
  }
}

async function displayProfile(profile) {
  const displayName = profile.full_name || profile.name || (profile.email ? profile.email.split('@')[0] : 'User')
  if (profileName) profileName.textContent = displayName
  if (profileRole) profileRole.textContent = `Role: ${getRoleLabel(profile.role)}`
  if (profileEmail) profileEmail.textContent = profile.email || profile.authUser?.email || ''

  if (profile.role === 'professor') {
    if (profileDepartment) profileDepartment.textContent = profile.branch ? `Department: ${profile.branch}` : 'Faculty Member'
    if (profileSemester) profileSemester.textContent = ''
  } else {
    let sectionName = ''
    if (profile.section_id && window.supabaseClient) {
      try {
        const { data: section } = await window.supabaseClient
          .from('sections')
          .select('name, branch, semester')
          .eq('id', profile.section_id)
          .maybeSingle()
        if (section?.name) {
          sectionName = section.name
        }
      } catch (err) {
        console.warn('Could not resolve section details:', err)
      }
    }

    const branchLabel = profile.branch ? `Branch: ${profile.branch}` : 'Branch not assigned'
    const batchLabel = profile.batch ? ` • Batch ${profile.batch}` : ''
    if (profileDepartment) {
      profileDepartment.textContent = sectionName
        ? `${branchLabel} • Section ${sectionName}${batchLabel}`
        : `${branchLabel}${batchLabel}`
    }

    if (profileSemester) {
      const semNum = parseInt(profile.semester, 10)
      profileSemester.textContent = isNaN(semNum)
        ? 'Semester not assigned'
        : `${semNum}${getOrdinalSuffix(semNum)} Semester`
    }
  }

  if (profileState) profileState.hidden = true
  if (profileIdentity) profileIdentity.hidden = false
}

function getOrdinalSuffix(value) {
  const num = parseInt(value, 10)
  if (isNaN(num)) return ''
  if (num >= 11 && num <= 13) return 'th'
  if (num % 10 === 1) return 'st'
  if (num % 10 === 2) return 'nd'
  if (num % 10 === 3) return 'rd'
  return 'th'
}

async function loadProfile() {
  try {
    const profile = await window.CampusAuth.getAuthenticatedUser()
    if (!profile) {
      throw new Error('Unable to retrieve profile.')
    }
    await displayProfile(profile)
  } catch (error) {
    console.error('Unable to load profile:', error)
    if (profileState) {
      profileState.textContent = 'Unable to load profile.'
      profileState.classList.add('error-state')
    }
    if (profileIdentity) profileIdentity.hidden = true
  }
}

async function logout() {
  if (logoutButton) logoutButton.disabled = true

  try {
    await window.CampusAuth.signOut()
  } catch (error) {
    console.error('Unable to log out:', error)
    if (profileState) {
      profileState.hidden = false
      profileState.textContent = 'Unable to log out. Please try again.'
      profileState.classList.add('error-state')
    }
    if (logoutButton) logoutButton.disabled = false
  }
}

if (preferencesButton) {
  preferencesButton.addEventListener('click', () => {
    if (preferencesMessage) {
      preferencesMessage.textContent = 'Preferences will be available soon.'
    }
  })
}

if (logoutButton) {
  logoutButton.addEventListener('click', logout)
}

document.addEventListener('DOMContentLoaded', loadProfile)
