// IIITDM Jabalpur Campus Companion - Timetable System
const selectedDay = document.querySelector('#selectedDay')
const daySelector = document.querySelector('#daySelector')
const scheduleList = document.querySelector('#scheduleList')
const nextClassContent = document.querySelector('#nextClassContent')
const navigationMessage = document.querySelector('#navigationMessage')
const scheduleManagementPanel = document.querySelector('#scheduleManagementPanel')
const managementSubtitle = document.querySelector('#managementSubtitle')
const scheduleManagementStatus = document.querySelector('#scheduleManagementStatus')
const addClassButton = document.querySelector('#addClassButton')
const importPdfButton = document.querySelector('#importPdfButton')
const classModal = document.querySelector('#classModal')
const classForm = document.querySelector('#classForm')
const classFormTitle = document.querySelector('#classFormTitle')
const closeClassFormButton = document.querySelector('#closeClassForm')
const cancelClassFormButton = document.querySelector('#cancelClassForm')

// PDF Timetable Modal Elements
const pdfImportModal = document.querySelector('#pdfImportModal')
const closePdfModalButton = document.querySelector('#closePdfModal')
const cancelPdfModalButton = document.querySelector('#cancelPdfModal')
const pdfBranch = document.querySelector('#pdfBranch')
const pdfSemester = document.querySelector('#pdfSemester')
const pdfSection = document.querySelector('#pdfSection')
const pdfDropzone = document.querySelector('#pdfDropzone')
const pdfFileInput = document.querySelector('#pdfFileInput')
const pdfSelectedBar = document.querySelector('#pdfSelectedBar')
const pdfFileName = document.querySelector('#pdfFileName')
const pdfFileSize = document.querySelector('#pdfFileSize')
const pdfClearFileBtn = document.querySelector('#pdfClearFileBtn')
const pdfParseStatus = document.querySelector('#pdfParseStatus')
const pdfParseStatusText = document.querySelector('#pdfParseStatusText')
const pdfPreviewSection = document.querySelector('#pdfPreviewSection')
const pdfPreviewCount = document.querySelector('#pdfPreviewCount')
const pdfMasterCheckbox = document.querySelector('#pdfMasterCheckbox')
const pdfSelectAllBtn = document.querySelector('#pdfSelectAllBtn')
const pdfDeselectAllBtn = document.querySelector('#pdfDeselectAllBtn')
const pdfAddPreviewRowBtn = document.querySelector('#pdfAddPreviewRowBtn')
const pdfPreviewTableBody = document.querySelector('#pdfPreviewTableBody')
const pdfImportButton = document.querySelector('#pdfImportButton')
const pdfImportMessage = document.querySelector('#pdfImportMessage')

// Configure PDF.js Worker
if (typeof window !== 'undefined' && window.pdfjsLib) {
  window.pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
}

let parsedPdfClasses = []
let currentPdfFile = null

const classFields = {
  id: document.querySelector('#classId'),
  branch: document.querySelector('#classBranch'),
  semester: document.querySelector('#classSemester'),
  section: document.querySelector('#classSection'),
  batch: document.querySelector('#classBatch'),
  courseCode: document.querySelector('#classCourseCode'),
  courseName: document.querySelector('#classCourseName'),
  faculty: document.querySelector('#classFaculty'),
  room: document.querySelector('#classRoom'),
  day: document.querySelector('#classDay'),
  type: document.querySelector('#classType'),
  startTime: document.querySelector('#classStartTime'),
  endTime: document.querySelector('#classEndTime'),
}

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

let currentProfile = null
let canManageSchedule = false
let availableSections = []
let fullSchedule = []
let selectedDayName = getTodayWeekday()

function getTodayWeekday() {
  const day = new Date().toLocaleDateString('en-US', { weekday: 'long' })
  return WEEKDAYS.includes(day) ? day : 'Monday'
}

function isPermissionError(error) {
  return error?.code === '42501' || String(error?.message || '').toLowerCase().includes('policy')
}

function permissionDeniedError() {
  const error = new Error('No authorized row was changed.')
  error.code = '42501'
  return error
}

function combineTodayWithTime(time) {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  const timeStr = String(time || '').slice(0, 8)
  return `${year}-${month}-${day}T${timeStr}`
}

function formatTime(timeStr) {
  if (!timeStr) return ''
  const isoStr = timeStr.includes('T') ? timeStr : combineTodayWithTime(timeStr)
  const date = new Date(isoStr)
  if (Number.isNaN(date.getTime())) return timeStr.slice(0, 5)

  return date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatTimeRange(start, end) {
  const s = formatTime(start)
  const e = formatTime(end)
  return s && e ? `${s} – ${e}` : s || e || ''
}

function displaySelectedDayHeader() {
  const today = new Date()
  const todayWeekday = today.toLocaleDateString('en-US', { weekday: 'long' })

  if (selectedDayName.toLowerCase() === todayWeekday.toLowerCase()) {
    const weekdayShort = today.toLocaleDateString([], { weekday: 'short' }).toUpperCase()
    const monthShort = today.toLocaleDateString([], { month: 'short' }).toUpperCase()
    selectedDay.textContent = `TODAY • ${weekdayShort} ${today.getDate()} ${monthShort}`
  } else {
    selectedDay.textContent = selectedDayName.toUpperCase()
  }

  // Update active tab in day selector
  if (daySelector) {
    const tabs = daySelector.querySelectorAll('.day-tab')
    tabs.forEach((tab) => {
      const tabDay = tab.dataset.day
      if (tabDay && tabDay.toLowerCase() === selectedDayName.toLowerCase()) {
        tab.classList.add('active')
        tab.setAttribute('aria-selected', 'true')
      } else {
        tab.classList.remove('active')
        tab.setAttribute('aria-selected', 'false')
      }
    })
  }
}

function isCurrentClass(scheduleItem, now = new Date()) {
  const todayWeekday = now.toLocaleDateString('en-US', { weekday: 'long' })
  if (String(scheduleItem.day_of_week || '').toLowerCase() !== todayWeekday.toLowerCase()) {
    return false
  }

  const startIso = combineTodayWithTime(scheduleItem.start_time)
  const endIso = combineTodayWithTime(scheduleItem.end_time)
  const startTime = new Date(startIso)
  const endTime = new Date(endIso)

  return (
    !Number.isNaN(startTime.getTime()) &&
    !Number.isNaN(endTime.getTime()) &&
    now >= startTime &&
    now < endTime
  )
}

function isNextClassToday(scheduleItem, nextClassObj) {
  if (!nextClassObj || !scheduleItem) return false
  return String(scheduleItem.id) === String(nextClassObj.id)
}

function openClassForm(scheduleItem = null) {
  classForm.reset()
  classFields.id.value = scheduleItem?.id ?? ''
  classFormTitle.textContent = scheduleItem ? 'Edit Timetable Entry' : 'Add Timetable Entry'

  if (scheduleItem) {
    const selectedSection = availableSections.find(
      (section) => String(section.id) === String(scheduleItem.section_id),
    )
    classFields.branch.value = selectedSection?.branch || ''
    classFields.semester.value = String(selectedSection?.semester || '1')
    refreshSectionOptions()
    classFields.section.value = String(scheduleItem.section_id || '')
    classFields.batch.value = scheduleItem.batch || ''
    classFields.courseCode.value = scheduleItem.course_code || scheduleItem.subject || ''
    classFields.courseName.value = scheduleItem.course_name || ''
    classFields.faculty.value = scheduleItem.faculty || ''
    classFields.room.value = scheduleItem.room || ''
    classFields.day.value = scheduleItem.day_of_week || selectedDayName
    classFields.type.value = scheduleItem.type || 'class'
    classFields.startTime.value = String(scheduleItem.start_time || '').slice(0, 5)
    classFields.endTime.value = String(scheduleItem.end_time || '').slice(0, 5)
  } else {
    const defaultSection = availableSections[0]
    classFields.branch.value = currentProfile?.branch || defaultSection?.branch || ''
    classFields.semester.value = String(currentProfile?.semester || defaultSection?.semester || '1')
    refreshSectionOptions()
    classFields.section.value = String(currentProfile?.section_id || defaultSection?.id || '')
    classFields.batch.value = currentProfile?.batch || ''
    classFields.day.value = selectedDayName
    classFields.type.value = 'class'
  }

  // Restrict CR from modifying section / branch
  if (currentProfile?.role === 'class_leader') {
    classFields.branch.disabled = true
    classFields.semester.disabled = true
    classFields.section.disabled = true
  } else {
    classFields.branch.disabled = false
    classFields.semester.disabled = false
    classFields.section.disabled = false
  }

  classModal.hidden = false
  document.body.classList.add('modal-open')
  classFields.courseCode.focus()
}

function closeClassForm() {
  classModal.hidden = true
  document.body.classList.remove('modal-open')
}

function getClassPayload() {
  const code = classFields.courseCode.value.trim()
  const name = classFields.courseName.value.trim() || code
  const selectedType = classFields.type.value
  const batchVal = classFields.batch.value.trim() || null

  return {
    course_code: code,
    course_name: name,
    subject: code,
    faculty: classFields.faculty.value.trim() || null,
    room: classFields.room.value.trim() || null,
    day_of_week: classFields.day.value,
    start_time: `${classFields.startTime.value}:00`.slice(0, 8),
    end_time: `${classFields.endTime.value}:00`.slice(0, 8),
    type: selectedType,
    batch: batchVal,
    section_id: classFields.section.value,
  }
}

async function checkDuplicateClass(payload, editingId = null) {
  try {
    let query = window.supabaseClient
      .from('timetable')
      .select('*')
      .eq('section_id', payload.section_id)
      .eq('day_of_week', payload.day_of_week)
      .eq('start_time', payload.start_time)

    if (editingId) {
      query = query.neq('id', editingId)
    }

    const { data, error } = await query
    if (error || !data) return null

    // Check batch overlap
    for (const item of data) {
      const existingBatch = (item.batch || '').trim().toUpperCase()
      const newBatch = (payload.batch || '').trim().toUpperCase()

      // If either is whole section ('ALL' or empty) or identical batch
      if (!existingBatch || !newBatch || existingBatch === 'ALL' || newBatch === 'ALL' || existingBatch === newBatch) {
        return item
      }
    }
    return null
  } catch (err) {
    console.warn('Duplicate check warning:', err)
    return null
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
  scheduleManagementStatus.textContent = 'Checking schedule...'

  // Duplicate prevention check
  const duplicate = await checkDuplicateClass(payload, isEditing ? classId : null)
  if (duplicate) {
    scheduleManagementStatus.textContent = `Conflict: A class (${duplicate.course_code || duplicate.subject || 'Scheduled'}) is already assigned for this section, day, and time.`
    return
  }

  scheduleManagementStatus.textContent = 'Saving timetable entry...'

  try {
    const query = isEditing
      ? window.supabaseClient
        .from('timetable')
        .update(payload)
        .eq('id', classId)
        .select('id')
        .maybeSingle()
      : window.supabaseClient
        .from('timetable')
        .insert(payload)
        .select('id')
        .single()

    let { data, error } = await query

    // Fallback if extended columns are not yet present in Supabase DB
    if (error && (error.code === '42703' || String(error.message || '').includes('course_code') || String(error.message || '').includes('batch'))) {
      const legacyPayload = {
        subject: payload.subject,
        room: payload.room,
        day_of_week: payload.day_of_week,
        start_time: payload.start_time,
        end_time: payload.end_time,
        type: ['break', 'free'].includes(payload.type) ? payload.type : 'class',
        section_id: payload.section_id,
      }
      const retryQuery = isEditing
        ? window.supabaseClient.from('timetable').update(legacyPayload).eq('id', classId).select('id').maybeSingle()
        : window.supabaseClient.from('timetable').insert(legacyPayload).select('id').single()
      const retryRes = await retryQuery
      data = retryRes.data
      error = retryRes.error
    }

    if (error) throw error
    if (!data) throw permissionDeniedError()

    closeClassForm()
    scheduleManagementStatus.textContent = isEditing
      ? 'Timetable entry updated successfully.'
      : 'Timetable entry created successfully.'
    await loadSchedule()
  } catch (error) {
    console.error('Unable to save timetable entry:', error)
    scheduleManagementStatus.textContent = isPermissionError(error)
      ? 'You do not have permission to modify timetable entries for this section.'
      : 'Unable to save the timetable entry. Please try again.'
  }
}

async function deleteClass(scheduleItem) {
  const courseDesc = scheduleItem.course_code || scheduleItem.subject || 'this class'
  const confirmed = window.confirm(`Are you sure you want to delete ${courseDesc} from the timetable?`)
  if (!confirmed) return

  scheduleManagementStatus.textContent = 'Deleting timetable entry...'

  try {
    const { data, error } = await window.supabaseClient
      .from('timetable')
      .delete()
      .eq('id', scheduleItem.id)
      .select('id')
      .maybeSingle()

    if (error) throw error
    if (!data) throw permissionDeniedError()

    scheduleManagementStatus.textContent = 'Timetable entry deleted successfully.'
    await loadSchedule()
  } catch (error) {
    console.error('Unable to delete timetable entry:', error)
    scheduleManagementStatus.textContent = isPermissionError(error)
      ? 'You do not have permission to delete this entry.'
      : 'Unable to delete the timetable entry. Please try again.'
  }
}

function getTypeLabel(type) {
  switch (String(type || '').toLowerCase()) {
    case 'lab':
      return 'Lab'
    case 'tut':
      return 'Tutorial'
    case 'break':
      return 'Break'
    case 'free':
      return 'Free'
    case 'class':
    default:
      return 'Lecture'
  }
}

function createScheduleItem(scheduleItem, nextClassToday = null) {
  const item = document.createElement('article')
  const itemType = ['class', 'lab', 'tut', 'break', 'free'].includes(scheduleItem.type)
    ? scheduleItem.type
    : 'class'
  item.className = `schedule-item schedule-${itemType}`

  const isCurrent = isCurrentClass(scheduleItem)
  const isNext = !isCurrent && isNextClassToday(scheduleItem, nextClassToday)

  if (isCurrent) {
    item.classList.add('current-class')
  }

  // Time column
  const timeCol = document.createElement('div')
  timeCol.className = 'schedule-time'
  timeCol.textContent = String(scheduleItem.start_time || '').slice(0, 5)

  // Timeline mark
  const mark = document.createElement('span')
  mark.className = 'timeline-mark'
  mark.setAttribute('aria-hidden', 'true')

  // Details container
  const details = document.createElement('div')
  details.className = 'schedule-details'

  // Badges container (Status, Type, Batch)
  const badgeContainer = document.createElement('div')
  badgeContainer.className = 'class-badge-container'

  if (isCurrent) {
    const currentBadge = document.createElement('span')
    currentBadge.className = 'class-badge badge-current-status'
    currentBadge.textContent = '● Happening Now'
    badgeContainer.append(currentBadge)
  } else if (isNext) {
    const nextBadge = document.createElement('span')
    nextBadge.className = 'class-badge badge-next-status'
    nextBadge.textContent = '★ Next Class'
    badgeContainer.append(nextBadge)
  }

  const typeBadge = document.createElement('span')
  typeBadge.className = `class-badge badge-${itemType}`
  typeBadge.textContent = getTypeLabel(itemType)
  badgeContainer.append(typeBadge)

  if (scheduleItem.batch) {
    const batchBadge = document.createElement('span')
    batchBadge.className = 'class-badge badge-batch'
    batchBadge.textContent = `Batch ${scheduleItem.batch}`
    badgeContainer.append(batchBadge)
  }

  details.append(badgeContainer)

  // Heading: Course Code & Name
  const heading = document.createElement('h2')
  const courseCode = scheduleItem.course_code || scheduleItem.subject || 'Class'
  const courseName = scheduleItem.course_name && scheduleItem.course_name !== courseCode
    ? ` • ${scheduleItem.course_name}`
    : ''
  heading.textContent = `${courseCode}${courseName}`
  details.append(heading)

  // Meta row: Time range, Room, Faculty, Section
  const meta = document.createElement('div')
  meta.className = 'schedule-meta'

  const timeSpan = document.createElement('span')
  timeSpan.textContent = `🕒 ${formatTimeRange(scheduleItem.start_time, scheduleItem.end_time)}`
  meta.append(timeSpan)

  if (scheduleItem.room) {
    const roomSpan = document.createElement('span')
    roomSpan.textContent = `📍 ${scheduleItem.room}`
    meta.append(roomSpan)
  }

  if (scheduleItem.faculty) {
    const facSpan = document.createElement('span')
    facSpan.textContent = `👤 ${scheduleItem.faculty}`
    meta.append(facSpan)
  }

  // Section label for Professors who teach multiple sections
  if (currentProfile?.role === 'professor') {
    const secObj = availableSections.find((s) => String(s.id) === String(scheduleItem.section_id))
    if (secObj) {
      const secSpan = document.createElement('span')
      secSpan.textContent = `🏷️ ${secObj.branch} Sem ${secObj.semester} (${secObj.name})`
      meta.append(secSpan)
    }
  }

  details.append(meta)

  // Controls for CRs and Professors on sections they manage
  const isManagedSection = availableSections.some((s) => String(s.id) === String(scheduleItem.section_id))
  if (canManageSchedule && isManagedSection && scheduleItem.id != null) {
    const controls = document.createElement('div')
    controls.className = 'schedule-item-controls'

    const editBtn = document.createElement('button')
    editBtn.type = 'button'
    editBtn.textContent = 'Edit'
    editBtn.addEventListener('click', () => openClassForm(scheduleItem))

    const deleteBtn = document.createElement('button')
    deleteBtn.type = 'button'
    deleteBtn.className = 'delete-class-button'
    deleteBtn.textContent = 'Delete'
    deleteBtn.addEventListener('click', () => deleteClass(scheduleItem))

    controls.append(editBtn, deleteBtn)
    details.append(controls)
  }

  item.append(timeCol, mark, details)
  return item
}

function displaySchedule(schedule) {
  scheduleList.replaceChildren()

  if (schedule.length === 0) {
    const message = document.createElement('p')
    message.className = 'schedule-state'
    message.textContent = `No classes scheduled for ${selectedDayName}.`
    scheduleList.append(message)
    return
  }

  const todayWeekday = new Date().toLocaleDateString('en-US', { weekday: 'long' })
  const isTodayView = selectedDayName.toLowerCase() === todayWeekday.toLowerCase()
  const nextClassToday = isTodayView ? findNextClass(fullSchedule) : null

  const orderedSchedule = [...schedule].sort((a, b) => {
    return String(a.start_time || '').localeCompare(String(b.start_time || ''))
  })

  orderedSchedule.forEach((item) => {
    scheduleList.append(createScheduleItem(item, nextClassToday))
  })
}

function findCurrentOrNextClass(todayClasses) {
  const now = new Date()
  const todayWeekday = now.toLocaleDateString('en-US', { weekday: 'long' })

  const validClasses = todayClasses
    .filter((item) => String(item.day_of_week || '').toLowerCase() === todayWeekday.toLowerCase())
    .filter((item) => item.type === 'class' || item.type === 'lab' || item.type === 'tut')
    .map((item) => {
      const start = new Date(combineTodayWithTime(item.start_time))
      const end = new Date(combineTodayWithTime(item.end_time))
      return { ...item, startDate: start, endDate: end }
    })
    .filter((item) => !Number.isNaN(item.startDate.getTime()) && !Number.isNaN(item.endDate.getTime()))
    .sort((a, b) => a.startDate - b.startDate)

  // 1. Current class happening now
  const current = validClasses.find((item) => now >= item.startDate && now < item.endDate)
  if (current) return { classItem: current, isCurrent: true }

  // 2. Next class starting after now
  const next = validClasses.find((item) => item.startDate > now)
  if (next) return { classItem: next, isCurrent: false }

  return null
}

function findNextClass(todayClasses) {
  const result = findCurrentOrNextClass(todayClasses)
  return result?.classItem || null
}

function displayNextClass(todayClasses) {
  nextClassContent.replaceChildren()
  navigationMessage.textContent = ''

  const result = findCurrentOrNextClass(todayClasses)

  if (!result) {
    const message = document.createElement('p')
    message.className = 'next-class-state'
    message.textContent = 'No more classes today! Enjoy your evening.'
    nextClassContent.append(message)
    return
  }

  const { classItem, isCurrent } = result
  const now = new Date()

  // Status indicator
  const statusBadge = document.createElement('span')
  statusBadge.className = 'class-badge ' + (isCurrent ? 'badge-current-status' : 'badge-next-status')
  statusBadge.style.marginBottom = '12px'
  if (isCurrent) {
    statusBadge.textContent = '● Happening Now'
  } else {
    const minutesRemaining = Math.max(1, Math.ceil((classItem.startDate - now) / 60000))
    statusBadge.textContent = `Starts in ${minutesRemaining} ${minutesRemaining === 1 ? 'minute' : 'minutes'}`
  }
  nextClassContent.append(statusBadge)

  // Subject / Course Code & Name
  const heading = document.createElement('h3')
  const code = classItem.course_code || classItem.subject || 'Class'
  const name = classItem.course_name && classItem.course_name !== code ? ` • ${classItem.course_name}` : ''
  heading.textContent = `${code}${name}`

  // Time
  const time = document.createElement('p')
  time.className = 'next-class-time'
  time.textContent = `🕒 ${formatTimeRange(classItem.start_time, classItem.end_time)}`

  // Room
  const room = document.createElement('p')
  room.className = 'next-class-room'
  room.textContent = `📍 ${classItem.room ? classItem.room : 'Venue TBA'}`

  // Faculty
  if (classItem.faculty) {
    const faculty = document.createElement('p')
    faculty.className = 'next-class-room'
    faculty.textContent = `👤 Faculty: ${classItem.faculty}`
    nextClassContent.append(heading, time, room, faculty)
  } else {
    nextClassContent.append(heading, time, room)
  }

  // Navigate Button
  const navigateButton = document.createElement('button')
  navigateButton.className = 'navigate-button'
  navigateButton.type = 'button'
  navigateButton.textContent = 'Navigate to Venue →'
  navigateButton.addEventListener('click', () => {
    navigationMessage.textContent = `Navigating to ${classItem.room || 'venue'} functionality coming soon.`
  })
  nextClassContent.append(navigateButton)
}

function displayScheduleError() {
  scheduleList.replaceChildren()
  nextClassContent.replaceChildren()
  const scheduleMessage = document.createElement('p')
  scheduleMessage.className = 'schedule-state error-state'
  scheduleMessage.textContent = 'Unable to load timetable. Please check your network connection.'
  const nextClassMessage = document.createElement('p')
  nextClassMessage.className = 'next-class-state error-state'
  nextClassMessage.textContent = 'Unable to load next class.'
  scheduleList.append(scheduleMessage)
  nextClassContent.append(nextClassMessage)
}

async function loadSchedule() {
  try {
    if (!currentProfile) {
      currentProfile = await window.CampusAuth.getAuthenticatedUser()
    }

    let query = window.supabaseClient
      .from('timetable')
      .select('*')
      .order('start_time')

    if (currentProfile.role === 'professor') {
      // Professors view assigned sections
      if (availableSections.length > 0) {
        const secIds = availableSections.map((s) => s.id)
        query = query.in('section_id', secIds)
      }
    } else if (currentProfile.section_id != null) {
      // Students and CRs automatically filter to their own section
      query = query.eq('section_id', currentProfile.section_id)
    }

    const { data, error } = await query
    if (error) throw error

    let rawList = data || []

    // If user has a specific batch assigned (e.g. 'B1'), filter batch-specific entries
    if (currentProfile.batch && currentProfile.role !== 'professor') {
      const userBatch = currentProfile.batch.trim().toUpperCase()
      rawList = rawList.filter((item) => {
        if (!item.batch) return true
        const itemBatch = item.batch.trim().toUpperCase()
        return itemBatch === 'ALL' || itemBatch === userBatch
      })
    }

    fullSchedule = rawList

    // Filter by selected day
    const dayFiltered = fullSchedule.filter(
      (item) => String(item.day_of_week || '').toLowerCase() === selectedDayName.toLowerCase(),
    )

    displaySelectedDayHeader()
    displaySchedule(dayFiltered)
    displayNextClass(fullSchedule)
  } catch (error) {
    console.error('Unable to load timetable:', error)
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
      availableSections = (sections || []).filter((section) => assignedIds.has(String(section.id)))
    } else {
      availableSections = (sections || []).filter(
        (section) => String(section.id) === String(currentProfile.section_id),
      )
    }

    const branches = [...new Set(availableSections.map((section) => section.branch))]
    classFields.branch.replaceChildren(new Option('Select branch', '', true, true))
    classFields.branch.options[0].disabled = true
    branches.forEach((branch) => classFields.branch.add(new Option(branch, branch)))
    refreshSectionOptions()
    populatePdfSectionOptions()
  } catch (error) {
    console.error('Unable to load sections:', error)
    scheduleManagementStatus.textContent = 'Unable to load available sections.'
  }
}

function refreshSectionOptions() {
  const previousSection = classFields.section.value
  classFields.section.replaceChildren(new Option('Select section', '', true, true))
  classFields.section.options[0].disabled = true

  const matchingSections = availableSections.filter(
    (section) =>
      section.branch === classFields.branch.value &&
      Number(section.semester) === Number(classFields.semester.value),
  )

  matchingSections.forEach((section) => {
    classFields.section.add(new Option(section.name, section.id))
  })

  if ([...classFields.section.options].some((option) => option.value === previousSection)) {
    classFields.section.value = previousSection
  } else if (matchingSections.length === 1) {
    classFields.section.value = String(matchingSections[0].id)
  }
}

async function loadUserRole() {
  try {
    const user = await window.CampusAuth.getAuthenticatedUser()
    currentProfile = user
    canManageSchedule = window.CampusAuth.canManageContent(user)

    if (scheduleManagementPanel) {
      scheduleManagementPanel.hidden = !canManageSchedule
      if (canManageSchedule && managementSubtitle) {
        if (currentProfile.role === 'class_leader') {
          managementSubtitle.textContent = `Authorized CR for: ${currentProfile.branch || ''} Sem ${currentProfile.semester || ''}`
        } else if (currentProfile.role === 'professor') {
          managementSubtitle.textContent = 'Authorized Faculty: manage assigned departmental sections'
        }
      }
    }

    if (canManageSchedule) {
      await loadSections()
    }
    return true
  } catch (error) {
    console.error('Unable to determine timetable permissions:', error)
    canManageSchedule = false
    if (scheduleManagementPanel) scheduleManagementPanel.hidden = true
    return false
  }
}

function subscribeToTimetableChanges() {
  if (!window.supabaseClient) return null

  return window.supabaseClient
    .channel('schedule-timetable-live')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'timetable' },
      () => {
        loadSchedule()
      },
    )
    .subscribe()
}

// Day Selector Click Listener
if (daySelector) {
  daySelector.addEventListener('click', (event) => {
    const tab = event.target.closest('.day-tab')
    if (!tab) return
    const day = tab.dataset.day
    if (day && WEEKDAYS.includes(day)) {
      selectedDayName = day
      displaySelectedDayHeader()
      const dayFiltered = fullSchedule.filter(
        (item) => String(item.day_of_week || '').toLowerCase() === selectedDayName.toLowerCase(),
      )
      displaySchedule(dayFiltered)
    }
  })
}

// PDF Timetable Management & Extraction Logic
function openPdfModal() {
  if (!canManageSchedule) return
  resetPdfModal()
  populatePdfSectionOptions()
  pdfImportModal.hidden = false
  document.body.classList.add('modal-open')
}

function closePdfModal() {
  pdfImportModal.hidden = true
  document.body.classList.remove('modal-open')
  resetPdfModal()
}

function resetPdfModal() {
  currentPdfFile = null
  parsedPdfClasses = []
  if (pdfFileInput) pdfFileInput.value = ''
  if (pdfSelectedBar) pdfSelectedBar.hidden = true
  if (pdfParseStatus) pdfParseStatus.hidden = true
  if (pdfPreviewSection) pdfPreviewSection.hidden = true
  if (pdfPreviewTableBody) pdfPreviewTableBody.replaceChildren()
  if (pdfImportButton) {
    pdfImportButton.disabled = true
    pdfImportButton.textContent = 'Import Classes'
  }
  if (pdfImportMessage) {
    pdfImportMessage.textContent = ''
    pdfImportMessage.className = 'pdf-import-message'
  }
  if (pdfDropzone) {
    pdfDropzone.hidden = false
    pdfDropzone.classList.remove('dragover')
  }
}

function populatePdfSectionOptions() {
  if (!pdfBranch || !pdfSemester || !pdfSection) return
  if (!availableSections || availableSections.length === 0) return

  const branches = [...new Set(availableSections.map((section) => section.branch))]
  pdfBranch.replaceChildren(new Option('Select branch', '', true, true))
  pdfBranch.options[0].disabled = true
  branches.forEach((b) => pdfBranch.add(new Option(b, b)))

  const defaultSection = availableSections[0]
  pdfBranch.value = currentProfile?.branch || defaultSection?.branch || ''
  pdfSemester.value = String(currentProfile?.semester || defaultSection?.semester || '1')
  refreshPdfSectionOptions()
  pdfSection.value = String(currentProfile?.section_id || defaultSection?.id || '')

  if (currentProfile?.role === 'class_leader') {
    pdfBranch.disabled = true
    pdfSemester.disabled = true
    pdfSection.disabled = true
  } else {
    pdfBranch.disabled = false
    pdfSemester.disabled = false
    pdfSection.disabled = false
  }
}

function refreshPdfSectionOptions() {
  if (!pdfSection || !pdfBranch || !pdfSemester) return
  const previousSection = pdfSection.value
  pdfSection.replaceChildren(new Option('Select section', '', true, true))
  pdfSection.options[0].disabled = true

  const matchingSections = availableSections.filter(
    (section) =>
      section.branch === pdfBranch.value &&
      Number(section.semester) === Number(pdfSemester.value),
  )

  matchingSections.forEach((section) => {
    pdfSection.add(new Option(section.name, section.id))
  })

  if ([...pdfSection.options].some((option) => option.value === previousSection)) {
    pdfSection.value = previousSection
  } else if (matchingSections.length === 1) {
    pdfSection.value = String(matchingSections[0].id)
  }
}

const DAY_MAP = {
  monday: 'Monday',
  mon: 'Monday',
  tuesday: 'Tuesday',
  tue: 'Tuesday',
  tues: 'Tuesday',
  wednesday: 'Wednesday',
  wed: 'Wednesday',
  thursday: 'Thursday',
  thu: 'Thursday',
  thur: 'Thursday',
  thurs: 'Thursday',
  friday: 'Friday',
  fri: 'Friday',
  saturday: 'Saturday',
  sat: 'Saturday',
}

function normalizeDay(str) {
  if (!str) return null
  const clean = str.trim().toLowerCase()
  if (DAY_MAP[clean]) return DAY_MAP[clean]
  const match = clean.match(/\b(monday|mon|tuesday|tue|tues|wednesday|wed|thursday|thu|thur|thurs|friday|fri|saturday|sat)\b/i)
  if (match) {
    const key = match[1].toLowerCase()
    return DAY_MAP[key] || null
  }
  return null
}

function normalizeTimeTo24h(timeStr, isEnd = false) {
  if (!timeStr) return isEnd ? '10:55:00' : '10:00:00'
  let raw = timeStr.trim().toLowerCase().replace('.', ':')
  const isPm = raw.includes('pm')
  const isAm = raw.includes('am')
  raw = raw.replace(/[^\d:]/g, '')

  let [hStr, mStr] = raw.split(':')
  let hours = parseInt(hStr, 10)
  let minutes = mStr != null && mStr !== '' ? parseInt(mStr, 10) : 0

  if (Number.isNaN(hours)) return isEnd ? '10:55:00' : '10:00:00'
  if (Number.isNaN(minutes)) minutes = 0

  if (isPm && hours < 12) hours += 12
  if (isAm && hours === 12) hours = 0

  // College convention when AM/PM is omitted:
  // Times 1..7 are PM (13:00 to 19:00)
  // Times 8..12 are AM (08:00 to 12:00)
  if (!isAm && !isPm) {
    if (hours >= 1 && hours <= 7) {
      hours += 12
    }
  }

  const hh = String(hours).padStart(2, '0')
  const mm = String(minutes).padStart(2, '0')
  return `${hh}:${mm}:00`
}

function parseTimeRangeString(text) {
  const match = text.match(
    /\b(\d{1,2}(?:[:.]\d{2})?\s*(?:am|pm)?)\s*(?:-|–|to)\s*(\d{1,2}(?:[:.]\d{2})?\s*(?:am|pm)?)\b/i,
  )
  if (!match) return null

  let start = normalizeTimeTo24h(match[1], false)
  let end = normalizeTimeTo24h(match[2], true)

  if (end <= start) {
    const startHour = parseInt(start.slice(0, 2), 10)
    let endHour = parseInt(end.slice(0, 2), 10)
    if (endHour < startHour && endHour + 12 < 24) {
      end = `${String(endHour + 12).padStart(2, '0')}${end.slice(2)}`
    }
  }

  return { startTime: start, endTime: end }
}

const COURSE_CODE_REGEX = /\b([A-Z]{2,4}\s*[-]?\s*\d[A-Z0-9]{2,4}[A-Za-z]?|[A-Z]{2,4}\s*[-]?\s*\d{3,4}[A-Za-z]?|OE\s*[-]?\s*\d?)\b/i
const ROOM_REGEX = /\b(L\s*-?\s*\d{3}|CR\s*-?\s*\d{3}|CC\s*[-]?\s*[A-Za-z0-9]+|LAB(?:\s*\d+)?|AUDI(?:TORIUM)?|HALL\s*[A-Z0-9]*|[A-Z]\d{3})\b/i
const BATCH_REGEX = /\b([A-E][1-2]|Batch\s*[A-Z0-9]+|Group\s*[A-Z0-9]+|\([A-E][1-2]\))\b/i
const FACULTY_TITLE_REGEX = /(?:Dr\.|Prof\.|Mr\.|Ms\.)\s+[A-Za-z]+(?:\s+[A-Za-z]+)*/i

function parseClassSegment(cleaned, fallbackDay = 'Monday', fallbackTime = null) {
  if (!cleaned || cleaned.length < 2) return null
  cleaned = cleaned.trim()

  // Handle Open Elective entries (e.g. "OE1:", "OE3", "Open Elective")
  if (/^OE\s*\d*:?/i.test(cleaned) || /open\s*elective/i.test(cleaned)) {
    const m = cleaned.match(/^(OE\s*\d*)/i)
    const code = m ? m[1].toUpperCase().replace(/\s+/g, '') : 'OE1'
    return {
      selected: true,
      day: fallbackDay,
      start_time: fallbackTime?.startTime || '12:00:00',
      end_time: fallbackTime?.endTime || '12:55:00',
      course_code: code,
      course_name: `Open Elective (${code})`,
      faculty: 'Multiple Faculty',
      room: 'Elective Halls',
      batch: '',
      type: 'class',
    }
  }

  // Extract Course Code
  const codeMatch = cleaned.match(COURSE_CODE_REGEX)
  let courseCode = codeMatch ? codeMatch[1].replace(/\s+/g, '') : null

  let courseName = courseCode || ''
  let classType = 'class'

  if (!courseCode) {
    if (/lunch|break/i.test(cleaned)) {
      return null
    }
    const altCode = cleaned.match(/\b([A-Z]{2,6})\b/)
    if (altCode && !['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'TIME', 'ROOM', 'SLOT', 'LAB', 'DAY'].includes(altCode[1])) {
      courseCode = altCode[1]
    } else {
      return null
    }
  }

  // Type determination
  if (
    /lab|practical/i.test(cleaned) ||
    (courseCode && courseCode.endsWith('L') && courseCode.length >= 4)
  ) {
    classType = 'lab'
  } else if (/tut|tutorial|-t-/i.test(cleaned) || /t\//i.test(cleaned)) {
    classType = 'tut'
  }

  // Room
  let room = null
  const roomMatch = cleaned.match(ROOM_REGEX)
  if (roomMatch) {
    room = roomMatch[1].replace(/\s+/g, '').toUpperCase()
  } else if (classType === 'lab') {
    room = 'Lab'
  }

  // Batch
  let batch = null
  const batchMatch = cleaned.match(BATCH_REGEX)
  if (batchMatch) {
    batch = batchMatch[1].replace(/[()]/g, '').replace(/batch\s*/i, '').replace(/group\s*/i, '').trim().toUpperCase()
  }

  // Faculty
  let faculty = null
  const facTitleMatch = cleaned.match(FACULTY_TITLE_REGEX)
  if (facTitleMatch) {
    faculty = facTitleMatch[0].trim()
  } else {
    // Strip out the course code or its prefix from text to isolate faculty initials
    const textWithoutCode = cleaned.replace(new RegExp(`^${courseCode}\\b`, 'i'), '').replace(/^[A-Z]{2,4}\s+\d+\b/i, '')
    const words = textWithoutCode.split(/[\s,;()/:–-]+/)
    for (const w of words) {
      const up = w.toUpperCase()
      if (
        /^[A-Z]{2,4}$/.test(up) &&
        up !== courseCode &&
        up !== (room || '') &&
        up !== (batch || '') &&
        !['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'LAB', 'TUT', 'LEC', 'SEC', 'SEM', 'ALL', 'DAY'].includes(up)
      ) {
        faculty = up
        break
      }
    }
  }

  // Day check
  let day = fallbackDay
  const fullDayMatch = cleaned.match(/\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)\b/i)
  if (fullDayMatch) {
    day = DAY_MAP[fullDayMatch[1].toLowerCase()] || day
  } else if (!fallbackDay || fallbackDay === 'Monday') {
    const shortDayMatch = cleaned.match(/\b(mon|tue|tues|wed|thu|thur|thurs|fri|sat)\b/i)
    if (shortDayMatch) {
      day = DAY_MAP[shortDayMatch[1].toLowerCase()] || day
    }
  }

  // Time check
  let startTime = fallbackTime?.startTime || '10:00:00'
  let endTime = fallbackTime?.endTime || '10:55:00'
  const timeRes = parseTimeRangeString(cleaned)
  if (timeRes) {
    startTime = timeRes.startTime
    endTime = timeRes.endTime
  }

  return {
    selected: true,
    day,
    start_time: startTime,
    end_time: endTime,
    course_code: courseCode,
    course_name: courseName || courseCode,
    faculty: faculty || '',
    room: room || '',
    batch: batch || '',
    type: classType,
  }
}

function parseClassText(text, fallbackDay = 'Monday', fallbackTime = null) {
  if (!text || typeof text !== 'string') return []
  const rawTrimmed = text.trim()
  if (rawTrimmed.length < 3) return []

  // Skip table header keywords and days/breaks
  if (/^(timetable|schedule|time\s*table|sem|semester|mon|tue|wed|thu|fri|sat|day|monday|tuesday|wednesday|thursday|friday|saturday|break|lunch)$/i.test(rawTrimmed)) {
    return []
  }

  // Handle multiline cell entries (e.g. multiple courses / electives separated by newlines)
  if (text.includes('\n')) {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 2)
    if (lines.length > 1) {
      const multiResults = []
      for (const line of lines) {
        const subItems = parseClassText(line, fallbackDay, fallbackTime)
        multiResults.push(...subItems)
      }
      if (multiResults.length > 0) return multiResults
    }
  }

  const cleaned = text.replace(/\s+/g, ' ').trim()

  // If multiple batches or subjects separated by "/" or ";"
  if (cleaned.includes('/') || cleaned.includes(';')) {
    const parts = cleaned.split(/[/;]+/).map((s) => s.trim()).filter((s) => s.length > 2)
    const results = []
    for (const part of parts) {
      const item = parseClassSegment(part, fallbackDay, fallbackTime)
      if (item) results.push(item)
    }
    if (results.length > 0) return results
  }

  const singleItem = parseClassSegment(cleaned, fallbackDay, fallbackTime)
  return singleItem ? [singleItem] : []
}

function extractClassesFromPage(textContent, pageNum = 1) {
  const items = (textContent.items || []).filter((it) => it.str && it.str.trim().length > 0)
  if (items.length === 0) return []

  const Y_TOLERANCE = 5
  // Group into visual lines
  const sortedItems = [...items].sort((a, b) => {
    const diffY = b.transform[5] - a.transform[5]
    if (Math.abs(diffY) > Y_TOLERANCE) return diffY
    return a.transform[4] - b.transform[4]
  })

  const rows = []
  let currentRow = []
  let currentY = null

  for (const it of sortedItems) {
    const itY = it.transform[5]
    if (currentY === null || Math.abs(itY - currentY) <= Y_TOLERANCE) {
      currentRow.push(it)
      currentY = itY
    } else {
      currentRow.sort((a, b) => a.transform[4] - b.transform[4])
      rows.push({ y: currentY, items: currentRow })
      currentRow = [it]
      currentY = itY
    }
  }
  if (currentRow.length > 0) {
    currentRow.sort((a, b) => a.transform[4] - b.transform[4])
    rows.push({ y: currentY, items: currentRow })
  }

  const extracted = []

  // Step 1: Detect Grid Structure
  // Look for Time Slot headers (e.g. 9:00 - 9:55)
  const timeSlots = []
  for (const item of items) {
    const timeRes = parseTimeRangeString(item.str)
    if (timeRes) {
      timeSlots.push({
        x: item.transform[4],
        y: item.transform[5],
        width: item.width || 50,
        startTime: timeRes.startTime,
        endTime: timeRes.endTime,
      })
    }
  }

  // Look for Day headers (Monday .. Saturday)
  const dayHeaders = []
  for (const item of items) {
    const day = normalizeDay(item.str)
    if (day) {
      dayHeaders.push({
        x: item.transform[4],
        y: item.transform[5],
        day,
      })
    }
  }

  // Check if we have grid layout with Day rows/cols and Time cols/rows
  const distinctDays = [...new Map(dayHeaders.map((d) => [d.day, d])).values()]
  const distinctTimeSlots = []
  timeSlots.forEach((ts) => {
    if (!distinctTimeSlots.some((existing) => Math.abs(existing.x - ts.x) < 25 && Math.abs(existing.y - ts.y) < 25)) {
      distinctTimeSlots.push(ts)
    }
  })

  let gridParsed = false
  if (distinctDays.length >= 2 && distinctTimeSlots.length >= 2) {
    const xVals = distinctDays.map((d) => d.x)
    const yVals = distinctDays.map((d) => d.y)
    const xSpan = Math.max(...xVals) - Math.min(...xVals)
    const ySpan = Math.max(...yVals) - Math.min(...yVals)
    const daysAreColumns = xSpan > ySpan

    gridParsed = true
    if (daysAreColumns) {
      // Days are columns along the top, Time slots are rows along the side
      distinctDays.sort((a, b) => a.x - b.x)
      distinctTimeSlots.sort((a, b) => b.y - a.y) // Top to bottom

      for (let dIdx = 0; dIdx < distinctDays.length; dIdx++) {
        const d = distinctDays[dIdx]
        const prevDayX = dIdx > 0 ? distinctDays[dIdx - 1].x : d.x - 40
        const nextDayX = dIdx < distinctDays.length - 1 ? distinctDays[dIdx + 1].x : d.x + 80
        const minX = (prevDayX + d.x) / 2
        const maxX = (d.x + nextDayX) / 2

        for (let tIdx = 0; tIdx < distinctTimeSlots.length; tIdx++) {
          const ts = distinctTimeSlots[tIdx]
          const prevSlotY = tIdx > 0 ? distinctTimeSlots[tIdx - 1].y : ts.y + 40
          const nextSlotY = tIdx < distinctTimeSlots.length - 1 ? distinctTimeSlots[tIdx + 1].y : ts.y - 40
          const minY = (ts.y + nextSlotY) / 2
          const maxY = (prevSlotY + ts.y) / 2

          const cellItems = items.filter(
            (it) => it.transform[4] >= minX && it.transform[4] < maxX && it.transform[5] >= minY && it.transform[5] < maxY,
          )

          if (cellItems.length > 0) {
            cellItems.sort((a, b) => {
              const diffY = b.transform[5] - a.transform[5]
              if (Math.abs(diffY) > 3) return diffY
              return a.transform[4] - b.transform[4]
            })
            const cellText = cellItems.map((it) => it.str).join(' ').trim()
            const parsed = parseClassText(cellText, d.day, { startTime: ts.startTime, endTime: ts.endTime })
            extracted.push(...parsed)
          }
        }
      }
    } else {
      // Days are rows (top to bottom), Time slots are columns (left to right)
      distinctTimeSlots.sort((a, b) => a.x - b.x)
      distinctDays.sort((a, b) => b.y - a.y) // Top to bottom

      for (let dIdx = 0; dIdx < distinctDays.length; dIdx++) {
        const d = distinctDays[dIdx]
        const prevDayY = dIdx > 0 ? distinctDays[dIdx - 1].y : d.y + 40
        const nextDayY = dIdx < distinctDays.length - 1 ? distinctDays[dIdx + 1].y : d.y - 40
        const minY = (d.y + nextDayY) / 2
        const maxY = (prevDayY + d.y) / 2

        for (let tIdx = 0; tIdx < distinctTimeSlots.length; tIdx++) {
          const ts = distinctTimeSlots[tIdx]
          const prevSlotX = tIdx > 0 ? distinctTimeSlots[tIdx - 1].x : ts.x - 30
          const nextSlotX = tIdx < distinctTimeSlots.length - 1 ? distinctTimeSlots[tIdx + 1].x : ts.x + 80
          const minX = (prevSlotX + ts.x) / 2
          const maxX = (ts.x + nextSlotX) / 2

          // Find items in cell
          const cellItems = items.filter(
            (it) => it.transform[4] >= minX && it.transform[4] < maxX && it.transform[5] >= minY && it.transform[5] < maxY,
          )

          if (cellItems.length > 0) {
            cellItems.sort((a, b) => {
              const diffY = b.transform[5] - a.transform[5]
              if (Math.abs(diffY) > 3) return diffY
              return a.transform[4] - b.transform[4]
            })
            const cellText = cellItems.map((it) => it.str).join(' ').trim()
            const parsed = parseClassText(cellText, d.day, { startTime: ts.startTime, endTime: ts.endTime })
            extracted.push(...parsed)
          }
        }
      }
    }
  }

  if (gridParsed && extracted.length > 0) {
    return extracted
  }

  // Step 2: Line-by-Line / Block Parser (works for tabular and list timetables or non-grid blocks)
  let activeDay = 'Monday'
  for (const row of rows) {
    let lineText = ''
    let prevX = null
    for (const it of row.items) {
      if (prevX !== null && it.transform[4] - prevX > 3) {
        lineText += ' '
      }
      lineText += it.str
      prevX = it.transform[4] + (it.width || 0)
    }
    lineText = lineText.trim()

    // Check if line is a Day header
    const detectedDay = normalizeDay(lineText)
    if (detectedDay) {
      activeDay = detectedDay
      continue
    }

    // Check for Day at the start of line (e.g. "Monday 10:00 - 10:55 ...")
    for (const [k, v] of Object.entries(DAY_MAP)) {
      const reg = new RegExp(`^${k}\\b`, 'i')
      if (reg.test(lineText)) {
        activeDay = v
        break
      }
    }

    // If line has a time range and course/faculty/room
    const timeMatch = parseTimeRangeString(lineText)
    if (timeMatch && (COURSE_CODE_REGEX.test(lineText) || ROOM_REGEX.test(lineText))) {
      const parsedList = parseClassText(lineText, activeDay, timeMatch)
      extracted.push(...parsedList)
    }
  }

  return extracted
}

function deduplicateParsedClasses(classList) {
  const seen = new Set()
  const unique = []

  for (const item of classList) {
    if (!item.course_code || !item.day || !item.start_time) continue
    const key = `${item.day}_${item.start_time}_${item.course_code}_${item.batch || 'ALL'}`
    if (!seen.has(key)) {
      seen.add(key)
      unique.push(item)
    }
  }

  unique.sort((a, b) => {
    const dayDiff = WEEKDAYS.indexOf(a.day) - WEEKDAYS.indexOf(b.day)
    if (dayDiff !== 0) return dayDiff
    return a.start_time.localeCompare(b.start_time)
  })

  return unique
}

async function parsePdfFile(file) {
  currentPdfFile = file
  pdfParseStatus.hidden = false
  pdfParseStatusText.textContent = 'Reading PDF file...'
  pdfPreviewSection.hidden = true
  pdfImportButton.disabled = true
  pdfImportMessage.textContent = ''
  pdfImportMessage.className = 'pdf-import-message'

  try {
    const arrayBuffer = await file.arrayBuffer()
    if (!window.pdfjsLib) {
      throw new Error('PDF.js library is not available. Please check your network connection.')
    }

    pdfParseStatusText.textContent = 'Parsing timetable document...'
    const loadingTask = window.pdfjsLib.getDocument({ data: arrayBuffer })
    const pdfDoc = await loadingTask.promise

    const numPages = pdfDoc.numPages
    let allExtracted = []

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      pdfParseStatusText.textContent = `Analyzing page ${pageNum} of ${numPages}...`
      const page = await pdfDoc.getPage(pageNum)
      const textContent = await page.getTextContent()
      const pageClasses = extractClassesFromPage(textContent, pageNum)
      allExtracted.push(...pageClasses)
    }

    pdfParseStatus.hidden = true

    if (allExtracted.length === 0) {
      pdfImportMessage.className = 'pdf-import-message error'
      pdfImportMessage.textContent =
        'No class entries could be automatically detected from this PDF. You can add entries below or use "+ Add Single Class".'
      parsedPdfClasses = [createEmptyClassRow()]
      renderPdfPreviewTable(parsedPdfClasses)
      pdfPreviewSection.hidden = false
      return
    }

    parsedPdfClasses = deduplicateParsedClasses(allExtracted)
    renderPdfPreviewTable(parsedPdfClasses)
    pdfPreviewSection.hidden = false
    pdfImportButton.disabled = false
    pdfImportMessage.className = 'pdf-import-message success'
    pdfImportMessage.textContent = `Successfully extracted ${parsedPdfClasses.length} timetable entries. Review and click "Import Classes".`
  } catch (error) {
    console.error('PDF parsing error:', error)
    pdfParseStatus.hidden = true
    pdfImportMessage.className = 'pdf-import-message error'
    pdfImportMessage.textContent = `Error reading PDF: ${error.message || 'Unable to parse document.'}`
  }
}

const ROMAN_TO_NUM = {
  i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8,
  1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8,
}

function extractClassesFromExcelSheet(sheet, targetScope, defaultDay = null) {
  if (typeof window.XLSX === 'undefined') return []
  const data = window.XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
  if (!data || data.length === 0) return []

  // Build merge map: map `${r},${c}` -> { endR, endC }
  const merges = {}
  if (sheet['!merges']) {
    sheet['!merges'].forEach((m) => {
      merges[`${m.s.r},${m.s.c}`] = { endR: m.e.r, endC: m.e.c }
    })
  }

  // Strategy 1: Check for Tabular / List headers (e.g. Day, Time, Course Code, Subject, Room, Faculty...)
  const headerRowIdx = data.findIndex((row) =>
    Array.isArray(row) &&
    row.some((cell) => /(?:course\s*code|subject|time|start\s*time|day\s*of\s*week)/i.test(String(cell || '')))
  )

  if (headerRowIdx !== -1 && headerRowIdx < 5) {
    const headers = data[headerRowIdx].map((h) => String(h || '').trim().toLowerCase())
    const dayCol = headers.findIndex((h) => /day/i.test(h))
    const timeCol = headers.findIndex((h) => /^(time|slot|time\s*range)$/i.test(h))
    const startCol = headers.findIndex((h) => /start\s*time/i.test(h))
    const endCol = headers.findIndex((h) => /end\s*time/i.test(h))
    const codeCol = headers.findIndex((h) => /course\s*code|subject|code/i.test(h))
    const nameCol = headers.findIndex((h) => /course\s*name|title|name/i.test(h))
    const roomCol = headers.findIndex((h) => /room|venue|hall/i.test(h))
    const facCol = headers.findIndex((h) => /faculty|instructor|teacher|prof/i.test(h))
    const batchCol = headers.findIndex((h) => /batch|group/i.test(h))
    const typeCol = headers.findIndex((h) => /type/i.test(h))

    if (codeCol !== -1 && (timeCol !== -1 || startCol !== -1)) {
      const listClasses = []
      let lastDay = defaultDay || 'Monday'
      for (let r = headerRowIdx + 1; r < data.length; r++) {
        const row = data[r]
        if (!row || row.length === 0) continue

        const rawDay = dayCol !== -1 ? String(row[dayCol] || '').trim() : ''
        const day = normalizeDay(rawDay) || lastDay
        if (normalizeDay(rawDay)) lastDay = day

        let sTime = '10:00:00'
        let eTime = '10:55:00'

        if (timeCol !== -1) {
          const tRange = parseTimeRangeString(String(row[timeCol] || ''))
          if (tRange) {
            sTime = tRange.startTime
            eTime = tRange.endTime
          }
        } else if (startCol !== -1) {
          sTime = normalizeTimeTo24h(String(row[startCol] || ''), false)
          eTime = endCol !== -1 ? normalizeTimeTo24h(String(row[endCol] || ''), true) : '10:55:00'
        }

        const rawCode = String(row[codeCol] || '').trim()
        if (!rawCode) continue

        const parsedEntries = parseClassText(
          rawCode,
          day,
          { startTime: sTime, endTime: eTime }
        )

        for (const item of parsedEntries) {
          if (nameCol !== -1 && row[nameCol]) item.course_name = String(row[nameCol]).trim()
          if (roomCol !== -1 && row[roomCol]) item.room = String(row[roomCol]).trim()
          if (facCol !== -1 && row[facCol]) item.faculty = String(row[facCol]).trim()
          if (batchCol !== -1 && row[batchCol]) item.batch = String(row[batchCol]).trim().toUpperCase()
          if (typeCol !== -1 && row[typeCol]) {
            const tVal = String(row[typeCol]).toLowerCase()
            if (tVal.includes('lab')) item.type = 'lab'
            else if (tVal.includes('tut')) item.type = 'tut'
            else item.type = 'class'
          }
          listClasses.push(item)
        }
      }
      if (listClasses.length > 0) {
        return listClasses
      }
    }
  }

  // Strategy 2: Grid Timetable Layout (e.g. official_timetable.xlsx)
  let timeRowIdx = -1
  const timeCols = {} // colIdx -> { startTime, endTime, raw }

  for (let r = 0; r < Math.min(data.length, 15); r++) {
    const row = data[r]
    if (!Array.isArray(row)) continue
    let foundRanges = 0
    const rowTimeCols = {}

    row.forEach((cell, cIdx) => {
      const cellStr = String(cell || '').trim()
      const tMatch = parseTimeRangeString(cellStr)
      if (tMatch) {
        foundRanges++
        rowTimeCols[cIdx] = {
          startTime: tMatch.startTime,
          endTime: tMatch.endTime,
          raw: cellStr,
        }
      }
    })

    if (foundRanges >= 3) {
      timeRowIdx = r
      Object.assign(timeCols, rowTimeCols)
      break
    }
  }

  if (timeRowIdx === -1 || Object.keys(timeCols).length === 0) {
    return []
  }

  // Pre-scan for initial day before or at timeRowIdx (e.g. Row 2 in official_timetable.xlsx has "Monday")
  let currentDay = defaultDay || null
  for (let r = 0; r <= timeRowIdx; r++) {
    const row = data[r]
    if (!Array.isArray(row)) continue
    for (let c = 0; c < Math.min(row.length, 5); c++) {
      const cellVal = String(row[c] || '').trim()
      if (!cellVal || cellVal.includes(':') || cellVal.includes('-')) continue
      const d = normalizeDay(cellVal)
      if (d) {
        currentDay = d
        break
      }
    }
    if (currentDay) break
  }
  if (!currentDay) currentDay = 'Monday'

  let dayIdx = WEEKDAYS.indexOf(currentDay) >= 0 ? WEEKDAYS.indexOf(currentDay) : 0
  let currentSem = null
  let currentBranch = null
  let branchRowCount = 0
  const gridClasses = []
  const allGridClasses = []

  for (let r = timeRowIdx + 1; r < data.length; r++) {
    const row = data[r]
    if (!Array.isArray(row) || row.length === 0) continue

    // Check if this row is a repeated Time Header row (e.g. rows 50, 97, 144, 191, 239)
    let foundTimeRanges = 0
    const rowTimeCols = {}
    row.forEach((cell, cIdx) => {
      const cellStr = String(cell || '').trim()
      const tMatch = parseTimeRangeString(cellStr)
      if (tMatch) {
        foundTimeRanges++
        rowTimeCols[cIdx] = {
          startTime: tMatch.startTime,
          endTime: tMatch.endTime,
          raw: cellStr,
        }
      }
    })

    const isTimeHeader = foundTimeRanges >= 3 || (row[0] && String(row[0]).toLowerCase().includes('time/day'))
    if (isTimeHeader) {
      if (foundTimeRanges >= 3) {
        Object.assign(timeCols, rowTimeCols)
      }
      // Check if this row explicitly names a day
      let dayOnRow = null
      for (let c = 0; c < Math.min(row.length, 4); c++) {
        const cellVal = String(row[c] || '').trim()
        if (!cellVal || cellVal.includes(':') || cellVal.includes('-')) continue
        const d = normalizeDay(cellVal)
        if (d) { dayOnRow = d; break; }
      }
      if (dayOnRow) {
        currentDay = dayOnRow
        dayIdx = WEEKDAYS.indexOf(dayOnRow) >= 0 ? WEEKDAYS.indexOf(dayOnRow) : dayIdx
      } else {
        // Advance to next weekday in sequence
        dayIdx = (dayIdx + 1) % WEEKDAYS.length
        currentDay = WEEKDAYS[dayIdx]
      }
      currentSem = null
      currentBranch = null
      branchRowCount = 0
      continue
    }

    // Check if this row announces a Day (e.g. "Monday", "Tuesday")
    let explicitDay = null
    for (let c = 0; c < Math.min(row.length, 4); c++) {
      const cellVal = String(row[c] || '').trim()
      if (!cellVal || cellVal.includes(':') || cellVal.includes('-')) continue
      const detectedDay = normalizeDay(cellVal)
      if (detectedDay) {
        explicitDay = detectedDay
        break
      }
    }
    if (explicitDay) {
      currentDay = explicitDay
      dayIdx = WEEKDAYS.indexOf(explicitDay) >= 0 ? WEEKDAYS.indexOf(explicitDay) : dayIdx
      currentSem = null
      currentBranch = null
      branchRowCount = 0
      continue
    }

    // Check if this row announces a Semester (e.g. "I Sem", "Sem 3", "III Sem")
    let semFound = null
    for (let c = 0; c < Math.min(row.length, 4); c++) {
      const cellVal = String(row[c] || '').trim()
      const semMatch = cellVal.match(/\b([IVX]+|\d+)\s*sem\b/i)
      if (semMatch) {
        const num = ROMAN_TO_NUM[semMatch[1].toLowerCase()]
        if (num) {
          semFound = num
          break
        }
      }
    }
    if (semFound) {
      currentSem = semFound
      currentBranch = null
      branchRowCount = 0
      continue
    }

    const col0 = String(row[0] || '').trim().toUpperCase()
    const col1 = String(row[1] || '').trim().toUpperCase()

    if (['CSE', 'ECE', 'ME', 'MECH', 'DS', 'SM'].includes(col0)) {
      currentBranch = col0 === 'ME' ? 'MECH' : col0
      branchRowCount = 1
    } else if (['CSE', 'ECE', 'ME', 'MECH', 'DS', 'SM'].includes(col1)) {
      currentBranch = col1 === 'ME' ? 'MECH' : col1
      branchRowCount = 1
    } else if (currentBranch) {
      const hasTimeCells = Object.keys(timeCols).some((c) => {
        const val = String(row[Number(c)] || '').trim()
        return val && val !== '_' && val !== '-' && !/^(break|lunch)$/i.test(val)
      })
      if (hasTimeCells) {
        branchRowCount++
      }
    }

    let sec = col1
    if (!sec && ['A', 'B', 'C', 'D1', 'D2', 'E1', 'E2', 'D', 'E'].includes(col0)) {
      sec = col0
    }
    // Positional section inference when col B ('Group') is omitted
    if (!sec && currentBranch) {
      if (currentBranch === 'CSE') {
        sec = branchRowCount === 1 ? 'A' : 'B'
      } else if (currentBranch === 'ECE') {
        sec = 'C'
      } else if (currentBranch === 'MECH') {
        sec = branchRowCount === 1 ? 'D1' : 'D2'
      } else if (currentBranch === 'DS') {
        sec = branchRowCount === 1 ? 'E1' : 'E2'
      }
    }

    const rowBranch = currentBranch
    const rowSem = currentSem
    const rowSec = sec

    const matchesScope =
      targetScope &&
      targetScope.branch &&
      rowBranch &&
      (rowBranch === targetScope.branch ||
        (targetScope.branch === 'MECH' && rowBranch === 'ME') ||
        (targetScope.branch === 'ME' && rowBranch === 'MECH')) &&
      (!targetScope.semester || Number(rowSem) === Number(targetScope.semester)) &&
      (!targetScope.sectionName || rowSec === targetScope.sectionName)

    for (const [colIdxStr, tInfo] of Object.entries(timeCols)) {
      const c = Number(colIdxStr)
      const cellStr = String(row[c] || '').trim()
      if (!cellStr || cellStr === '_' || cellStr === '-' || /^(break|lunch)$/i.test(cellStr)) {
        continue
      }

      let finalEndTime = tInfo.endTime
      const mergeKey = `${r},${c}`
      if (merges[mergeKey]) {
        const endC = merges[mergeKey].endC
        if (timeCols[endC]) {
          finalEndTime = timeCols[endC].endTime
        }
      }

      const parsedItems = parseClassText(
        cellStr,
        currentDay || 'Monday',
        { startTime: tInfo.startTime, endTime: finalEndTime }
      )

      if (parsedItems && parsedItems.length > 0) {
        if (matchesScope) {
          gridClasses.push(...parsedItems)
        }
        allGridClasses.push(...parsedItems)
      }
    }
  }

  if (gridClasses.length > 0) {
    return gridClasses
  }

  return allGridClasses
}

async function parseExcelFile(file) {
  currentPdfFile = file
  pdfParseStatus.hidden = false
  pdfParseStatusText.textContent = 'Reading Excel file...'
  pdfPreviewSection.hidden = true
  pdfImportButton.disabled = true
  pdfImportMessage.textContent = ''
  pdfImportMessage.className = 'pdf-import-message'

  try {
    const arrayBuffer = await file.arrayBuffer()
    if (typeof window.XLSX === 'undefined') {
      throw new Error('Excel parsing library (SheetJS) is not loaded. Please check your network connection.')
    }

    pdfParseStatusText.textContent = 'Parsing workbook sheets...'
    const workbook = window.XLSX.read(arrayBuffer, { type: 'array' })

    const targetSectionId = pdfSection.value
    const selectedSec = availableSections.find((s) => String(s.id) === String(targetSectionId))

    const targetScope = {
      branch: (selectedSec?.branch || currentProfile?.branch || '').toUpperCase(),
      semester: Number(selectedSec?.semester || currentProfile?.semester || 1),
      sectionName: (selectedSec?.name || '').toUpperCase(),
    }

    let allExtracted = []
    for (const sheetName of workbook.SheetNames) {
      pdfParseStatusText.textContent = `Extracting classes from sheet "${sheetName}"...`
      const sheet = workbook.Sheets[sheetName]
      if (!sheet) continue
      const sheetDay = normalizeDay(sheetName)
      const sheetClasses = extractClassesFromExcelSheet(sheet, targetScope, sheetDay)
      allExtracted.push(...sheetClasses)
    }

    pdfParseStatus.hidden = true

    if (allExtracted.length === 0) {
      pdfImportMessage.className = 'pdf-import-message error'
      pdfImportMessage.textContent =
        'No matching classes could be automatically extracted from this spreadsheet. You can add entries below or use "+ Add Single Class".'
      parsedPdfClasses = [createEmptyClassRow()]
      renderPdfPreviewTable(parsedPdfClasses)
      pdfPreviewSection.hidden = false
      return
    }

    parsedPdfClasses = deduplicateParsedClasses(allExtracted)
    renderPdfPreviewTable(parsedPdfClasses)
    pdfPreviewSection.hidden = false
    pdfImportButton.disabled = false
    pdfImportMessage.className = 'pdf-import-message success'
    pdfImportMessage.textContent = `Successfully extracted ${parsedPdfClasses.length} timetable entries from Excel. Review and click "Import Classes".`
  } catch (error) {
    console.error('Excel parsing error:', error)
    pdfParseStatus.hidden = true
    pdfImportMessage.className = 'pdf-import-message error'
    pdfImportMessage.textContent = `Error reading Excel file: ${error.message || 'Unable to parse spreadsheet.'}`
  }
}

function handlePdfFileSelection(file) {
  if (!file) return
  const name = file.name.toLowerCase()
  const isPdf = name.endsWith('.pdf') || file.type === 'application/pdf'
  const isExcel =
    name.endsWith('.xlsx') ||
    name.endsWith('.xls') ||
    name.endsWith('.csv') ||
    file.type.includes('spreadsheet') ||
    file.type.includes('excel') ||
    file.type.includes('csv')

  if (!isPdf && !isExcel) {
    pdfImportMessage.className = 'pdf-import-message error'
    pdfImportMessage.textContent = 'Please select a valid PDF (.pdf) or Excel (.xlsx, .xls, .csv) file.'
    return
  }

  // Set file icon
  const iconSpan = pdfSelectedBar.querySelector('.pdf-file-icon')
  if (iconSpan) {
    iconSpan.textContent = isExcel ? '📊' : '📄'
  }

  pdfFileName.textContent = file.name
  const sizeKb = Math.round(file.size / 1024)
  pdfFileSize.textContent = `(${sizeKb > 1024 ? (sizeKb / 1024).toFixed(1) + ' MB' : sizeKb + ' KB'})`
  pdfSelectedBar.hidden = false
  if (pdfDropzone) pdfDropzone.hidden = true

  if (isExcel) {
    parseExcelFile(file)
  } else {
    parsePdfFile(file)
  }
}

function createEmptyClassRow() {
  return {
    selected: true,
    day: selectedDayName || 'Monday',
    start_time: '10:00:00',
    end_time: '10:55:00',
    course_code: '',
    course_name: '',
    faculty: '',
    room: '',
    batch: '',
    type: 'class',
  }
}

function addPreviewRow() {
  parsedPdfClasses.push(createEmptyClassRow())
  renderPdfPreviewTable(parsedPdfClasses)
  const lastRow = pdfPreviewTableBody.lastElementChild
  if (lastRow) {
    const codeInput = lastRow.querySelector('input[type="text"]')
    if (codeInput) codeInput.focus()
  }
}

function setAllPreviewSelection(isSelected) {
  parsedPdfClasses.forEach((item) => {
    item.selected = isSelected
  })
  renderPdfPreviewTable(parsedPdfClasses)
}

function updatePdfImportButtonState() {
  const selectedItems = parsedPdfClasses.filter((item) => item.selected !== false)
  const count = selectedItems.length
  pdfImportButton.disabled = count === 0
  pdfImportButton.textContent = `Import ${count} Selected Class${count === 1 ? '' : 'es'}`

  if (pdfMasterCheckbox) {
    pdfMasterCheckbox.checked = parsedPdfClasses.length > 0 && count === parsedPdfClasses.length
    pdfMasterCheckbox.indeterminate = count > 0 && count < parsedPdfClasses.length
  }
}

function renderPdfPreviewTable(classes) {
  pdfPreviewTableBody.replaceChildren()
  pdfPreviewCount.textContent = `${classes.length} class${classes.length === 1 ? '' : 'es'} detected`

  if (classes.length === 0) {
    const emptyRow = document.createElement('tr')
    emptyRow.innerHTML = `<td colspan="11" style="text-align:center; padding: 20px; color: var(--muted);">No classes to preview. Click "+ Add Row" to add entries manually.</td>`
    pdfPreviewTableBody.append(emptyRow)
    updatePdfImportButtonState()
    return
  }

  classes.forEach((item, index) => {
    const tr = document.createElement('tr')
    tr.dataset.index = index
    if (!item.selected) tr.classList.add('row-unselected')

    // Checkbox
    const tdCheck = document.createElement('td')
    tdCheck.style.textAlign = 'center'
    const check = document.createElement('input')
    check.type = 'checkbox'
    check.checked = item.selected !== false
    check.setAttribute('aria-label', `Select ${item.course_code || 'class'}`)
    check.addEventListener('change', (e) => {
      item.selected = e.target.checked
      tr.classList.toggle('row-unselected', !e.target.checked)
      updatePdfImportButtonState()
    })
    tdCheck.append(check)
    tr.append(tdCheck)

    // Day
    const tdDay = document.createElement('td')
    const selectDay = document.createElement('select')
    WEEKDAYS.forEach((d) => selectDay.add(new Option(d, d)))
    selectDay.value = item.day || 'Monday'
    selectDay.addEventListener('change', (e) => {
      item.day = e.target.value
    })
    tdDay.append(selectDay)
    tr.append(tdDay)

    // Start Time
    const tdStart = document.createElement('td')
    const inputStart = document.createElement('input')
    inputStart.type = 'time'
    inputStart.value = String(item.start_time || '10:00:00').slice(0, 5)
    inputStart.addEventListener('change', (e) => {
      item.start_time = `${e.target.value}:00`.slice(0, 8)
    })
    tdStart.append(inputStart)
    tr.append(tdStart)

    // End Time
    const tdEnd = document.createElement('td')
    const inputEnd = document.createElement('input')
    inputEnd.type = 'time'
    inputEnd.value = String(item.end_time || '10:55:00').slice(0, 5)
    inputEnd.addEventListener('change', (e) => {
      item.end_time = `${e.target.value}:00`.slice(0, 8)
    })
    tdEnd.append(inputEnd)
    tr.append(tdEnd)

    // Course Code
    const tdCode = document.createElement('td')
    const inputCode = document.createElement('input')
    inputCode.type = 'text'
    inputCode.value = item.course_code || ''
    inputCode.placeholder = 'e.g. CS2003'
    inputCode.required = true
    inputCode.addEventListener('input', (e) => {
      item.course_code = e.target.value.trim()
    })
    tdCode.append(inputCode)
    tr.append(tdCode)

    // Course Name
    const tdName = document.createElement('td')
    const inputName = document.createElement('input')
    inputName.type = 'text'
    inputName.value = item.course_name || ''
    inputName.placeholder = 'e.g. Data Structures'
    inputName.addEventListener('input', (e) => {
      item.course_name = e.target.value.trim()
    })
    tdName.append(inputName)
    tr.append(tdName)

    // Type
    const tdType = document.createElement('td')
    const selectType = document.createElement('select')
    selectType.add(new Option('Lecture', 'class'))
    selectType.add(new Option('Lab', 'lab'))
    selectType.add(new Option('Tutorial', 'tut'))
    selectType.value = ['class', 'lab', 'tut'].includes(item.type) ? item.type : 'class'
    selectType.addEventListener('change', (e) => {
      item.type = e.target.value
    })
    tdType.append(selectType)
    tr.append(tdType)

    // Faculty
    const tdFac = document.createElement('td')
    const inputFac = document.createElement('input')
    inputFac.type = 'text'
    inputFac.value = item.faculty || ''
    inputFac.placeholder = 'e.g. PK'
    inputFac.addEventListener('input', (e) => {
      item.faculty = e.target.value.trim()
    })
    tdFac.append(inputFac)
    tr.append(tdFac)

    // Room
    const tdRoom = document.createElement('td')
    const inputRoom = document.createElement('input')
    inputRoom.type = 'text'
    inputRoom.value = item.room || ''
    inputRoom.placeholder = 'e.g. L104'
    inputRoom.addEventListener('input', (e) => {
      item.room = e.target.value.trim()
    })
    tdRoom.append(inputRoom)
    tr.append(tdRoom)

    // Batch
    const tdBatch = document.createElement('td')
    const selectBatch = document.createElement('select')
    selectBatch.add(new Option('All', ''))
    ;['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'D1', 'D2', 'E1', 'E2', 'Batch A', 'Batch B'].forEach((b) => {
      selectBatch.add(new Option(b, b))
    })
    selectBatch.value = item.batch || ''
    selectBatch.addEventListener('change', (e) => {
      item.batch = e.target.value
    })
    tdBatch.append(selectBatch)
    tr.append(tdBatch)

    // Remove button
    const tdDel = document.createElement('td')
    const delBtn = document.createElement('button')
    delBtn.type = 'button'
    delBtn.className = 'pdf-row-remove-btn'
    delBtn.title = 'Remove this row'
    delBtn.textContent = '✕'
    delBtn.addEventListener('click', () => {
      parsedPdfClasses.splice(index, 1)
      renderPdfPreviewTable(parsedPdfClasses)
    })
    tdDel.append(delBtn)
    tr.append(tdDel)

    pdfPreviewTableBody.append(tr)
  })

  updatePdfImportButtonState()
}

async function importParsedClasses() {
  const selectedItems = parsedPdfClasses.filter((item) => item.selected !== false)
  if (selectedItems.length === 0) return

  const targetSectionId = pdfSection.value
  if (!targetSectionId) {
    pdfImportMessage.className = 'pdf-import-message error'
    pdfImportMessage.textContent = 'Please select a target section for the timetable.'
    return
  }

  // Scoped authorization validation
  if (currentProfile?.role === 'class_leader' && String(currentProfile.section_id) !== String(targetSectionId)) {
    pdfImportMessage.className = 'pdf-import-message error'
    pdfImportMessage.textContent = 'You are only authorized to import timetable for your assigned section.'
    return
  }

  for (const item of selectedItems) {
    if (!item.course_code) {
      pdfImportMessage.className = 'pdf-import-message error'
      pdfImportMessage.textContent = `Each selected class must have a Course Code. Please check entries.`
      return
    }
    if (item.end_time <= item.start_time) {
      pdfImportMessage.className = 'pdf-import-message error'
      pdfImportMessage.textContent = `End time must be after start time for ${item.course_code} on ${item.day}.`
      return
    }
  }

  pdfImportButton.disabled = true
  pdfImportButton.textContent = 'Importing...'
  pdfImportMessage.className = 'pdf-import-message'
  pdfImportMessage.textContent = `Importing ${selectedItems.length} classes into Supabase...`

  try {
    const payload = selectedItems.map((item) => ({
      section_id: targetSectionId,
      day_of_week: item.day,
      start_time: item.start_time,
      end_time: item.end_time,
      course_code: item.course_code,
      course_name: item.course_name || item.course_code,
      subject: item.course_code,
      faculty: item.faculty || null,
      room: item.room || null,
      batch: item.batch || null,
      type: item.type || 'class',
    }))

    // Batch insert into timetable table
    let { error } = await window.supabaseClient
      .from('timetable')
      .insert(payload)

    // Fallback for legacy DB schema if extended columns (course_code, batch) are not yet in table
    if (error && (error.code === '42703' || String(error.message || '').includes('course_code') || String(error.message || '').includes('batch'))) {
      const legacyPayload = payload.map((p) => ({
        section_id: p.section_id,
        day_of_week: p.day_of_week,
        start_time: p.start_time,
        end_time: p.end_time,
        subject: p.subject,
        room: p.room,
        type: ['break', 'free'].includes(p.type) ? p.type : 'class',
      }))
      const legacyRes = await window.supabaseClient.from('timetable').insert(legacyPayload)
      error = legacyRes.error
    }

    if (error) throw error

    const selectedSec = availableSections.find((s) => String(s.id) === String(targetSectionId))
    const secName = selectedSec ? `${selectedSec.branch} Sem ${selectedSec.semester} ${selectedSec.name}` : 'section'

    closePdfModal()
    scheduleManagementStatus.textContent = `Successfully imported ${payload.length} classes for ${secName}!`
    await loadSchedule()
  } catch (err) {
    console.error('Import timetable error:', err)
    pdfImportButton.disabled = false
    pdfImportButton.textContent = 'Import Classes'
    pdfImportMessage.className = 'pdf-import-message error'
    pdfImportMessage.textContent = isPermissionError(err)
      ? 'Permission denied: You do not have authorization to modify this section.'
      : `Failed to import classes: ${err.message || 'Please check your connection and try again.'}`
  }
}

function setupPdfEventListeners() {
  if (importPdfButton) {
    importPdfButton.addEventListener('click', openPdfModal)
  }
  if (closePdfModalButton) {
    closePdfModalButton.addEventListener('click', closePdfModal)
  }
  if (cancelPdfModalButton) {
    cancelPdfModalButton.addEventListener('click', closePdfModal)
  }
  if (pdfBranch) {
    pdfBranch.addEventListener('change', refreshPdfSectionOptions)
  }
  if (pdfSemester) {
    pdfSemester.addEventListener('change', refreshPdfSectionOptions)
  }
  if (pdfDropzone) {
    pdfDropzone.addEventListener('click', () => {
      if (pdfFileInput) pdfFileInput.click()
    })
    pdfDropzone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        if (pdfFileInput) pdfFileInput.click()
      }
    })
    pdfDropzone.addEventListener('dragover', (e) => {
      e.preventDefault()
      pdfDropzone.classList.add('dragover')
    })
    pdfDropzone.addEventListener('dragleave', () => {
      pdfDropzone.classList.remove('dragover')
    })
    pdfDropzone.addEventListener('drop', (e) => {
      e.preventDefault()
      pdfDropzone.classList.remove('dragover')
      const files = e.dataTransfer?.files
      if (files && files.length > 0) {
        handlePdfFileSelection(files[0])
      }
    })
  }
  if (pdfFileInput) {
    pdfFileInput.addEventListener('change', (e) => {
      const files = e.target.files
      if (files && files.length > 0) {
        handlePdfFileSelection(files[0])
      }
    })
  }
  if (pdfClearFileBtn) {
    pdfClearFileBtn.addEventListener('click', resetPdfModal)
  }
  if (pdfMasterCheckbox) {
    pdfMasterCheckbox.addEventListener('change', (e) => {
      setAllPreviewSelection(e.target.checked)
    })
  }
  if (pdfSelectAllBtn) {
    pdfSelectAllBtn.addEventListener('click', () => setAllPreviewSelection(true))
  }
  if (pdfDeselectAllBtn) {
    pdfDeselectAllBtn.addEventListener('click', () => setAllPreviewSelection(false))
  }
  if (pdfAddPreviewRowBtn) {
    pdfAddPreviewRowBtn.addEventListener('click', addPreviewRow)
  }
  if (pdfImportButton) {
    pdfImportButton.addEventListener('click', importParsedClasses)
  }
  if (pdfImportModal) {
    pdfImportModal.addEventListener('click', (e) => {
      if (e.target === pdfImportModal) closePdfModal()
    })
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && pdfImportModal && !pdfImportModal.hidden) {
      closePdfModal()
    }
  })
}

addClassButton.addEventListener('click', () => openClassForm())
classForm.addEventListener('submit', saveClass)
closeClassFormButton.addEventListener('click', closeClassForm)
cancelClassFormButton.addEventListener('click', closeClassForm)
classFields.branch.addEventListener('change', refreshSectionOptions)
classFields.semester.addEventListener('change', refreshSectionOptions)
classModal.addEventListener('click', (event) => {
  if (event.target === classModal) closeClassForm()
})
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !classModal.hidden) closeClassForm()
})

document.addEventListener('DOMContentLoaded', async () => {
  displaySelectedDayHeader()
  setupPdfEventListeners()
  const isAuthenticated = await loadUserRole()
  if (!isAuthenticated) return

  await loadSchedule()
  subscribeToTimetableChanges()

  // Keep current time and next class countdown updated every minute
  setInterval(() => {
    const todayWeekday = new Date().toLocaleDateString('en-US', { weekday: 'long' })
    if (selectedDayName.toLowerCase() === todayWeekday.toLowerCase()) {
      const dayFiltered = fullSchedule.filter(
        (item) => String(item.day_of_week || '').toLowerCase() === selectedDayName.toLowerCase(),
      )
      displaySchedule(dayFiltered)
    }
    displayNextClass(fullSchedule)
  }, 60000)
})
