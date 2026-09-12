// Get the login form and its fields.
const loginForm = document.querySelector('#loginForm')
const usernameInput = document.querySelector('#username')
const passwordInput = document.querySelector('#password')
const passwordToggle = document.querySelector('#passwordToggle')
const forgotPassword = document.querySelector('#forgotPassword')
const recoveryMessage = document.querySelector('#recoveryMessage')

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

// Switch the password between hidden and visible text.
passwordToggle.addEventListener('click', () => {
  const passwordIsHidden = passwordInput.type === 'password'
  passwordInput.type = passwordIsHidden ? 'text' : 'password'
  passwordToggle.setAttribute(
    'aria-label',
    passwordIsHidden ? 'Hide password' : 'Show password',
  )
})

forgotPassword.addEventListener('click', () => {
  recoveryMessage.textContent = 'Password recovery functionality coming soon.'
})

loginForm.addEventListener('submit', (event) => {
  event.preventDefault()

  const usernameIsValid = usernameInput.value.trim() !== ''
  const passwordIsValid = passwordInput.value.trim() !== ''

  usernameIsValid
    ? clearError(usernameInput)
    : showError(usernameInput, 'Username cannot be empty.')

  passwordIsValid
    ? clearError(passwordInput)
    : showError(passwordInput, 'Password cannot be empty.')

  if (usernameIsValid && passwordIsValid) {
    // This opens the dashboard after the current frontend validation.
    // When the backend is connected, move this redirect after a successful
    // login response so the server still decides whether the login is valid.
    window.location.href = 'dashboard.html'
  }
})
