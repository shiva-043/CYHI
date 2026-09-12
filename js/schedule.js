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
  day: document.querySelector('#classDay'),
  type: document.querySelector('#classType'),
  startTime: document.querySelector('#classStartTime'),
  endTime: document.querySelector('#classEndTime'),
  branch: document.querySelector('#classBranch'),
  semester: document.querySelector('#classSemester'),
  section: document.querySelector('#classSection'),
}

let todaySchedule = []
let scheduleLoadFailed = false
let canManageSchedule = false
let currentProfile = null
let availableSections = []

function isPermissionError(error) {
  return error?.code === '42501' || String(error?.message || '').toLowerCase().includes('policy')
}

function combineTodayWithTime(time) {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}T${time}`
}

function normalizeScheduleItem(item) {
  return {
    ...item,
    type: item.type,
    startTime: combineTodayWithTime(item.start_time),
    endTime: combineTodayWithTime(item.end_time),
    targetSection: item.section_id,
  }
}

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
    const selectedSection = availableSections.find(
      (section) => String(section.id) === String(scheduleItem.section_id),
    )
    classFields.subject.value = scheduleItem.subject || ''
    classFields.room.value = scheduleItem.room || ''
    classFields.day.value = scheduleItem.day_of_week || 'Monday'
    classFields.type.value = scheduleItem.type || 'class'
    classFields.startTime.value = start.time
    classFields.endTime.value = end.time
    classFields.branch.value = selectedSection?.branch || ''
    classFields.semester.value = String(selectedSection?.semester || '1')
    refreshSectionOptions()
    classFields.section.value = String(
      getScheduleValue(scheduleItem, 'targetSection', 'section_id') || '',
    )
  } else {
    classFields.day.value = new Date().toLocaleDateString('en-US', { weekday: 'long' })
    classFields.branch.value = currentProfile?.branch || availableSections[0]?.branch || ''
    classFields.semester.value = String(currentProfile?.semester || '1')
    refreshSectionOptions()
    classFields.section.value = String(currentProfile?.section_id || '')
  }

  updateClassTypeFields()
  classModal.hidden = false
  document.body.classList.add('modal-open')
  classFields.subject.focus()
}

function updateClassTypeFields() {
  const isClass = classFields.type.value === 'class'
  classFields.subject.required = isClass
  classFields.room.disabled = !isClass
  classFields.room.required = isClass
}

function closeClassForm() {
  classModal.hidden = true
  document.body.classList.remove('modal-open')
}

function getClassPayload() {
  const selectedType = classFields.type.value
  return {
    subject: selectedType === 'class'
      ? classFields.subject.value.trim()
      : selectedType[0].toUpperCase() + selectedType.slice(1),
    room: selectedType === 'class' ? classFields.room.value.trim() : '',
    day_of_week: classFields.day.value,
    start_time: `${classFields.startTime.value}:00`,
    end_time: `${classFields.endTime.value}:00`,
    type: selectedType,
    section_id: classFields.section.value,
  }
}

async function saveClass(event) {
  event.preventDefault()
  if (!classForm.reportValidity()) return

  const payload = getClassPayload()
  if (payload.end_time <= payload.start_time) {
    scheduleManagementStatus.textContent = 'End Time must be later than Start Time.'
    return
  }

  const classId = classFields.id.value
  const isEditing = classId !== ''
  scheduleManagementStatus.textContent = 'Saving timetable entry...'

  try {
    const query = isEditing
      ? window.supabaseClient.from('timetable').update(payload).eq('id', classId)
      : window.supabaseClient.from('timetable').insert(payload)
    const { error } = await query
    if (error) throw error

    closeClassForm()
    scheduleManagementStatus.textContent = isEditing
      ? 'Timetable entry updated successfully.'
      : 'Timetable entry created successfully.'
    await loadSchedule()
  } catch (error) {
    console.error('Unable to save timetable entry:', error)
    scheduleManagementStatus.textContent = isPermissionError(error)
      ? 'You do not have permission to perform this action.'
      : 'Unable to save the timetable entry. Please try again.'
  }
}

async function deleteClass(scheduleItem) {
  const confirmed = window.confirm('Are you sure you want to delete this timetable entry?')
  if (!confirmed) return

  scheduleManagementStatus.textContent = 'Deleting timetable entry...'

  try {
    const { error } = await window.supabaseClient
      .from('timetable')
      .delete()
      .eq('id', scheduleItem.id)
    if (error) throw error

    scheduleManagementStatus.textContent = 'Timetable entry deleted successfully.'
    await loadSchedule()
  } catch (error) {
    console.error('Unable to delete timetable entry:', error)
    scheduleManagementStatus.textContent = isPermissionError(error)
      ? 'You do not have permission to perform this action.'
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
    if (!currentProfile) currentProfile = await window.CampusAuth.getAuthenticatedUser()

    let query = window.supabaseClient
      .from('timetable')
      .select('*')
      .order('start_time')

    if (currentProfile.section_id != null) {
      query = query.eq('section_id', currentProfile.section_id)
    }
    const { data, error } = await query
    if (error) throw error

    const weekday = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
    const schedule = data
      .filter((item) => String(item.day_of_week || '').toLowerCase() === weekday)
      .map(normalizeScheduleItem)

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

async function loadSections() {
  try {
    const { data: sections, error } = await window.supabaseClient
      .from('sections')
      .select('id, name, branch, semester')
      .order('branch')
      .order('semester')
      .order('name')
    if (error) throw error

    if (currentProfile.role === 'professor') {
      const { data: assignments, error: assignmentError } = await window.supabaseClient
        .from('section_professors')
        .select('section_id')
        .eq('professor_id', currentProfile.id)
      if (assignmentError) throw assignmentError

      const assignedIds = new Set(assignments.map((item) => String(item.section_id)))
      availableSections = sections.filter((section) => assignedIds.has(String(section.id)))
    } else {
      availableSections = sections
    }

    const branches = [...new Set(availableSections.map((section) => section.branch))]
    classFields.branch.replaceChildren(new Option('Select branch', '', true, true))
    classFields.branch.options[0].disabled = true
    branches.forEach((branch) => classFields.branch.add(new Option(branch, branch)))
    refreshSectionOptions()
  } catch (error) {
    console.error('Unable to load sections:', error)
    scheduleManagementStatus.textContent = 'Unable to load the available sections.'
  }
}

function refreshSectionOptions() {
  const previousSection = classFields.section.value
  classFields.section.replaceChildren(new Option('Select section', '', true, true))
  classFields.section.options[0].disabled = true

  availableSections
    .filter((section) => (
      section.branch === classFields.branch.value &&
      Number(section.semester) === Number(classFields.semester.value)
    ))
    .forEach((section) => {
      classFields.section.add(new Option(section.name, section.id))
    })

  if ([...classFields.section.options].some((option) => option.value === previousSection)) {
    classFields.section.value = previousSection
  }
}

async function loadUserRole() {
  try {
    const user = await window.CampusAuth.getAuthenticatedUser()
    currentProfile = user
    canManageSchedule = window.CampusAuth.canManageContent(user)
    addClassButton.hidden = !canManageSchedule

    if (canManageSchedule) await loadSections()
    if (!scheduleLoadFailed) displaySchedule(todaySchedule)
    return true
  } catch (error) {
    console.error('Unable to determine timetable permissions:', error)
    canManageSchedule = false
    addClassButton.hidden = true
    return false
  }
}

addClassButton.addEventListener('click', () => openClassForm())
classForm.addEventListener('submit', saveClass)
closeClassFormButton.addEventListener('click', closeClassForm)
cancelClassFormButton.addEventListener('click', closeClassForm)
classFields.type.addEventListener('change', updateClassTypeFields)
classFields.branch.addEventListener('change', refreshSectionOptions)
classFields.semester.addEventListener('change', refreshSectionOptions)
classModal.addEventListener('click', (event) => {
  if (event.target === classModal) closeClassForm()
})
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !classModal.hidden) closeClassForm()
})

document.addEventListener('DOMContentLoaded', async () => {
  displaySelectedDay()
  const isAuthenticated = await loadUserRole()
  if (!isAuthenticated) return

  loadSchedule()

  setInterval(() => {
    displaySelectedDay()
    loadSchedule()
  }, 60000)
})
