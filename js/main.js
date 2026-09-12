// Find the button that should move the visitor to the features section.
const getStartedButton = document.querySelector('#getStartedButton')

// Move smoothly from the hero to the features section.
getStartedButton.addEventListener('click', () => {
  document.querySelector('#features').scrollIntoView({ behavior: 'smooth' })
})
