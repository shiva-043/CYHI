// Get the signup form and all of its fields.
const signupForm = document.querySelector('#signupForm')
const nameInput = document.querySelector('#name')
const userIdentityInput = document.querySelector('#userIdentity')
const roleInput = document.querySelector('#role')
const semesterInput = document.querySelector('#semester')
const branchInput = document.querySelector('#branch')
const sectionInput = document.querySelector('#section')
const passwordInput = document.querySelector('#password')
const confirmPasswordInput = document.querySelector('#confirmPassword')
const signupStatus = document.querySelector('#signupStatus')
const signupButton = document.querySelector('#signupButton')
const studentDetailGroups = document.querySelectorAll('.student-detail')
const studentDetailInputs = [semesterInput, branchInput, sectionInput]

const ROLE_MAP = Object.freeze({
  student: 'student',
  cr: 'class_leader',
  professor: 'professor',
})

function showError(input, message) {
  const error = document.querySelector(`#${input.id}Error`)
  error.classList.remove('match-success')
  error.textContent = message
  input.setAttribute('aria-invalid', 'true')
}

function clearError(input) {
  const error = document.querySelector(`#${input.id}Error`)
  error.classList.remove('match-success')
  error.textContent = ''
  input.removeAttribute('aria-invalid')
}

// Give immediate feedback and prevent signup when the two passwords differ.
function updatePasswordMatchFeedback() {
  const message = document.querySelector('#confirmPasswordError')

  if (confirmPasswordInput.value === '') {
    clearError(confirmPasswordInput)
    return false
  }

  if (passwordInput.value !== confirmPasswordInput.value) {
    showError(confirmPasswordInput, 'Passwords do not match.')
    return false
  }

  confirmPasswordInput.removeAttribute('aria-invalid')
  message.textContent = 'Passwords match.'
  message.classList.add('match-success')
  return true
}

function setupPasswordToggle(inputId, buttonId, fieldName) {
  const input = document.querySelector(`#${inputId}`)
  const button = document.querySelector(`#${buttonId}`)

  button.addEventListener('click', () => {
    const passwordIsHidden = input.type === 'password'
    input.type = passwordIsHidden ? 'text' : 'password'
    button.setAttribute(
      'aria-label',
      passwordIsHidden ? `Hide ${fieldName}` : `Show ${fieldName}`,
    )
  })
}

setupPasswordToggle('password', 'passwordToggle', 'password')
setupPasswordToggle('confirmPassword', 'confirmPasswordToggle', 'confirm password')
passwordInput.addEventListener('input', () => {
  if (confirmPasswordInput.value !== '') updatePasswordMatchFeedback()
})
confirmPasswordInput.addEventListener('input', updatePasswordMatchFeedback)

function updateBatchFields() {
  const needsBatchDetails = ['student', 'cr'].includes(roleInput.value)

  studentDetailGroups.forEach((group) => {
    group.hidden = !needsBatchDetails
  })

  studentDetailInputs.forEach((input) => {
    input.disabled = !needsBatchDetails
    if (!needsBatchDetails) {
      input.value = ''
      clearError(input)
    }
  })
}

roleInput.addEventListener('change', updateBatchFields)
updateBatchFields()

function getSignupErrorMessage(error) {
  const message = String(error?.message || '').toLowerCase()
  const errorCode = String(error?.code || '')
  if (errorCode === 'staff_not_authorized') {
    return 'This CR or Professor email has not been approved by the project administrator.'
  }
  if (errorCode === 'user_already_exists' || message.includes('already registered') || message.includes('already exists')) {
    return 'An account with this email already exists. Please log in instead.'
  }
  if (errorCode === '23514' || message.includes('profiles_email_format')) {
    return 'Use your IIITDM Jabalpur email address ending in @iiitdmj.ac.in.'
  }
  if (message.includes('email') && message.includes('invalid')) {
    return 'Enter a valid email address.'
  }
  if (message.includes('rate limit') || message.includes('too many requests')) {
    return 'Too many signup attempts. Please wait a few minutes and try again.'
  }
  if (message.includes('password')) {
    return 'Choose a stronger password with at least 6 characters.'
  }
  if (message.includes('database error') || message.includes('saving new user')) {
    return 'Supabase could not create your profile. Ask the project owner to check the profile trigger.'
  }
  return 'Unable to create your account. Please try again.'
}

signupForm.addEventListener('submit', async (event) => {
  event.preventDefault()

  const nameIsValid = nameInput.value.trim() !== ''
  const identityIsPresent = userIdentityInput.value.trim() !== ''
  const emailIsValid = identityIsPresent && userIdentityInput.validity.valid
  const campusEmailIsValid = emailIsValid && /@iiitdmj\.ac\.in$/i.test(
    userIdentityInput.value.trim(),
  )
  const roleIsValid = roleInput.value !== ''
  const batchFieldsAreRequired = ['student', 'cr'].includes(roleInput.value)
  const semesterIsValid = !batchFieldsAreRequired || semesterInput.value !== ''
  const branchIsValid = !batchFieldsAreRequired || branchInput.value !== ''
  const sectionIsValid = !batchFieldsAreRequired || sectionInput.value !== ''
  const passwordIsValid = passwordInput.value.trim() !== ''
  const confirmationIsPresent = confirmPasswordInput.value.trim() !== ''
  const passwordsMatch = passwordInput.value === confirmPasswordInput.value

  nameIsValid ? clearError(nameInput) : showError(nameInput, 'Name cannot be empty.')
  identityIsPresent
    ? clearError(userIdentityInput)
    : showError(userIdentityInput, 'Username / Email cannot be empty.')
  if (identityIsPresent && !emailIsValid) {
    showError(userIdentityInput, 'Enter a valid email address.')
  } else if (emailIsValid && !campusEmailIsValid) {
    showError(
      userIdentityInput,
      'Use your IIITDM Jabalpur email address ending in @iiitdmj.ac.in.',
    )
  }

  roleIsValid ? clearError(roleInput) : showError(roleInput, 'Please select a role.')
  semesterIsValid
    ? clearError(semesterInput)
    : showError(semesterInput, 'Please select a semester.')
  branchIsValid
    ? clearError(branchInput)
    : showError(branchInput, 'Please select a branch.')
  sectionIsValid
    ? clearError(sectionInput)
    : showError(sectionInput, 'Please select a section.')
  passwordIsValid
    ? clearError(passwordInput)
    : showError(passwordInput, 'Password cannot be empty.')

  if (!confirmationIsPresent) {
    showError(confirmPasswordInput, 'Confirm Password cannot be empty.')
  } else if (!passwordsMatch) {
    showError(confirmPasswordInput, 'Passwords do not match.')
  } else {
    updatePasswordMatchFeedback()
  }

  if (
    !nameIsValid || !campusEmailIsValid || !roleIsValid || !semesterIsValid ||
    !branchIsValid || !sectionIsValid || !passwordIsValid ||
    !confirmationIsPresent || !passwordsMatch
  ) return

  signupStatus.classList.remove('success-message')
  signupStatus.textContent = 'Creating your account...'
  signupButton.disabled = true

  const normalizedEmail = userIdentityInput.value.trim().toLowerCase()
  const profileMetadata = {
    full_name: nameInput.value.trim(),
    name: nameInput.value.trim(),
    role: ROLE_MAP[roleInput.value],
  }

  if (roleInput.value !== 'professor') {
    profileMetadata.semester = Number(semesterInput.value)
    profileMetadata.branch = branchInput.value
    profileMetadata.section_name = sectionInput.value
  }

  try {
    if (['cr', 'professor'].includes(roleInput.value)) {
      const { data: isAuthorized, error: authorizationError } = await window.supabaseClient
        .rpc('is_staff_signup_authorized', {
          requested_email: normalizedEmail,
          requested_role: ROLE_MAP[roleInput.value],
        })

      if (authorizationError) throw authorizationError
      if (!isAuthorized) {
        const authorizationRequired = new Error('Staff signup is not authorized.')
        authorizationRequired.code = 'staff_not_authorized'
        throw authorizationRequired
      }
    }

    const { data, error } = await window.supabaseClient.auth.signUp({
      email: normalizedEmail,
      password: passwordInput.value,
      options: { data: profileMetadata },
    })

    if (error) throw error
    if (!data.user) throw new Error('Supabase did not return the new user.')
    if (Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      const existingAccount = new Error('This email is already registered.')
      existingAccount.code = 'user_already_exists'
      throw existingAccount
    }

    signupStatus.classList.add('success-message')

    if (data.session) {
      signupStatus.textContent = 'Account created successfully. Redirecting to login...'
      setTimeout(() => window.location.replace('login.html?signup=success'), 1200)
      return
    }

    signupStatus.textContent = 'Account created. Confirm the email sent by Supabase before logging in.'
    setTimeout(() => window.location.replace('login.html?signup=confirm-email'), 2500)
  } catch (error) {
    console.error('Signup failed:', error)
    signupStatus.textContent = getSignupErrorMessage(error)
    signupButton.disabled = false
  }
})

document.addEventListener('DOMContentLoaded', async () => {
  const { data, error } = await window.supabaseClient.auth.getSession()
  if (!error && data.session) {
    window.location.replace('dashboard.html')
    return
  }

})
