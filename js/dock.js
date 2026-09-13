// Reusable Navigation & Slideable Mobile Dock Helper for Campus Companion
(function () {
  'use strict'

  function initNavigation() {
    const currentPath = window.location.pathname.toLowerCase()
    const isDashboard = currentPath.endsWith('dashboard.html') || currentPath.endsWith('/') || currentPath.endsWith('index.html')
    const isSchedule = currentPath.endsWith('schedule.html')
    const isAnnouncements = currentPath.endsWith('announcements.html')
    const isProfile = currentPath.endsWith('profile.html')

    // 1. Highlight Active Nav Items in Desktop Sidebar and Mobile Dock
    const navMapping = [
      { key: 'dashboard', active: isDashboard },
      { key: 'schedule', active: isSchedule },
      { key: 'announcements', active: isAnnouncements },
      { key: 'profile', active: isProfile },
    ]

    navMapping.forEach((item) => {
      const sidebarLink = document.querySelector(`.sidebar-nav-item[data-nav="${item.key}"]`)
      if (sidebarLink) {
        sidebarLink.classList.toggle('active', item.active)
      }

      const dockLink = document.querySelector(`.dock-tab[data-nav="${item.key}"]`)
      if (dockLink) {
        dockLink.classList.toggle('active', item.active)
      }
    })

    // 2. Set dynamic day of month in calendar dock icon
    const today = new Date()
    const dayOfMonth = today.getDate()
    const dateElements = document.querySelectorAll('.dock-calendar-date, .sidebar-calendar-date')
    dateElements.forEach((el) => {
      el.textContent = String(dayOfMonth)
    })

    // 3. Set formatted date in top header
    const dateHeader = document.querySelector('#portalHeaderDate')
    if (dateHeader) {
      dateHeader.textContent = today.toLocaleDateString([], {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    }

    // 4. Populate Sidebar Student Profile Badge if CampusAuth is loaded
    if (window.CampusAuth?.getAuthenticatedUser) {
      window.CampusAuth.getAuthenticatedUser(false)
        .then((user) => {
          if (!user) return
          const nameEl = document.querySelector('#sidebarUserName')
          const subEl = document.querySelector('#sidebarUserSub')
          const avatarEl = document.querySelector('#sidebarUserAvatar')

          if (nameEl) nameEl.textContent = user.name || user.full_name || 'Student'
          if (subEl) {
            const sem = user.semester ? `Sem ${user.semester}` : ''
            const branch = user.branch || ''
            subEl.textContent = [branch, sem].filter(Boolean).join(' • ') || 'IIITDM Jabalpur'
          }
          if (avatarEl && (user.name || user.full_name)) {
            const initials = (user.name || user.full_name)
              .split(' ')
              .map((n) => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2)
            avatarEl.textContent = initials || '👤'
          }
        })
        .catch(() => {
          // Unauthenticated or login page
        })
    }

    // 5. Apple / WhatsApp style scroll-driven auto slide for Mobile Dock
    const dockWrapper = document.querySelector('.mobile-dock-wrapper')
    if (dockWrapper) {
      let lastScrollY = window.scrollY
      let isHidden = false

      window.addEventListener(
        'scroll',
        () => {
          const currentY = window.scrollY
          const delta = currentY - lastScrollY

          if (delta > 8 && currentY > 40 && !isHidden) {
            dockWrapper.classList.add('dock-hidden')
            isHidden = true
          } else if (delta < -5 && isHidden) {
            dockWrapper.classList.remove('dock-hidden')
            isHidden = false
          }

          lastScrollY = currentY
        },
        { passive: true },
      )
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNavigation)
  } else {
    initNavigation()
  }
})()
