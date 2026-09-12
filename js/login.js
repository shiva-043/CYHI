// Get the login form and its fields.
const loginForm = document.querySelector('#loginForm')
const usernameInput = document.querySelector('#username')
const passwordInput = document.querySelector('#password')
const passwordToggle = document.querySelector('#passwordToggle')
const forgotPassword = document.querySelector('#forgotPassword')
const recoveryMessage = document.querySelector('#recoveryMessage')
const loginStatus = document.querySelector('#loginStatus')
const loginButton = document.querySelector('#loginButton')

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

function getLoginErrorMessage(error) {
  const message = String(error?.message || '').toLowerCase()
  if (message.includes('invalid login credentials')) return 'Invalid email or password.'
  if (message.includes('email not confirmed')) return 'Confirm your email before logging in.'
  return 'Unable to log in. Please try again.'
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault()

  const usernameIsValid = usernameInput.value.trim() !== ''
  const emailIsValid = usernameIsValid && usernameInput.validity.valid
  const passwordIsValid = passwordInput.value.trim() !== ''

  usernameIsValid
    ? clearError(usernameInput)
    : showError(usernameInput, 'Username cannot be empty.')

  if (usernameIsValid && !emailIsValid) {
    showError(usernameInput, 'Enter a valid email address.')
  }

  passwordIsValid
    ? clearError(passwordInput)
    : showError(passwordInput, 'Password cannot be empty.')

  if (!emailIsValid || !passwordIsValid) return

  loginStatus.textContent = 'Logging in...'
  loginButton.disabled = true

  try {
    const { error: loginError } = await window.supabaseClient.auth.signInWithPassword({
      email: usernameInput.value.trim().toLowerCase(),
      password: passwordInput.value,
    })
    if (loginError) throw loginError

    const { data: userData, error: userError } = await window.supabaseClient.auth.getUser()
    if (userError || !userData.user) throw userError || new Error('Authentication failed.')

    const { data: profile, error: profileError } = await window.supabaseClient
      .from('profiles')
      .select('id')
      .eq('id', userData.user.id)
      .single()

    if (profileError || !profile) {
      await window.supabaseClient.auth.signOut({ scope: 'local' })
      loginStatus.textContent = 'Your account does not have a profile. Contact an administrator.'
      return
    }

    window.location.replace('dashboard.html')
  } catch (error) {
    console.error('Login failed:', error)
    loginStatus.textContent = getLoginErrorMessage(error)
  } finally {
    loginButton.disabled = false
  }
})

document.addEventListener('DOMContentLoaded', async () => {
  const signupResult = new URLSearchParams(window.location.search).get('signup')
  if (signupResult === 'confirm-email') {
    loginStatus.classList.add('success-message')
    loginStatus.textContent = 'Account created. Check your inbox and confirm your email before logging in.'
  } else if (signupResult === 'success') {
    loginStatus.classList.add('success-message')
    loginStatus.textContent = 'Account created successfully. You can now log in.'
  }

  const { data, error } = await window.supabaseClient.auth.getSession()
  if (!error && data.session) window.location.replace('dashboard.html')
})
