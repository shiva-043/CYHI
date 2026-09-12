const profileState = document.querySelector('#profileState')
const profileIdentity = document.querySelector('#profileIdentity')
const profileName = document.querySelector('#profileName')
const profileDepartment = document.querySelector('#profileDepartment')
const profileSemester = document.querySelector('#profileSemester')
const preferencesButton = document.querySelector('#preferencesButton')
const preferencesMessage = document.querySelector('#preferencesMessage')
const logoutButton = document.querySelector('#logoutButton')

function displayProfile(profile) {
  profileName.textContent = profile.full_name
  profileDepartment.textContent = profile.branch || 'Department not assigned'
  profileSemester.textContent = profile.semester == null
    ? 'Semester not assigned'
    : `${profile.semester}${getOrdinalSuffix(profile.semester)} Semester`

  profileState.hidden = true
  profileIdentity.hidden = false
}

function getOrdinalSuffix(value) {
  if (value >= 11 && value <= 13) return 'th'
  if (value % 10 === 1) return 'st'
  if (value % 10 === 2) return 'nd'
  if (value % 10 === 3) return 'rd'
  return 'th'
}

async function loadProfile() {
  try {
    const profile = await window.CampusAuth.getAuthenticatedUser()
    const hasValidProfile = (
      profile &&
      typeof profile.full_name === 'string' &&
      profile.full_name.trim() !== ''
    )

    if (!hasValidProfile) {
      throw new Error('The profile response is incomplete.')
    }

    displayProfile(profile)
  } catch (error) {
    console.error('Unable to load profile:', error)
    profileState.textContent = 'Unable to load profile.'
    profileState.classList.add('error-state')
    profileIdentity.hidden = true
  }
}

async function logout() {
  logoutButton.disabled = true

  try {
    await window.CampusAuth.signOut()
  } catch (error) {
    console.error('Unable to log out:', error)
    profileState.hidden = false
    profileState.textContent = 'Unable to log out. Please try again.'
    profileState.classList.add('error-state')
    logoutButton.disabled = false
  }
}

preferencesButton.addEventListener('click', () => {
  preferencesMessage.textContent = 'Preferences will be available soon.'
})

logoutButton.addEventListener('click', logout)

document.addEventListener('DOMContentLoaded', loadProfile)
