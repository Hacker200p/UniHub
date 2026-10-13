import { Suspense, lazy, useEffect, useState, useRef, useCallback } from 'react'
import './App.css'
import { useTheme } from './context/useTheme.js'
import { useAuth } from './context/useAuth.js'

const ResourcesPage = lazy(() => import('./pages/ResourcesPage.jsx'))
const AuthPage = lazy(() => import('./pages/AuthPage.jsx'))
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage.jsx'))
const VerifyEmailPage = lazy(() => import('./pages/VerifyEmailPage.jsx'))
const DashboardPage = lazy(() => import('./pages/DashboardPage.jsx'))
const UploadPage = lazy(() => import('./pages/UploadPage.jsx'))
const AdminPageRoute = lazy(() => import('./pages/AdminPage.jsx'))
const SavedResourcesPage = lazy(() => import('./pages/SavedResourcesPage.jsx'))
const ResourceDetailPage = lazy(() => import('./pages/ResourceDetailPage.jsx'))
const AcademicBrowserPage = lazy(() => import('./pages/AcademicBrowserPage.jsx'))
const RequestsPage = lazy(() => import('./pages/RequestsPage.jsx'))
const SettingsPage = lazy(() => import('./pages/SettingsPage.jsx'))
const OAuthCallbackPage = lazy(() => import('./pages/OAuthCallbackPage.jsx'))
const ContributorsDirectoryPage = lazy(async () => {
  const mod = await import('./pages/CommunityPages.jsx')
  return { default: mod.ContributorsDirectoryPage }
})
const TeamDirectoryPage = lazy(async () => {
  const mod = await import('./pages/CommunityPages.jsx')
  return { default: mod.TeamDirectoryPage }
})
const AboutPage = lazy(async () => {
  const mod = await import('./pages/InfoPages.jsx')
  return { default: mod.AboutPage }
})
const ContactPage = lazy(async () => {
  const mod = await import('./pages/InfoPages.jsx')
  return { default: mod.ContactPage }
})

const developers = [
  { name: 'Rahul Sharma', role: 'Full Stack Developer', initials: 'RS', description: 'Built the first version of UniHub for students who learn by sharing.', skills: ['React', 'Node.js', 'MongoDB'], website: 'https://rahulsharma.dev', github: 'https://github.com', linkedin: 'https://linkedin.com', tone: 'coral' },
  { name: 'Nisha Menon', role: 'Product & UI Designer', initials: 'NM', description: 'Shapes the calm, focused study experience and keeps every workflow student-friendly.', skills: ['Research', 'Figma', 'Design systems'], website: 'https://nishamenon.design', github: 'https://github.com', linkedin: 'https://linkedin.com', tone: 'blue' },
]
const contributors = [
  { id: 'aman-verma', name: 'Aman Verma', program: 'B.Tech', branch: 'CSE', semester: '3rd year', count: 18, downloads: 426, badges: ['Active', 'Helpful'], initials: 'AV', tone: 'gold' },
  { id: 'sana-ali', name: 'Sana Ali', program: 'B.Tech', branch: 'ECE', semester: '2nd year', count: 14, downloads: 318, badges: ['Active'], initials: 'SA', tone: 'violet' },
  { id: 'dev-patel', name: 'Dev Patel', program: 'IMCA', branch: 'IMCA', semester: '4th semester', count: 11, downloads: 209, badges: ['Helpful'], initials: 'DP', tone: 'mint' },
]
const resources = [
  { title: 'Data Structures Complete Notes', type: 'Notes', branch: 'CSE', semester: 'Semester 3', subject: 'Data Structures', contributor: 'Aman Verma' },
  { title: 'DBMS End Term 2025', type: 'PYQ', branch: 'CSE', semester: 'Semester 4', subject: 'Database Systems', contributor: 'Sana Ali' },
  { title: 'Digital Electronics Unit 2', type: 'Notes', branch: 'ECE', semester: 'Semester 3', subject: 'Digital Electronics', contributor: 'Dev Patel' },
]

function Avatar({ initials = '', tone = 'blue', large = false, size = '', src = '', name = '' }) {
  const displayInitials = initials || (name ? name.slice(0, 2).toUpperCase() : 'US')
  const sizeClass = size ? `avatar-${size}` : large ? 'avatar-large' : ''
  return (
    <div className={`avatar avatar-${tone} ${sizeClass}`} aria-hidden="true">
      {src ? (
        <img
          src={src}
          alt={name || 'Avatar'}
          className="avatar-img"
          onError={(e) => {
            e.currentTarget.style.display = 'none'
          }}
        />
      ) : null}
      <span className="avatar-text">{displayInitials}</span>
    </div>
  )
}


function Header({ onNavigate }) {
  const { theme, toggleTheme } = useTheme()
  const { user, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (!mobileMenuOpen) return undefined

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setMobileMenuOpen(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [mobileMenuOpen])

  const handleMenuNav = (targetPath) => {
    setMenuOpen(false)
    setMobileMenuOpen(false)
    onNavigate(targetPath)
  }

  const handleSignOut = () => {
    setMenuOpen(false)
    setMobileMenuOpen(false)
    logout()
    onNavigate('/')
  }

  const navLinks = [
    { label: 'Contributors', path: '/contributors' },
    { label: 'Developers', path: '/team' },
    { label: 'Requests', path: '/requests' },
    ...(user && ['ADMIN', 'MODERATOR'].includes(user.role) ? [{ label: 'Staff Workspace', path: '/admin', accent: true }] : []),
    ...(user ? [{ label: 'Dashboard', path: '/dashboard' }] : []),
  ]

  return (
    <header className={`site-header ${mobileMenuOpen ? 'nav-open' : ''}`}>
      <div className="site-header-inner">
        <button className="brand" onClick={() => onNavigate('/')} aria-label="UniHub home">
          <img src="/logo.png" alt="UniHub Logo" className="brand-logo" /><span><strong>UniHub</strong></span>
        </button>

        <nav className="nav-primary" aria-label="Main navigation">
          {navLinks.map((item) => (
            <button
              key={item.label}
              className={item.accent ? 'nav-staff-link' : ''}
              onClick={() => onNavigate(item.path)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="nav-utility">
          {user ? (
            <>
              <button
                className="header-notification-button"
                onClick={() => onNavigate('/settings/notifications')}
                aria-label="View notifications"
                title="Notifications & Messages"
                type="button"
              >
                <span aria-hidden="true">🔔</span>
                <span className="notification-dot" aria-hidden="true" />
              </button>
              <div className="nav-user-dropdown" ref={menuRef}>
                <button
                  className="nav-user-avatar-btn"
                  onClick={() => setMenuOpen(!menuOpen)}
                  aria-expanded={menuOpen}
                  aria-label="User account menu"
                  type="button"
                >
                  <Avatar
                    initials={user.name ? user.name.slice(0, 2).toUpperCase() : 'US'}
                    src={user.avatarUrl}
                    tone="blue"
                    size="small"
                  />
                  <span className="nav-user-name">{user.name?.split(' ')[0] || 'Account'}</span>
                  <span className="dropdown-caret" aria-hidden="true">▾</span>
                </button>

                {menuOpen && (
                  <div className="dropdown-menu" role="menu" aria-label="User menu">
                    <div className="dropdown-header">
                      <strong>{user.name}</strong>
                      <span className="dropdown-email">{user.email}</span>
                      <span className="role-tag">{user.role}</span>
                    </div>
                    <div className="dropdown-divider"></div>
                    <button type="button" onClick={() => handleMenuNav('/dashboard')}>📊 Dashboard</button>
                    <button type="button" onClick={() => handleMenuNav('/upload')}>📤 Upload Resource</button>
                    <button type="button" onClick={() => handleMenuNav('/bookmarks')}>🔖 Saved Resources</button>
                    <div className="dropdown-divider"></div>
                    <button type="button" onClick={() => handleMenuNav('/settings')}>👤 Profile Settings</button>
                    <button type="button" onClick={() => handleMenuNav('/settings/security')}>🔒 Security & Accounts</button>
                    <button type="button" onClick={() => handleMenuNav('/settings/sessions')}>📱 Active Sessions</button>
                    <button type="button" onClick={() => handleMenuNav('/settings/privacy')}>🛡️ Privacy</button>
                    <button type="button" onClick={() => handleMenuNav('/settings/notifications')}>🔔 Notifications</button>
                    <div className="dropdown-divider"></div>
                    <button type="button" className="dropdown-signout" onClick={handleSignOut}>🚪 Sign out</button>
                  </div>
                )}
              </div>
              <button className="nav-signout-btn" onClick={handleSignOut} type="button">Sign out</button>
            </>
          ) : (
            <button className="nav-auth-btn" onClick={() => onNavigate('/login')} type="button">Member Login</button>
          )}
          <button className="theme-toggle" onClick={toggleTheme} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`} type="button">
            {theme === 'light' ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            )}
          </button>
          <button className="nav-cta" onClick={() => onNavigate('/resources')} type="button">
            Explore resources <span aria-hidden="true">↗</span>
          </button>
        </div>

        <button
          className="mobile-nav-toggle"
          onClick={() => setMobileMenuOpen((open) => !open)}
          aria-expanded={mobileMenuOpen}
          aria-controls="site-mobile-navigation"
          aria-label="Toggle navigation menu"
          type="button"
        >
          <span aria-hidden="true">☰</span>
          <span>Menu</span>
        </button>
      </div>

      {mobileMenuOpen && (
        <div className="mobile-nav-panel" id="site-mobile-navigation" role="dialog" aria-modal="false" aria-label="Mobile navigation menu">
          {navLinks.map((item) => (
            <button key={item.label} type="button" className={item.accent ? 'nav-staff-link' : ''} onClick={() => handleMenuNav(item.path)}>
              {item.label}
            </button>
          ))}
          <button type="button" onClick={() => handleMenuNav('/resources')}>Explore resources</button>
          {!user && <button type="button" onClick={() => handleMenuNav('/login')}>Member Login</button>}
          {user && (
            <>
              <button type="button" onClick={() => handleMenuNav('/settings/notifications')}>Notifications</button>
              <button type="button" onClick={handleSignOut}>Sign out</button>
            </>
          )}
        </div>
      )}
    </header>
  )
}

function DeveloperCard({ developer, style }) {
  return (
    <article className="developer-card" style={style}>
      <div className={`developer-banner banner-${developer.tone}`}>
        <span className="banner-label">DEVELOPED BY</span>
        <span className="banner-shape">✦</span>
      </div>
      <div className="developer-body">
        <div className="developer-avatar-wrapper">
          <Avatar initials={developer.initials} tone={developer.tone} large />
        </div>
        <div className="developer-copy">
          <p className="eyebrow">{developer.role}</p>
          <h3>{developer.name}</h3>
          <p>{developer.description}</p>
        </div>
        <div className="skill-list">
          {developer.skills.map((skill) => (
            <span key={skill}>{skill}</span>
          ))}
        </div>
        <div className="developer-links">
          <a className="primary-link" href={developer.website} target="_blank" rel="noreferrer">
            Visit website <span>↗</span>
          </a>
          <a href={developer.github} target="_blank" rel="noreferrer">
            GitHub
          </a>
          <a href={developer.linkedin} target="_blank" rel="noreferrer">
            LinkedIn
          </a>
        </div>
      </div>
    </article>
  )
}

function ContributorCard({ contributor, onNavigate, style }) {
  return (
    <article className="contributor-card" style={style}>
      <div>
        <div className="contributor-top">
          <Avatar initials={contributor.initials} tone={contributor.tone} />
          <span className="verified">✓ Contributor</span>
        </div>
        <h3>{contributor.name}</h3>
        <p className="contributor-meta">
          {contributor.program} <span>•</span> {contributor.branch}
        </p>
        <p className="muted">{contributor.semester}</p>
      </div>

      <div>
        <div className="contribution-count">
          <strong>{contributor.count}</strong>
          <span> approved contributions · {contributor.downloads} downloads</span>
        </div>
        <div className="badge-row">
          {contributor.badges.map((badge) => (
            <span key={badge}>{badge}</span>
          ))}
        </div>
        <button
          type="button"
          className="text-link"
          onClick={() => onNavigate(`/contributors/${contributor.id}`)}
        >
          View contributions <span>→</span>
        </button>
      </div>
    </article>
  )
}

function HomeResourceCard({ resource, onNavigate, style }) {
  return (
    <article
      className="resource-card"
      style={style}
      onClick={() => onNavigate('/resources')}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onNavigate('/resources')
      }}
    >
      <div className="resource-card-header">
        <div className="resource-badges">
          <span className={`type-badge badge-${resource.type.toLowerCase()}`}>{resource.type}</span>
          <span className="year-badge">Semester</span>
        </div>
        <div className="file-type-pill">
          <span>PDF</span>
        </div>
      </div>
      <div className="resource-card-body">
        <h3 className="resource-title">{resource.title}</h3>
        <div className="resource-academic-tags">
          <span className="subject-name-tag">{resource.subject}</span>
        </div>
        <p className="resource-hierarchy-meta">
          {resource.branch} · {resource.semester}
        </p>
      </div>
      <div className="resource-card-footer">
        <div className="contributor-info">
          <div className="contributor-avatar-mini" aria-hidden="true">
            {resource.contributor.slice(0, 2).toUpperCase()}
          </div>
          <span className="contributor-name">{resource.contributor}</span>
        </div>
        <div className="resource-stats-action">
          <button
            type="button"
            className="card-action-btn"
            onClick={(e) => {
              e.stopPropagation()
              onNavigate('/resources')
            }}
          >
            Explore <span>↗</span>
          </button>
        </div>
      </div>
    </article>
  )
}

const SHOWCASE_CARDS = [
  {
    id: 'notes',
    pageNumber: '01',
    indicator: '01 / 03',
    category: 'STUDY NOTES',
    title: 'Class Notes & Summaries',
    subject: 'Data Structures · Unit 01-04',
    supporting: 'Learn, revise, and share knowledge.',
    footerTag: '✓ Verified peer notes · Semester 3',
    tone: 'coral',
    renderBody: () => (
      <div className="showcase-notes-lines">
        <div className="notes-line-item">
          <span className="notes-bullet">✦</span>
          <span>AVL tree balance factors & rotations</span>
        </div>
        <div className="notes-line-item">
          <span className="notes-bullet">✦</span>
          <span>Graph shortest path (Dijkstra algorithm)</span>
        </div>
        <div className="notes-line-item">
          <span className="notes-bullet">✦</span>
          <span>Asymptotic bounds & Big-O cheatsheet</span>
        </div>
      </div>
    ),
  },
  {
    id: 'pyq',
    pageNumber: '02',
    indicator: '02 / 03',
    category: 'PREVIOUS YEAR PAPERS',
    title: 'Practice with PYQs',
    subject: 'Cloud Computing · End Term 2025',
    supporting: 'Prepare smarter for your examinations.',
    footerTag: '✓ Solved & answer key included',
    tone: 'gold',
    renderBody: () => (
      <div className="showcase-pyq-content">
        <div className="showcase-exam-strip">
          <span>END TERM EXAM · 3 HOURS</span>
          <span>100 MARKS</span>
        </div>
        <div className="showcase-exam-questions">
          <div className="exam-question-item">
            <strong className="exam-q-tag">Q1.</strong>
            <span>Explain CAP theorem and distributed consensus algorithms.</span>
          </div>
          <div className="exam-question-item">
            <strong className="exam-q-tag">Q2.</strong>
            <span>Compare serverless event triggers vs microservice containers.</span>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'resources',
    pageNumber: '03',
    indicator: '03 / 03',
    category: 'STUDY RESOURCES',
    title: 'Resources for Every Semester',
    subject: 'PDF · Learning Materials · All Semesters',
    supporting: 'Discover useful resources from your community.',
    footerTag: '✓ 100% Free community access',
    tone: 'mint',
    renderBody: () => (
      <div className="showcase-resources-list">
        <div className="res-pill-item">
          <span className="pdf-badge-mini">PDF</span>
          <span>Lab Manuals & Code Templates</span>
        </div>
        <div className="res-pill-item">
          <span className="pdf-badge-mini">PDF</span>
          <span>Standard Reference Textbooks</span>
        </div>
        <div className="res-pill-item">
          <span className="pdf-badge-mini">PDF</span>
          <span>Midterm Assignment Solution Sets</span>
        </div>
      </div>
    ),
  },
]

function AcademicResourceShowcase() {
  const [activeIndex, setActiveIndex] = useState(0)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [captionIndicator, setCaptionIndicator] = useState('01 / 03')
  const [isPaused, setIsPaused] = useState(false)
  const indexRef = useRef(0)
  const isPausedRef = useRef(false)
  const cycleTimeoutRef = useRef(null)
  const settleTimeoutRef = useRef(null)

  useEffect(() => {
    isPausedRef.current = isPaused
  }, [isPaused])

  const triggerTransitionTo = useCallback((targetIdx) => {
    setIsTransitioning(true)
    setCaptionIndicator(SHOWCASE_CARDS[targetIdx].indicator)

    settleTimeoutRef.current = setTimeout(() => {
      indexRef.current = targetIdx
      setActiveIndex(targetIdx)
      setIsTransitioning(false)
    }, 820)
  }, [])

  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (prefersReducedMotion) return

    let isMounted = true

    const scheduleNext = () => {
      cycleTimeoutRef.current = setTimeout(() => {
        if (!isMounted) return
        if (!isPausedRef.current) {
          const nextIdx = (indexRef.current + 1) % SHOWCASE_CARDS.length
          triggerTransitionTo(nextIdx)
          settleTimeoutRef.current = setTimeout(() => {
            if (!isMounted) return
            scheduleNext()
          }, 820)
        } else {
          // While paused, check again after 1 second
          scheduleNext()
        }
      }, 2800)
    }

    scheduleNext()

    return () => {
      isMounted = false
      if (cycleTimeoutRef.current) clearTimeout(cycleTimeoutRef.current)
      if (settleTimeoutRef.current) clearTimeout(settleTimeoutRef.current)
    }
  }, [triggerTransitionTo])

  const handleDotClick = (idx) => {
    if (idx === indexRef.current || isTransitioning) return
    if (cycleTimeoutRef.current) clearTimeout(cycleTimeoutRef.current)
    if (settleTimeoutRef.current) clearTimeout(settleTimeoutRef.current)
    triggerTransitionTo(idx)
  }

  return (
    <div
      className="hero-art hero-anim-art"
      aria-label="Interactive layered showcase of notes, question papers, and study resources"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocusCapture={() => setIsPaused(true)}
      onBlurCapture={() => setIsPaused(false)}
    >
      <div className="sun"></div>
      <div className="showcase-deck">
        {SHOWCASE_CARDS.map((card, i) => {
          const slot = (i - activeIndex + SHOWCASE_CARDS.length) % SHOWCASE_CARDS.length
          let slotClass = ''
          if (slot === 0) slotClass = isTransitioning ? 'slot-front anim-exit-to-back' : 'slot-front'
          else if (slot === 1) slotClass = isTransitioning ? 'slot-middle anim-to-front' : 'slot-middle'
          else if (slot === 2) slotClass = isTransitioning ? 'slot-back anim-to-middle' : 'slot-back'

          return (
            <article
              key={card.id}
              className={`showcase-card ${slotClass}`}
              aria-hidden={slot !== 0}
            >
              <div className="showcase-card-header">
                <span className={`showcase-category-badge badge-${card.tone}`}>
                  {card.category}
                </span>
                <span className="showcase-card-num">{card.pageNumber}</span>
              </div>

              <h3 className="showcase-card-title">{card.title}</h3>
              <div className="showcase-card-subject">{card.subject}</div>

              <div className="showcase-card-body">{card.renderBody()}</div>

              <p className="showcase-card-supporting">{card.supporting}</p>

              <div className="showcase-card-footer">
                <span>{card.footerTag}</span>
              </div>
            </article>
          )
        })}
      </div>

      <div className="showcase-dots" role="tablist" aria-label="Showcase categories">
        {SHOWCASE_CARDS.map((c, idx) => {
          const isSelected =
            idx === (isTransitioning ? (activeIndex + 1) % SHOWCASE_CARDS.length : activeIndex)
          return (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={isSelected}
              aria-label={`Switch to ${c.category}`}
              className={`showcase-dot ${isSelected ? 'active' : ''}`}
              onClick={() => handleDotClick(idx)}
            />
          )
        })}
      </div>

      <div className="art-caption">
        OPEN KNOWLEDGE<br />
        <strong>{captionIndicator}</strong>
      </div>
    </div>
  )
}

function Home({ onNavigate }) {
  const homeRef = useRef(null)

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    const container = homeRef.current
    if (!container) return

    const sections = container.querySelectorAll('.reveal-section')
    if (!sections.length) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-revealed')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    )

    sections.forEach((sec) => observer.observe(sec))

    const fallbackTimer = setTimeout(() => {
      sections.forEach((sec) => sec.classList.add('is-revealed'))
    }, 2000)

    return () => {
      clearTimeout(fallbackTimer)
      observer.disconnect()
    }
  }, [])

  return (
    <main ref={homeRef}>
      <section className="hero-section">
        <div className="hero-copy">
          <p className="eyebrow hero-anim-eyebrow">A community resource for curious minds</p>
          <h1 className="hero-title">
            <span className="hero-title-line hero-title-line-1">Your university.</span>
            <span className="hero-title-line hero-title-line-2"><em>Your notes.</em></span>
            <span className="hero-title-line hero-title-line-3">Your community.</span>
          </h1>
          <p className="hero-text hero-anim-text">
            A focused space for notes, question papers and the people who make learning here more
            generous.
          </p>
          <div className="hero-actions hero-anim-actions">
            <button className="primary-button" onClick={() => onNavigate('/resources')}>
              Explore resources <span>↗</span>
            </button>
            <button className="secondary-button" onClick={() => onNavigate('/contributors')}>
              Meet contributors <span>→</span>
            </button>
          </div>
          <div className="hero-proof hero-anim-proof">
            <span className="proof-avatars">
              <Avatar initials="AV" tone="gold" />
              <Avatar initials="SA" tone="violet" />
              <Avatar initials="DP" tone="mint" />
            </span>
            <span>
              <strong>43 students</strong><br />
              sharing knowledge this month
            </span>
          </div>
        </div>
        <AcademicResourceShowcase />
      </section>
      <section className="intro-strip reveal-section">
        <div>
          <span className="section-number">01</span>
          <h2>
            Built around how<br />
            <em>students actually study.</em>
          </h2>
        </div>
        <p>
          Find what you need by program, branch, semester or subject. Save a resource, share one
          back, and leave the next student a clearer path.
        </p>
        <div className="intro-stat">
          <strong>100%</strong>
          <span>free to access</span>
        </div>
      </section>
      <section className="content-section reveal-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">The latest additions</p>
            <h2>Recently shared</h2>
          </div>
          <button className="section-link" onClick={() => onNavigate('/resources')}>
            View all resources <span>↗</span>
          </button>
        </div>
        <div className="resource-grid">
          {resources.map((resource, idx) => (
            <HomeResourceCard
              key={resource.title}
              resource={resource}
              onNavigate={onNavigate}
              style={{ '--card-idx': idx }}
            />
          ))}
        </div>
      </section>
      <section className="contributors-section reveal-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">The people behind the library</p>
            <h2>Top contributors</h2>
          </div>
          <button className="section-link" onClick={() => onNavigate('/contributors')}>
            Meet everyone <span>↗</span>
          </button>
        </div>
        <div className="contributor-grid">
          {contributors.map((contributor, idx) => (
            <ContributorCard
              key={contributor.id}
              contributor={contributor}
              onNavigate={onNavigate}
              style={{ '--card-idx': idx }}
            />
          ))}
        </div>
      </section>
      <section className="developers-section reveal-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">The makers of this space</p>
            <h2>Developed by</h2>
          </div>
          <button className="section-link" onClick={() => onNavigate('/team')}>
            Meet the team <span>↗</span>
          </button>
        </div>
        <div className="developer-grid">
          {developers.map((developer, idx) => (
            <DeveloperCard
              key={developer.name}
              developer={developer}
              style={{ '--card-idx': idx }}
            />
          ))}
        </div>
      </section>
    </main>
  )
}

function App() {
  const { user } = useAuth()
  const [path, setPath] = useState(window.location.pathname)

  const navigate = useCallback((nextPath) => {
    window.history.pushState({}, '', nextPath)
    setPath(nextPath)
    window.scrollTo(0, 0)
  }, [])

  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname)
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const contributorId = path.startsWith('/contributors/') ? path.split('/')[2] : null
  const teamId = path.startsWith('/team/') ? path.split('/')[2] : null
  const resourceId = path.startsWith('/resources/') ? path.split('/')[2] : null

  let page
  if (path.startsWith('/admin')) {
    page = <AdminPageRoute onNavigate={navigate} currentPath={path} />
  } else if (path === '/contributors' || contributorId) {
    page = <ContributorsDirectoryPage onNavigate={navigate} selectedId={contributorId} />
  } else if (resourceId) {
    page = <ResourceDetailPage onNavigate={navigate} id={resourceId} />
  } else if (path === '/academic') {
    page = <AcademicBrowserPage onNavigate={navigate} />
  } else if (path === '/requests') {
    page = <RequestsPage onNavigate={navigate} />
  } else if (path === '/about') {
    page = <AboutPage />
  } else if (path === '/contact') {
    page = <ContactPage />
  } else if (path === '/team' || teamId) {
    page = <TeamDirectoryPage onNavigate={navigate} selectedId={teamId} />
  } else if (path === '/resources') {
    page = <ResourcesPage onNavigate={navigate} />
  } else if (path === '/auth/callback' || path.startsWith('/auth/callback')) {
    page = <OAuthCallbackPage onNavigate={navigate} />
  } else if (path === '/settings/security') {
    page = <SettingsPage activeTab="security" onNavigate={navigate} />
  } else if (path === '/settings/sessions') {
    page = <SettingsPage activeTab="sessions" onNavigate={navigate} />
  } else if (path === '/settings/privacy') {
    page = <SettingsPage activeTab="privacy" onNavigate={navigate} />
  } else if (path === '/settings/notifications') {
    page = <SettingsPage activeTab="notifications" onNavigate={navigate} />
  } else if (path === '/settings' || path.startsWith('/settings')) {
    page = <SettingsPage activeTab="profile" onNavigate={navigate} />
  } else if (path === '/login') {
    page = <AuthPage onNavigate={navigate} />
  } else if (path === '/forgot-password') {
    page = <ForgotPasswordPage onNavigate={navigate} />
  } else if (path === '/verify-email') {
    page = <VerifyEmailPage onNavigate={navigate} />
  } else if (path === '/register') {
    page = <AuthPage mode="register" onNavigate={navigate} />
  } else if (path === '/dashboard') {
    page = user && ['ADMIN', 'MODERATOR'].includes(user.role)
      ? <AdminPageRoute onNavigate={navigate} currentPath="/admin" />
      : <DashboardPage onNavigate={navigate} />
  } else if (path === '/upload') {
    page = <UploadPage onNavigate={navigate} />
  } else if (path === '/bookmarks') {
    page = <SavedResourcesPage onNavigate={navigate} />
  } else if (path === '/recently-viewed') {
    page = <SavedResourcesPage mode="recent" onNavigate={navigate} />
  } else if (path !== '/' && path !== '') {
    page = (
      <main className="directory-page">
        <div className="directory-hero">
          <p className="eyebrow">PAGE NOT FOUND</p>
          <h1>This page is<br /><em>not available.</em></h1>
          <p>The link may be outdated or the record may no longer be accessible.</p>
          <button className="secondary-button" onClick={() => navigate('/')}>Back to UniHub →</button>
        </div>
      </main>
    )
  } else {
    page = <Home onNavigate={navigate} />
  }

  return (
    <div className="app-shell">
      <Header onNavigate={navigate} />
      <div className="page-transition-wrapper" key={path.split('/')[1] || 'root'}>
        <Suspense fallback={(
          <main className="directory-page">
            <div className="directory-hero">
              <p className="eyebrow">LOADING</p>
              <h1>Preparing<br /><em>your workspace.</em></h1>
              <p>Please wait while we fetch the latest University resources.</p>
            </div>
          </main>
        )}>
          {page}
        </Suspense>
      </div>
      <footer>
        <span className="brand-mark">US</span>
        <span>UniHub</span>
        <span className="footer-note">Free academic resources, shared by our university community.</span>
        <button className="footer-link-button" onClick={() => navigate('/about')}>About</button>
        <button className="footer-link-button" onClick={() => navigate('/contact')}>Contact</button>
      </footer>
    </div>
  )
}

export default App
