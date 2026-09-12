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
const studentDetailGroups = document.querySelectorAll('.student-detail')
const studentDetailInputs = [semesterInput, branchInput, sectionInput]

// Place an error below a field and mark that field as invalid.
function showError(input, message) {
  const error = document.querySelector(`#${input.id}Error`)
  error.textContent = message
  input.setAttribute('aria-invalid', 'true')
}

// Remove an old error when a field becomes valid.
function clearError(input) {
  const error = document.querySelector(`#${input.id}Error`)
  error.textContent = ''
  input.removeAttribute('aria-invalid')
}

// Reuse the same show/hide behavior for both password fields.
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

// Professors do not need Semester, Branch, or Section.
// These fields remain visible and required for Student and CR.
function updateStudentDetails() {
  const isProfessor = roleInput.value === 'professor'

  studentDetailGroups.forEach((group) => {
    group.hidden = isProfessor
  })

  studentDetailInputs.forEach((input) => {
    input.disabled = isProfessor
    if (isProfessor) clearError(input)
  })
}

roleInput.addEventListener('change', updateStudentDetails)
updateStudentDetails()

signupForm.addEventListener('submit', (event) => {
  event.preventDefault()

  const nameIsValid = nameInput.value.trim() !== ''
  const identityIsValid = userIdentityInput.value.trim() !== ''
  const roleIsValid = roleInput.value !== ''
  const studentDetailsAreRequired = roleInput.value !== 'professor'
  const semesterIsValid = !studentDetailsAreRequired || semesterInput.value !== ''
  const branchIsValid = !studentDetailsAreRequired || branchInput.value !== ''
  const sectionIsValid = !studentDetailsAreRequired || sectionInput.value.trim() !== ''
  const passwordIsValid = passwordInput.value.trim() !== ''
  const confirmationIsPresent = confirmPasswordInput.value.trim() !== ''
  const passwordsMatch = passwordInput.value === confirmPasswordInput.value

  nameIsValid
    ? clearError(nameInput)
    : showError(nameInput, 'Name cannot be empty.')

  identityIsValid
    ? clearError(userIdentityInput)
    : showError(userIdentityInput, 'Username / Email cannot be empty.')

  roleIsValid
    ? clearError(roleInput)
    : showError(roleInput, 'Please select a role.')

  semesterIsValid
    ? clearError(semesterInput)
    : showError(semesterInput, 'Please select a semester.')

  branchIsValid
    ? clearError(branchInput)
    : showError(branchInput, 'Please select a branch.')

  sectionIsValid
    ? clearError(sectionInput)
    : showError(sectionInput, 'Section cannot be empty.')

  passwordIsValid
    ? clearError(passwordInput)
    : showError(passwordInput, 'Password cannot be empty.')

  if (!confirmationIsPresent) {
    showError(confirmPasswordInput, 'Confirm Password cannot be empty.')
  } else if (!passwordsMatch) {
    showError(confirmPasswordInput, 'Passwords do not match.')
  } else {
    clearError(confirmPasswordInput)
  }

  if (
    nameIsValid &&
    identityIsValid &&
    roleIsValid &&
    semesterIsValid &&
    branchIsValid &&
    sectionIsValid &&
    passwordIsValid &&
    confirmationIsPresent &&
    passwordsMatch
  ) {
    // A backend request can be added here later.
  }
})
