const API_BASE_URL = 'http://localhost:3000/api'

const selectedDay = document.querySelector('#selectedDay')
const scheduleList = document.querySelector('#scheduleList')
const nextClassContent = document.querySelector('#nextClassContent')
const navigationMessage = document.querySelector('#navigationMessage')
const scheduleManagementStatus = document.querySelector('#scheduleManagementStatus')
const addClassButton = document.querySelector('#addClassButton')
const classModal = document.querySelector('#classModal')
const classForm = document.querySelector('#classForm')
const classFormTitle = document.querySelector('#classFormTitle')
const closeClassFormButton = document.querySelector('#closeClassForm')
const cancelClassFormButton = document.querySelector('#cancelClassForm')

const classFields = {
  id: document.querySelector('#classId'),
  subject: document.querySelector('#classSubject'),
  room: document.querySelector('#classRoom'),
  date: document.querySelector('#classDate'),
  type: document.querySelector('#classType'),
  startTime: document.querySelector('#classStartTime'),
  endTime: document.querySelector('#classEndTime'),
  semester: document.querySelector('#classSemester'),
  branch: document.querySelector('#classBranch'),
  section: document.querySelector('#classSection'),
}

let todaySchedule = []
let scheduleLoadFailed = false
let canManageSchedule = false

function formatTime(value) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  return date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })
}

function displaySelectedDay() {
  const today = new Date()
  const weekday = today.toLocaleDateString([], { weekday: 'short' }).toUpperCase()
  selectedDay.textContent = `${weekday} ${today.getDate()}`
}

function isCurrentClass(scheduleItem, now = new Date()) {
  if (scheduleItem.type !== 'class') return false

  const startTime = new Date(scheduleItem.startTime)
  const endTime = new Date(scheduleItem.endTime)
  return (
    !Number.isNaN(startTime.getTime()) &&
    !Number.isNaN(endTime.getTime()) &&
    now >= startTime &&
    now < endTime
  )
}

function getScheduleValue(scheduleItem, camelCaseKey, snakeCaseKey) {
  return scheduleItem[camelCaseKey] ?? scheduleItem[snakeCaseKey] ?? ''
}

function splitDateTime(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return { date: '', time: '' }

  const offset = date.getTimezoneOffset() * 60000
  const localISO = new Date(date - offset).toISOString()
  return { date: localISO.slice(0, 10), time: localISO.slice(11, 16) }
}

function openClassForm(scheduleItem = null) {
  classForm.reset()
  classFields.id.value = scheduleItem?.id ?? ''
  classFormTitle.textContent = scheduleItem ? 'Edit Class' : 'Add Class'

  if (scheduleItem) {
    const start = splitDateTime(scheduleItem.startTime)
    const end = splitDateTime(scheduleItem.endTime)
    classFields.subject.value = scheduleItem.subject || ''
    classFields.room.value = scheduleItem.room || ''
    classFields.date.value = start.date
    classFields.type.value = scheduleItem.type || 'class'
    classFields.startTime.value = start.time
    classFields.endTime.value = end.time
    classFields.semester.value = String(
      getScheduleValue(scheduleItem, 'targetSemester', 'target_semester') || '1',
    )
    classFields.branch.value = String(
      getScheduleValue(scheduleItem, 'targetBranch', 'target_branch') || 'CSE',
    )
    classFields.section.value = String(
      getScheduleValue(scheduleItem, 'targetSection', 'target_section') || 'ALL',
    )
  }

  classModal.hidden = false
  document.body.classList.add('modal-open')
  classFields.subject.focus()
}

function closeClassForm() {
  classModal.hidden = true
  document.body.classList.remove('modal-open')
}

function getClassPayload() {
  return {
    subject: classFields.subject.value.trim(),
    room: classFields.type.value === 'class' ? classFields.room.value.trim() : '',
    date: classFields.date.value,
    startTime: `${classFields.date.value}T${classFields.startTime.value}:00`,
    endTime: `${classFields.date.value}T${classFields.endTime.value}:00`,
    type: classFields.type.value,
    targetSemester: Number(classFields.semester.value),
    targetBranch: classFields.branch.value,
    targetSection: classFields.section.value,
  }
}

async function saveClass(event) {
  event.preventDefault()
  if (!classForm.reportValidity()) return

  const payload = getClassPayload()
  if (new Date(payload.endTime) <= new Date(payload.startTime)) {
    scheduleManagementStatus.textContent = 'End Time must be later than Start Time.'
    return
  }

  const classId = classFields.id.value
  const isEditing = classId !== ''
  const endpoint = isEditing
    ? `${API_BASE_URL}/timetable/${encodeURIComponent(classId)}`
    : `${API_BASE_URL}/timetable`

  scheduleManagementStatus.textContent = 'Saving timetable entry...'

  try {
    const response = await window.CampusAuth.apiFetch(endpoint, {
      method: isEditing ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) throw new Error(`Request failed with status ${response.status}`)

    closeClassForm()
    scheduleManagementStatus.textContent = isEditing
      ? 'Timetable entry updated successfully.'
      : 'Timetable entry created successfully.'
    await loadSchedule()
  } catch (error) {
    console.error('Unable to save timetable entry:', error)
    scheduleManagementStatus.textContent = error.name === 'PermissionError'
      ? error.message
      : 'Unable to save the timetable entry. Please try again.'
  }
}

async function deleteClass(scheduleItem) {
  const confirmed = window.confirm('Are you sure you want to delete this timetable entry?')
  if (!confirmed) return

  scheduleManagementStatus.textContent = 'Deleting timetable entry...'

  try {
    const response = await window.CampusAuth.apiFetch(
      `${API_BASE_URL}/timetable/${encodeURIComponent(scheduleItem.id)}`,
      { method: 'DELETE' },
    )

    if (!response.ok) throw new Error(`Request failed with status ${response.status}`)

    scheduleManagementStatus.textContent = 'Timetable entry deleted successfully.'
    await loadSchedule()
  } catch (error) {
    console.error('Unable to delete timetable entry:', error)
    scheduleManagementStatus.textContent = error.name === 'PermissionError'
      ? error.message
      : 'Unable to delete the timetable entry. Please try again.'
  }
}

function createScheduleItem(scheduleItem) {
  const item = document.createElement('article')
  const itemType = ['class', 'break', 'free'].includes(scheduleItem.type)
    ? scheduleItem.type
    : 'class'
  item.className = `schedule-item schedule-${itemType}`

  const startTime = document.createElement('time')
  startTime.className = 'schedule-time'
  startTime.dateTime = scheduleItem.startTime || ''
  startTime.textContent = formatTime(scheduleItem.startTime)

  const timelineMark = document.createElement('span')
  timelineMark.className = 'timeline-mark'
  timelineMark.setAttribute('aria-hidden', 'true')

  const details = document.createElement('div')
  details.className = 'schedule-details'

  if (isCurrentClass(scheduleItem)) {
    const currentLabel = document.createElement('span')
    currentLabel.className = 'current-label'
    currentLabel.textContent = 'Current'
    details.append(currentLabel)
    item.classList.add('current-class')
  }

  const subject = document.createElement('h2')
  subject.textContent = scheduleItem.subject || (itemType === 'free' ? 'Free' : 'Untitled')
  details.append(subject)

  if (itemType === 'class' && scheduleItem.room) {
    const room = document.createElement('p')
    room.textContent = scheduleItem.room
    details.append(room)
  }

  if (canManageSchedule && scheduleItem.id != null) {
    const controls = document.createElement('div')
    controls.className = 'schedule-item-controls'

    const editButton = document.createElement('button')
    editButton.type = 'button'
    editButton.textContent = 'Edit'
    editButton.addEventListener('click', () => openClassForm(scheduleItem))

    const deleteButton = document.createElement('button')
    deleteButton.type = 'button'
    deleteButton.className = 'delete-class-button'
    deleteButton.textContent = 'Delete'
    deleteButton.addEventListener('click', () => deleteClass(scheduleItem))
    controls.append(editButton, deleteButton)
    details.append(controls)
  }

  item.append(startTime, timelineMark, details)
  return item
}

function displaySchedule(schedule) {
  scheduleList.replaceChildren()

  if (schedule.length === 0) {
    const message = document.createElement('p')
    message.className = 'schedule-state'
    message.textContent = 'No classes scheduled for today.'
    scheduleList.append(message)
    return
  }

  const orderedSchedule = [...schedule].sort(
    (firstItem, secondItem) => new Date(firstItem.startTime) - new Date(secondItem.startTime),
  )
  orderedSchedule.forEach((scheduleItem) => {
    scheduleList.append(createScheduleItem(scheduleItem))
  })
}

function findNextClass(schedule) {
  const now = new Date()
  return schedule
    .filter((scheduleItem) => scheduleItem.type === 'class')
    .map((scheduleItem) => ({ ...scheduleItem, startDate: new Date(scheduleItem.startTime) }))
    .filter((scheduleItem) => !Number.isNaN(scheduleItem.startDate.getTime()))
    .filter((scheduleItem) => scheduleItem.startDate > now)
    .sort((firstClass, secondClass) => firstClass.startDate - secondClass.startDate)[0] || null
}

function displayNextClass(nextClass) {
  nextClassContent.replaceChildren()
  navigationMessage.textContent = ''

  if (!nextClass) {
    const message = document.createElement('p')
    message.className = 'next-class-state'
    message.textContent = 'No more classes today.'
    nextClassContent.append(message)
    return
  }

  const subject = document.createElement('h3')
  subject.textContent = nextClass.subject || 'Class'
  const time = document.createElement('p')
  time.className = 'next-class-time'
  time.textContent = formatTime(nextClass.startDate)
  const room = document.createElement('p')
  room.className = 'next-class-room'
  room.textContent = nextClass.room || 'Room TBA'
  const navigateButton = document.createElement('button')
  navigateButton.className = 'navigate-button'
  navigateButton.type = 'button'
  navigateButton.textContent = 'Navigate →'
  navigateButton.addEventListener('click', () => {
    navigationMessage.textContent = 'Navigation functionality coming soon.'
  })
  nextClassContent.append(subject, time, room, navigateButton)
}

function displayScheduleError() {
  scheduleList.replaceChildren()
  nextClassContent.replaceChildren()
  const scheduleMessage = document.createElement('p')
  scheduleMessage.className = 'schedule-state error-state'
  scheduleMessage.textContent = 'Unable to load schedule. Please try again later.'
  const nextClassMessage = document.createElement('p')
  nextClassMessage.className = 'next-class-state error-state'
  nextClassMessage.textContent = 'Unable to load next class.'
  scheduleList.append(scheduleMessage)
  nextClassContent.append(nextClassMessage)
}

async function loadSchedule() {
  try {
    const response = await window.CampusAuth.apiFetch(`${API_BASE_URL}/timetable/today`)
    if (!response.ok) throw new Error(`Request failed with status ${response.status}`)

    const schedule = await response.json()
    if (!Array.isArray(schedule)) throw new Error('The timetable response is not an array.')

    todaySchedule = schedule
    scheduleLoadFailed = false
    displaySchedule(schedule)
    displayNextClass(findNextClass(schedule))
  } catch (error) {
    console.error('Unable to load schedule:', error)
    scheduleLoadFailed = true
    displayScheduleError()
  }
}

async function loadBranches() {
  try {
    const response = await window.CampusAuth.apiFetch(`${API_BASE_URL}/branches`)
    if (!response.ok) return

    const branches = await response.json()
    if (!Array.isArray(branches)) return

    const select = classFields.branch
    const existingValues = new Set([...select.options].map((option) => option.value))
    branches.forEach((branch) => {
      const branchCode = typeof branch === 'string' ? branch : branch.code
      if (!branchCode || existingValues.has(branchCode)) return

      const option = document.createElement('option')
      option.value = branchCode
      option.textContent = branchCode
      select.append(option)
      existingValues.add(branchCode)
    })
  } catch (error) {
    console.error('Unable to load additional branches:', error)
  }
}

async function loadUserRole() {
  try {
    const user = await window.CampusAuth.getAuthenticatedUser()
    canManageSchedule = window.CampusAuth.canManageContent(user)
    addClassButton.hidden = !canManageSchedule

    if (canManageSchedule) await loadBranches()
    if (!scheduleLoadFailed) displaySchedule(todaySchedule)
  } catch (error) {
    console.error('Unable to determine timetable permissions:', error)
    canManageSchedule = false
    addClassButton.hidden = true
  }
}

addClassButton.addEventListener('click', () => openClassForm())
classForm.addEventListener('submit', saveClass)
closeClassFormButton.addEventListener('click', closeClassForm)
cancelClassFormButton.addEventListener('click', closeClassForm)
classModal.addEventListener('click', (event) => {
  if (event.target === classModal) closeClassForm()
})
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !classModal.hidden) closeClassForm()
})

document.addEventListener('DOMContentLoaded', () => {
  displaySelectedDay()
  loadSchedule()
  loadUserRole()

  setInterval(() => {
    displaySelectedDay()
    loadSchedule()
  }, 60000)
})
