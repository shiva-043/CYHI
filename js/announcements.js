const announcementsList = document.querySelector('#announcementsList')
const filterButtons = document.querySelector('#filterButtons')
const reminderPageStatus = document.querySelector('#reminderPageStatus')
const managementStatus = document.querySelector('#announcementManagementStatus')
const addAnnouncementButton = document.querySelector('#addAnnouncementButton')
const announcementModal = document.querySelector('#announcementModal')
const announcementForm = document.querySelector('#announcementForm')
const announcementFormTitle = document.querySelector('#announcementFormTitle')
const closeAnnouncementFormButton = document.querySelector('#closeAnnouncementForm')
const cancelAnnouncementFormButton = document.querySelector('#cancelAnnouncementForm')

const announcementFields = {
  id: document.querySelector('#announcementId'),
  title: document.querySelector('#announcementTitle'),
  description: document.querySelector('#announcementDescription'),
  category: document.querySelector('#announcementCategory'),
  semester: document.querySelector('#announcementSemester'),
  branch: document.querySelector('#announcementBranch'),
  section: document.querySelector('#announcementSection'),
  deadline: document.querySelector('#announcementDeadline'),
  buttonText: document.querySelector('#announcementButtonText'),
  actionUrl: document.querySelector('#announcementActionUrl'),
}

let announcements = []
let selectedCategory = 'All'
let announcementsLoadFailed = false
let canManageAnnouncements = false
let availableAnnouncementSections = []

function isPermissionError(error) {
  return error?.code === '42501' || String(error?.message || '').toLowerCase().includes('policy')
}

function getCategoryLabel(category) {
  const labels = {
    Urgent: '🔴 URGENT',
    Academic: '📚 ACADEMIC',
    Events: '🎉 EVENT',
  }

  return labels[category] || String(category || 'ANNOUNCEMENT').toUpperCase()
}

function getSafeURL(value) {
  if (typeof value !== 'string' || value.trim() === '') return null

  try {
    const url = new URL(value, window.location.href)
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null
  } catch (error) {
    console.error('The announcement URL is invalid:', error)
    return null
  }
}

function handleAnnouncementAction(announcement) {
  const safeURL = getSafeURL(announcement.actionUrl || announcement.url)

  if (safeURL) {
    window.location.href = safeURL
    return
  }

  window.alert('More details will be available soon.')
}

async function handleReminderAction(announcement, reminderButton) {
  reminderPageStatus.textContent = ''
  reminderButton.disabled = true
  reminderButton.textContent = 'Setting reminder...'

  try {
    const { error } = await window.supabaseClient.functions.invoke(
      'schedule-announcement-reminder',
      { body: { announcementId: announcement.id } },
    )
    if (error) throw error

    reminderButton.textContent = 'Reminder set'
    reminderButton.classList.add('reminder-set')
    reminderPageStatus.textContent = `Email reminder set for ${announcement.title || 'this announcement'}.`
  } catch (error) {
    console.error('Unable to set email reminder:', error)
    reminderButton.disabled = false
    reminderButton.textContent = 'Email reminder'
    reminderPageStatus.textContent = isPermissionError(error)
      ? 'You do not have permission to perform this action.'
      : 'Unable to set the email reminder. Please try again later.'
  }
}

function formatDeadline(deadline) {
  const deadlineDate = new Date(deadline)
  if (Number.isNaN(deadlineDate.getTime())) return null

  return deadlineDate.toLocaleString([], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function toDateTimeLocal(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const offset = date.getTimezoneOffset() * 60000
  return new Date(date - offset).toISOString().slice(0, 16)
}

function getAnnouncementValue(announcement, camelCaseKey, snakeCaseKey) {
  return announcement[camelCaseKey] ?? announcement[snakeCaseKey] ?? ''
}

function openAnnouncementForm(announcement = null) {
  announcementForm.reset()
  announcementFields.id.value = announcement?.id ?? ''
  announcementFormTitle.textContent = announcement ? 'Edit Announcement' : 'Add Announcement'

  if (announcement) {
    announcementFields.title.value = announcement.title || ''
    announcementFields.description.value = announcement.description || ''
    announcementFields.category.value = announcement.category || ''
    announcementFields.semester.value = String(
      getAnnouncementValue(announcement, 'targetSemester', 'target_semester') || '',
    )
    announcementFields.branch.value = String(
      getAnnouncementValue(announcement, 'targetBranch', 'target_branch') || '',
    )
    refreshAnnouncementSections()
    announcementFields.section.value = String(
      getAnnouncementValue(announcement, 'targetSection', 'target_section') || 'ALL',
    )
    announcementFields.deadline.value = toDateTimeLocal(announcement.deadline)
    announcementFields.buttonText.value = getAnnouncementValue(
      announcement,
      'buttonText',
      'button_text',
    )
    announcementFields.actionUrl.value = getAnnouncementValue(
      announcement,
      'actionUrl',
      'action_url',
    )
  }

  announcementModal.hidden = false
  document.body.classList.add('modal-open')
  announcementFields.title.focus()
}

function closeAnnouncementForm() {
  announcementModal.hidden = true
  document.body.classList.remove('modal-open')
}

function getAnnouncementPayload() {
  return {
    title: announcementFields.title.value.trim(),
    description: announcementFields.description.value.trim(),
    category: announcementFields.category.value,
    target_semester: Number(announcementFields.semester.value),
    target_branch: announcementFields.branch.value,
    target_section: announcementFields.section.value,
    deadline: announcementFields.deadline.value || null,
    button_text: announcementFields.buttonText.value.trim(),
    action_url: announcementFields.actionUrl.value.trim(),
  }
}

async function saveAnnouncement(event) {
  event.preventDefault()
  if (!announcementForm.reportValidity()) return

  const announcementId = announcementFields.id.value
  const isEditing = announcementId !== ''
  managementStatus.textContent = 'Saving announcement...'

  try {
    const query = isEditing
      ? window.supabaseClient
        .from('announcements')
        .update(getAnnouncementPayload())
        .eq('id', announcementId)
      : window.supabaseClient
        .from('announcements')
        .insert(getAnnouncementPayload())
    const { error } = await query
    if (error) throw error

    closeAnnouncementForm()
    managementStatus.textContent = isEditing
      ? 'Announcement updated successfully.'
      : 'Announcement created successfully.'
    await loadAnnouncements()
  } catch (error) {
    console.error('Unable to save announcement:', error)
    managementStatus.textContent = isPermissionError(error)
      ? 'You do not have permission to perform this action.'
      : 'Unable to save the announcement. Please try again.'
  }
}

async function deleteAnnouncement(announcement) {
  const confirmed = window.confirm('Are you sure you want to delete this announcement?')
  if (!confirmed) return

  managementStatus.textContent = 'Deleting announcement...'

  try {
    const { error } = await window.supabaseClient
      .from('announcements')
      .delete()
      .eq('id', announcement.id)
    if (error) throw error

    managementStatus.textContent = 'Announcement deleted successfully.'
    await loadAnnouncements()
  } catch (error) {
    console.error('Unable to delete announcement:', error)
    managementStatus.textContent = isPermissionError(error)
      ? 'You do not have permission to perform this action.'
      : 'Unable to delete the announcement. Please try again.'
  }
}

function createAnnouncementCard(announcement) {
  const card = document.createElement('article')
  card.className = 'announcement-card'

  const category = document.createElement('p')
  category.className = `announcement-category category-${String(announcement.category).toLowerCase()}`
  category.textContent = getCategoryLabel(announcement.category)

  const title = document.createElement('h2')
  title.textContent = announcement.title || 'Announcement'

  const divider = document.createElement('div')
  divider.className = 'announcement-divider'
  divider.setAttribute('aria-hidden', 'true')

  const description = document.createElement('p')
  description.className = 'announcement-description'
  description.textContent = announcement.description || ''
  card.append(category, title, divider, description)

  if (announcement.target) {
    const target = document.createElement('p')
    target.className = 'announcement-target'
    target.textContent = `For: ${announcement.target}`
    card.append(target)
  }

  const deadline = formatDeadline(announcement.deadline)
  if (deadline) {
    const deadlineText = document.createElement('p')
    deadlineText.className = 'announcement-deadline'
    deadlineText.textContent = `Deadline: ${deadline}`
    card.append(deadlineText)
  }

  const actions = document.createElement('div')
  actions.className = 'announcement-card-actions'

  if (announcement.buttonText || announcement.button_text) {
    const actionButton = document.createElement('button')
    actionButton.className = 'announcement-button'
    actionButton.type = 'button'
    actionButton.textContent = announcement.buttonText || announcement.button_text
    actionButton.addEventListener('click', () => handleAnnouncementAction(announcement))
    actions.append(actionButton)
  }

  if (deadline && announcement.id != null) {
    const reminderButton = document.createElement('button')
    reminderButton.className = 'reminder-button'
    reminderButton.type = 'button'
    reminderButton.textContent = announcement.reminderEnabled ? 'Reminder set' : 'Email reminder'
    reminderButton.disabled = Boolean(announcement.reminderEnabled)
    reminderButton.classList.toggle('reminder-set', Boolean(announcement.reminderEnabled))
    reminderButton.addEventListener('click', () => {
      handleReminderAction(announcement, reminderButton)
    })
    actions.append(reminderButton)
  }

  if (canManageAnnouncements && announcement.id != null) {
    const editButton = document.createElement('button')
    editButton.className = 'management-card-button'
    editButton.type = 'button'
    editButton.textContent = 'Edit'
    editButton.addEventListener('click', () => openAnnouncementForm(announcement))

    const deleteButton = document.createElement('button')
    deleteButton.className = 'management-card-button delete-card-button'
    deleteButton.type = 'button'
    deleteButton.textContent = 'Delete'
    deleteButton.addEventListener('click', () => deleteAnnouncement(announcement))
    actions.append(editButton, deleteButton)
  }

  if (actions.childElementCount > 0) card.append(actions)
  return card
}

function displayAnnouncements(items) {
  announcementsList.replaceChildren()

  if (items.length === 0) {
    const message = document.createElement('p')
    message.className = 'announcement-state empty-state'
    message.textContent = selectedCategory === 'All'
      ? 'No announcements available.'
      : `No ${selectedCategory} announcements available.`
    announcementsList.append(message)
    return
  }

  items.forEach((announcement) => {
    announcementsList.append(createAnnouncementCard(announcement))
  })
}

function displayLoadError() {
  announcementsList.replaceChildren()
  const message = document.createElement('p')
  message.className = 'announcement-state error-state'
  message.textContent = 'Unable to load announcements. Please try again later.'
  announcementsList.append(message)
}

function filterAnnouncements() {
  if (announcementsLoadFailed) {
    displayLoadError()
    return
  }

  const filteredAnnouncements = selectedCategory === 'All'
    ? announcements
    : announcements.filter((announcement) => announcement.category === selectedCategory)
  displayAnnouncements(filteredAnnouncements)
}

async function loadAnnouncements() {
  try {
    const { data, error } = await window.supabaseClient
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw error

    announcements = data
    announcementsLoadFailed = false
    reminderPageStatus.textContent = ''
    filterAnnouncements()
  } catch (error) {
    console.error('Unable to load announcements:', error)
    announcementsLoadFailed = true
    displayLoadError()
  }
}

async function loadBranches() {
  const { data, error } = await window.supabaseClient
    .from('sections')
    .select('name, branch, semester')
    .order('branch')
    .order('semester')
    .order('name')
  if (error) throw error

  availableAnnouncementSections = data
  const branches = [...new Set(data.map((section) => section.branch))]
  announcementFields.branch.replaceChildren(new Option('Select branch', '', true, true))
  announcementFields.branch.options[0].disabled = true
  branches.forEach((branch) => {
    announcementFields.branch.add(new Option(branch, branch))
  })
  refreshAnnouncementSections()
}

function refreshAnnouncementSections() {
  const previousSection = announcementFields.section.value || 'ALL'
  announcementFields.section.replaceChildren(new Option('ALL', 'ALL'))

  const names = [...new Set(
    availableAnnouncementSections
      .filter((section) => (
        section.branch === announcementFields.branch.value &&
        Number(section.semester) === Number(announcementFields.semester.value)
      ))
      .map((section) => section.name),
  )]

  names.forEach((name) => announcementFields.section.add(new Option(name, name)))
  announcementFields.section.value = names.includes(previousSection)
    ? previousSection
    : 'ALL'
}

async function loadUserRole() {
  try {
    const user = await window.CampusAuth.getAuthenticatedUser()
    canManageAnnouncements = window.CampusAuth.canManageContent(user)
    addAnnouncementButton.hidden = !canManageAnnouncements

    if (canManageAnnouncements) await loadBranches()
    if (!announcementsLoadFailed) filterAnnouncements()
    return true
  } catch (error) {
    console.error('Unable to determine announcement permissions:', error)
    canManageAnnouncements = false
    addAnnouncementButton.hidden = true
    return false
  }
}

filterButtons.addEventListener('click', (event) => {
  const selectedButton = event.target.closest('.filter-button')
  if (!selectedButton) return

  selectedCategory = selectedButton.dataset.filter
  document.querySelectorAll('.filter-button').forEach((button) => {
    const isSelected = button === selectedButton
    button.classList.toggle('active', isSelected)
    button.setAttribute('aria-pressed', String(isSelected))
  })
  filterAnnouncements()
})

addAnnouncementButton.addEventListener('click', () => openAnnouncementForm())
announcementForm.addEventListener('submit', saveAnnouncement)
announcementFields.branch.addEventListener('change', refreshAnnouncementSections)
announcementFields.semester.addEventListener('change', refreshAnnouncementSections)
closeAnnouncementFormButton.addEventListener('click', closeAnnouncementForm)
cancelAnnouncementFormButton.addEventListener('click', closeAnnouncementForm)
announcementModal.addEventListener('click', (event) => {
  if (event.target === announcementModal) closeAnnouncementForm()
})
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !announcementModal.hidden) closeAnnouncementForm()
})

document.addEventListener('DOMContentLoaded', async () => {
  const isAuthenticated = await loadUserRole()
  if (!isAuthenticated) return

  loadAnnouncements()
  setInterval(loadAnnouncements, 60000)
})
