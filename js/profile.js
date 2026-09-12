// Change this URL when the backend is deployed.
const API_BASE_URL = 'http://localhost:3000/api'

const profileState = document.querySelector('#profileState')
const profileIdentity = document.querySelector('#profileIdentity')
const profileName = document.querySelector('#profileName')
const profileDepartment = document.querySelector('#profileDepartment')
const profileSemester = document.querySelector('#profileSemester')
const preferencesButton = document.querySelector('#preferencesButton')
const preferencesMessage = document.querySelector('#preferencesMessage')
const logoutButton = document.querySelector('#logoutButton')

// Add the correct ending to a semester number: 1st, 2nd, 3rd, and so on.
function formatSemester(semester) {
  const number = Number(semester)
  const finalTwoDigits = number % 100

  if (finalTwoDigits >= 11 && finalTwoDigits <= 13) return `${number}th Semester`

  const endings = { 1: 'st', 2: 'nd', 3: 'rd' }
  const ending = endings[number % 10] || 'th'
  return `${number}${ending} Semester`
}

function displayProfile(profile) {
  // textContent safely displays values received from the backend.
  profileName.textContent = profile.name
  profileDepartment.textContent = profile.department
  profileSemester.textContent = formatSemester(profile.semester)

  profileState.hidden = true
  profileIdentity.hidden = false
}

async function loadProfile() {
  try {
    const response = await fetch(`${API_BASE_URL}/user/profile`, {
      credentials: 'include',
    })

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`)
    }

    const profile = await response.json()
    const hasValidProfile = (
      profile &&
      typeof profile.name === 'string' &&
      profile.name.trim() !== '' &&
      typeof profile.department === 'string' &&
      profile.department.trim() !== '' &&
      Number.isFinite(Number(profile.semester))
    )

    if (!hasValidProfile) {
      throw new Error('The profile response is incomplete.')
    }

    displayProfile({
      name: profile.name.trim(),
      department: profile.department.trim(),
      semester: profile.semester,
    })
  } catch (error) {
    console.error('Unable to load profile:', error)
    profileState.textContent = 'Unable to load profile.'
    profileState.classList.add('error-state')
    profileIdentity.hidden = true
  }
}

function logout() {
  localStorage.clear()
  sessionStorage.clear()
  window.location.href = 'login.html'
}

preferencesButton.addEventListener('click', () => {
  preferencesMessage.textContent = 'Preferences will be available soon.'
})

logoutButton.addEventListener('click', logout)

document.addEventListener('DOMContentLoaded', loadProfile)
