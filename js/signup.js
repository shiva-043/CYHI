// Get the signup form and all of its fields.
const signupForm = document.querySelector('#signupForm')
const nameInput = document.querySelector('#name')
const userIdentityInput = document.querySelector('#userIdentity')
const roleInput = document.querySelector('#role')
const passwordInput = document.querySelector('#password')
const confirmPasswordInput = document.querySelector('#confirmPassword')

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

signupForm.addEventListener('submit', (event) => {
  event.preventDefault()

  const nameIsValid = nameInput.value.trim() !== ''
  const identityIsValid = userIdentityInput.value.trim() !== ''
  const roleIsValid = roleInput.value !== ''
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
    passwordIsValid &&
    confirmationIsPresent &&
    passwordsMatch
  ) {
    // A backend request can be added here later.
  }
})
