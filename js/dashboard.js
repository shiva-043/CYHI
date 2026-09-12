// Store the page elements that will receive backend data.
const greetingHeading = document.querySelector('#greeting')
const greetingText = document.querySelector('#greetingText')
const userName = document.querySelector('#userName')
const nextClassContent = document.querySelector('#nextClassContent')
const importantContent = document.querySelector('#importantContent')
const eventsContent = document.querySelector('#eventsContent')
let loggedInUserName = ''
let loggedInProfile = null

// Choose the greeting from the visitor's current local time.
function getGreetingForCurrentTime() {
  const hour = new Date().getHours()

  if (hour < 12) return 'Good Morning'
  if (hour < 17) return 'Good Afternoon'
  return 'Good Evening'
}

function displayUserName(name) {
  loggedInUserName = name
  greetingText.textContent = getGreetingForCurrentTime()
  userName.textContent = name
}

async function getUserDetails() {
  try {
    const user = await window.CampusAuth.getAuthenticatedUser()

    if (!user || typeof user.name !== 'string' || user.name.trim() === '') {
      throw new Error('The user response does not contain a valid name.')
    }
    loggedInProfile = user
    displayUserName(user.name.trim())
  } catch (error) {
    console.error('Unable to load user details:', error)
    greetingHeading.textContent = 'Welcome 👋'
  }
}

function combineTodayWithTime(time) {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}T${time}`
}

// Format an ISO date as a friendly time such as "10:00 AM".
function formatClassTime(date) {
  return date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })
}

function displayNextClass(timetable) {
  const now = new Date()

  const validClasses = timetable
    .map((classItem) => ({
      ...classItem,
      startDate: new Date(classItem.startTime),
      endDate: new Date(classItem.endTime),
    }))
    .filter((classItem) => ['class', 'lab', 'tut'].includes(classItem.type))
    .filter((classItem) => !Number.isNaN(classItem.startDate.getTime()) && !Number.isNaN(classItem.endDate.getTime()))
    .sort((a, b) => a.startDate - b.startDate)

  nextClassContent.replaceChildren()

  // 1. Check if a class is happening right now
  const currentClass = validClasses.find((c) => now >= c.startDate && now < c.endDate)
  // 2. Otherwise check next upcoming class today
  const upcomingClass = validClasses.find((c) => c.startDate > now)

  const targetClass = currentClass || upcomingClass

  if (!targetClass) {
    const message = document.createElement('p')
    message.className = 'state-message'
    message.textContent = 'No more classes today! Enjoy your evening.'
    nextClassContent.append(message)
    return
  }

  const isHappeningNow = Boolean(currentClass)

  // Status Badge / Countdown
  const statusBadge = document.createElement('span')
  statusBadge.className = 'class-badge ' + (isHappeningNow ? 'badge-current-status' : 'badge-next-status')
  statusBadge.style.cssText = 'display: inline-block; margin-bottom: 10px; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 800; text-transform: uppercase;'
  if (isHappeningNow) {
    statusBadge.textContent = '● Happening Now'
    statusBadge.style.background = '#fde8e8'
    statusBadge.style.color = '#9c1414'
  } else {
    const minutesRemaining = Math.max(1, Math.ceil((targetClass.startDate - now) / 60000))
    statusBadge.textContent = `Starts in ${minutesRemaining} ${minutesRemaining === 1 ? 'minute' : 'minutes'}`
    statusBadge.style.background = '#e0f2fe'
    statusBadge.style.color = '#0369a1'
  }

  const subject = document.createElement('h3')
  const code = targetClass.course_code || targetClass.subject || 'Class'
  const name = targetClass.course_name && targetClass.course_name !== code ? ` • ${targetClass.course_name}` : ''
  subject.textContent = `${code}${name}`

  const details = document.createElement('p')
  details.className = 'class-details'
  const timeStr = `${formatClassTime(targetClass.startDate)} – ${formatClassTime(targetClass.endDate)}`
  const roomStr = targetClass.room ? `Room ${targetClass.room}` : 'Venue TBA'
  const facultyStr = targetClass.faculty ? ` • ${targetClass.faculty}` : ''
  details.textContent = `${timeStr} • ${roomStr}${facultyStr}`

  nextClassContent.append(statusBadge, subject, details)
}

async function getTimetable() {
  try {
    const weekday = new Date().toLocaleDateString('en-US', { weekday: 'long' })
    let query = window.supabaseClient
      .from('timetable')
      .select('*')
      .eq('day_of_week', weekday)
      .order('start_time')

    if (loggedInProfile && !loggedInProfile.section_id && loggedInProfile.branch && loggedInProfile.semester && loggedInProfile.role !== 'professor') {
      try {
        const bName = loggedInProfile.branch.toUpperCase() === 'ME' ? 'MECH' : loggedInProfile.branch.toUpperCase()
        const { data: matchedSecs } = await window.supabaseClient
          .from('sections')
          .select('id, name')
          .eq('branch', bName)
          .eq('semester', loggedInProfile.semester)
        if (matchedSecs && matchedSecs.length > 0) {
          const preferredName = (loggedInProfile.section_name || 'A').toUpperCase()
          const found = matchedSecs.find((s) => s.name.toUpperCase() === preferredName) || matchedSecs[0]
          loggedInProfile.section_id = found.id
        }
      } catch (secErr) {
        console.warn('Could not auto-resolve section_id for dashboard:', secErr)
      }
    }

    if (loggedInProfile?.role === 'professor') {
      const { data: assignments } = await window.supabaseClient
        .from('section_professors')
        .select('section_id')
        .eq('professor_id', loggedInProfile.id)
      if (assignments && assignments.length > 0) {
        query = query.in('section_id', assignments.map((a) => a.section_id))
      } else {
        query = query.eq('section_id', '00000000-0000-0000-0000-000000000000')
      }
    } else {
      query = query.eq('section_id', loggedInProfile?.section_id || '00000000-0000-0000-0000-000000000000')
    }

    const { data, error } = await query
    if (error) throw error

    let list = data || []
    if (loggedInProfile?.batch && loggedInProfile?.role !== 'professor') {
      const userBatch = loggedInProfile.batch.trim().toUpperCase()
      list = list.filter((item) => {
        if (!item.batch) return true
        const itemBatch = item.batch.trim().toUpperCase()
        return itemBatch === 'ALL' || itemBatch === userBatch
      })
    }

    const timetable = list.map((item) => ({
      ...item,
      startTime: combineTodayWithTime(item.start_time),
      endTime: combineTodayWithTime(item.end_time),
    }))

    displayNextClass(timetable)
  } catch (error) {
    console.error('Unable to load timetable:', error)
    nextClassContent.replaceChildren()
    const message = document.createElement('p')
    message.className = 'state-message error-message'
    message.textContent = 'Unable to load timetable.'
    nextClassContent.append(message)
  }
}

function displayImportantUpdates(updates) {
  importantContent.replaceChildren()

  if (updates.length === 0) {
    const message = document.createElement('p')
    message.className = 'state-message'
    message.textContent = 'No important updates.'
    importantContent.append(message)
    return
  }

  updates.forEach((update) => {
    const card = document.createElement('article')
    card.className = 'dashboard-card important-card'

    const text = document.createElement('div')
    const title = document.createElement('h3')
    const description = document.createElement('p')
    const viewButton = document.createElement('button')

    title.textContent = update.title || 'Important update'
    description.textContent = update.description || ''
    viewButton.type = 'button'
    viewButton.className = 'view-button'
    viewButton.textContent = 'View'
    viewButton.dataset.updateId = String(update.id ?? '')

    text.append(title, description)
    card.append(text, viewButton)
    importantContent.append(card)
  })
}

async function getImportantUpdates() {
  try {
    const { data: updates, error } = await window.supabaseClient
      .from('announcements')
      .select('*')
      .eq('category', 'Urgent')
      .order('created_at', { ascending: false })
      .limit(3)
    if (error) throw error

    displayImportantUpdates(updates)
  } catch (error) {
    console.error('Unable to load important updates:', error)
    importantContent.replaceChildren()
    const message = document.createElement('p')
    message.className = 'state-message error-message'
    message.textContent = 'Unable to load important updates.'
    importantContent.append(message)
  }
}

function displayEvents(events) {
  eventsContent.replaceChildren()

  if (events.length === 0) {
    const message = document.createElement('p')
    message.className = 'state-message'
    message.textContent = 'No upcoming events.'
    eventsContent.append(message)
    return
  }

  events.forEach((event) => {
    const card = document.createElement('article')
    card.className = 'dashboard-card event-card'

    const title = document.createElement('h3')
    const details = document.createElement('p')

    title.textContent = event.title || 'Upcoming event'
    details.textContent = [event.date, event.time].filter(Boolean).join(' • ')

    card.append(title, details)
    eventsContent.append(card)
  })
}

function formatEventDate(deadline) {
  if (!deadline) return ''
  const date = new Date(deadline)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString([], { day: 'numeric', month: 'short' })
}

function formatEventTime(deadline) {
  if (!deadline) return ''
  const date = new Date(deadline)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

async function getUpcomingEvents() {
  try {
    const { data: events, error } = await window.supabaseClient
      .from('announcements')
      .select('*')
      .eq('category', 'Events')
      .order('created_at', { ascending: false })
      .limit(6)
    if (error) throw error

    const now = new Date()
    const futureEvents = events.filter((event) => {
      if (!event.deadline) return true
      const d = new Date(event.deadline)
      return Number.isNaN(d.getTime()) || d >= now
    })
    const selectedEvents = (futureEvents.length > 0 ? futureEvents : events).slice(0, 3)

    displayEvents(selectedEvents.map((event) => ({
      ...event,
      date: formatEventDate(event.deadline),
      time: formatEventTime(event.deadline),
    })))
  } catch (error) {
    console.error('Unable to load upcoming events:', error)
    eventsContent.replaceChildren()
    const message = document.createElement('p')
    message.className = 'state-message error-message'
    message.textContent = 'Unable to load upcoming events.'
    eventsContent.append(message)
  }
}

// Reload changing dashboard data without refreshing the browser page.
async function loadChangingDashboardData() {
  // This also keeps the greeting correct if the page stays open across midday.
  if (loggedInUserName) displayUserName(loggedInUserName)

  await Promise.all([
    getTimetable(),
    getImportantUpdates(),
    getUpcomingEvents(),
  ])
}

async function loadDashboard() {
  await getUserDetails()
  if (!loggedInProfile) return
  await loadChangingDashboardData()
}

importantContent.addEventListener('click', (event) => {
  if (event.target.matches('.view-button')) {
    window.location.href = 'announcements.html'
  }
})

function subscribeToDashboardRealtime() {
  if (!window.supabaseClient) return null

  return window.supabaseClient
    .channel('dashboard-live-updates')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'timetable' },
      () => {
        getTimetable()
      },
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'announcements' },
      () => {
        getImportantUpdates()
        getUpcomingEvents()
      },
    )
    .subscribe()
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadDashboard()
  subscribeToDashboardRealtime()

  // Refresh changing information and recalculate the countdown every minute.
  setInterval(loadChangingDashboardData, 60000)
})
