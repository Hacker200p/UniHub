import { useEffect, useState, useRef } from 'react'
import './App.css'
import ResourcesPage from './pages/ResourcesPage.jsx'
import AuthPage from './pages/AuthPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import UploadPage from './pages/UploadPage.jsx'
import { ContributorsDirectoryPage, TeamDirectoryPage } from './pages/CommunityPages.jsx'
import AdminPage from './pages/AdminPage.jsx'
import SavedResourcesPage from './pages/SavedResourcesPage.jsx'
import ResourceDetailPage from './pages/ResourceDetailPage.jsx'
import AcademicBrowserPage from './pages/AcademicBrowserPage.jsx'
import RequestsPage from './pages/RequestsPage.jsx'
import SettingsPage from './pages/SettingsPage.jsx'
import OAuthCallbackPage from './pages/OAuthCallbackPage.jsx'
import { AboutPage, ContactPage } from './pages/InfoPages.jsx'
import { useTheme } from './context/useTheme.js'
import { useAuth } from './context/useAuth.js'

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

function Avatar({ initials, tone = 'blue', large = false, src = '' }) {
  if (src) {
    return <img src={src} alt="User Avatar" className={`avatar avatar-img ${large ? 'avatar-large' : ''}`} />
  }
  return <div className={`avatar avatar-${tone} ${large ? 'avatar-large' : ''}`} aria-hidden="true">{initials}</div>
}

function Header({ onNavigate }) {
  const { theme, toggleTheme } = useTheme()
  const { user, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
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

  const handleMenuNav = (targetPath) => {
    setMenuOpen(false)
    onNavigate(targetPath)
  }

  const handleSignOut = () => {
    setMenuOpen(false)
    logout()
    onNavigate('/')
  }

  return (
    <header className="site-header">
      <button className="brand" onClick={() => onNavigate('/')} aria-label="UniHub home">
        <img src="/logo.png" alt="UniHub Logo" className="brand-logo" /><span><strong>UniHub</strong></span>
      </button>
      <nav aria-label="Main navigation">
        <button onClick={() => onNavigate('/contributors')}>Contributors</button>
        <button onClick={() => onNavigate('/team')}>Developers</button>
        <button onClick={() => onNavigate('/requests')}>Requests</button>
        {user && ['ADMIN', 'MODERATOR'].includes(user.role) && (
          <button className="nav-staff-link" onClick={() => onNavigate('/admin')}>Staff Workspace</button>
        )}
        {user ? (
          <>
            <button onClick={() => onNavigate('/dashboard')}>Dashboard</button>
            <div className="nav-user-dropdown" ref={menuRef}>
              <button
                className="nav-user-avatar-btn"
                onClick={() => setMenuOpen(!menuOpen)}
                aria-expanded={menuOpen}
                aria-label="User account menu"
              >
                <Avatar
                  initials={user.name ? user.name.slice(0, 2).toUpperCase() : 'US'}
                  src={user.avatarUrl}
                  tone="blue"
                />
                <span className="nav-user-name">{user.name?.split(' ')[0] || 'Account'}</span>
                <span className="dropdown-caret" aria-hidden="true">▾</span>
              </button>

              {menuOpen && (
                <div className="dropdown-menu">
                  <div className="dropdown-header">
                    <strong>{user.name}</strong>
                    <span className="dropdown-email">{user.email}</span>
                    <span className="role-tag">{user.role}</span>
                  </div>
                  <div className="dropdown-divider"></div>
                  <button onClick={() => handleMenuNav('/dashboard')}>📊 Dashboard</button>
                  <button onClick={() => handleMenuNav('/upload')}>📤 Upload Resource</button>
                  <button onClick={() => handleMenuNav('/bookmarks')}>🔖 Saved Resources</button>
                  <div className="dropdown-divider"></div>
                  <button onClick={() => handleMenuNav('/settings')}>👤 Profile Settings</button>
                  <button onClick={() => handleMenuNav('/settings/security')}>🔒 Security & Accounts</button>
                  <button onClick={() => handleMenuNav('/settings/sessions')}>📱 Active Sessions</button>
                  <button onClick={() => handleMenuNav('/settings/privacy')}>🛡️ Privacy</button>
                  <button onClick={() => handleMenuNav('/settings/notifications')}>🔔 Notifications</button>
                  <div className="dropdown-divider"></div>
                  <button className="dropdown-signout" onClick={handleSignOut}>🚪 Sign out</button>
                </div>
              )}
            </div>
            <button className="nav-signout-btn" onClick={handleSignOut}>Sign out</button>
          </>
        ) : (
          <button className="nav-auth-btn" onClick={() => onNavigate('/login')}>Member Login</button>
        )}
        <button className="theme-toggle" onClick={toggleTheme} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>
          {theme === 'light' ? '☾' : '☀'}
        </button>
        <button className="nav-cta" onClick={() => onNavigate('/resources')}>
          Explore resources <span aria-hidden="true">↗</span>
        </button>
      </nav>
    </header>
  )
}

function DeveloperCard({ developer }) {
  return (
    <article className="developer-card">
      <div className={`developer-banner banner-${developer.tone}`}>
        <span className="banner-label">DEVELOPED BY</span>
        <span className="banner-shape">✦</span>
      </div>
      <div className="developer-body">
        <Avatar initials={developer.initials} tone={developer.tone} large />
        <div className="developer-copy">
          <p className="eyebrow">{developer.role}</p>
          <h3>{developer.name}</h3>
          <p>{developer.description}</p>
        </div>
        <div className="skill-list">
          {developer.skills.map((skill) => <span key={skill}>{skill}</span>)}
        </div>
        <div className="developer-links">
          <a className="primary-link" href={developer.website} target="_blank" rel="noreferrer">Visit website <span>↗</span></a>
          <a href={developer.github} target="_blank" rel="noreferrer">GitHub</a>
          <a href={developer.linkedin} target="_blank" rel="noreferrer">LinkedIn</a>
        </div>
      </div>
    </article>
  )
}

function ContributorCard({ contributor, onNavigate }) {
  return (
    <article className="contributor-card">
      <div className="contributor-top">
        <Avatar initials={contributor.initials} tone={contributor.tone} />
        <span className="verified">✓ Verified</span>
      </div>
      <h3>{contributor.name}</h3>
      <p className="contributor-meta">{contributor.program} <span>•</span> {contributor.branch}</p>
      <p className="muted">{contributor.semester}</p>
      <div className="contribution-count">
        <strong>{contributor.count}</strong>
        <span>approved contributions</span>
      </div>
      <div className="badge-row">
        {contributor.badges.map((badge) => <span key={badge}>{badge}</span>)}
      </div>
      <button className="text-link" onClick={() => onNavigate(`/contributors/${contributor.id}`)}>
        View contributions <span>→</span>
      </button>
    </article>
  )
}

function ResourceRow({ resource }) {
  return (
    <article className="resource-row">
      <div className="file-icon">PDF</div>
      <div className="resource-main">
        <h3>{resource.title}</h3>
        <p>{resource.subject} <span>•</span> {resource.branch} <span>•</span> {resource.semester}</p>
      </div>
      <span className="resource-type">{resource.type}</span>
      <button className="download" aria-label={`View ${resource.title}`}>View <span>↗</span></button>
    </article>
  )
}

function Home({ onNavigate }) {
  return (
    <main>
      <section className="hero-section">
        <div className="hero-copy">
          <p className="eyebrow">A community resource for curious minds</p>
          <h1>Your university.<br /><em>Your notes.</em><br />Your community.</h1>
          <p className="hero-text">A focused space for notes, question papers and the people who make learning here more generous.</p>
          <div className="hero-actions">
            <button className="primary-button" onClick={() => onNavigate('/resources')}>Explore resources <span>↗</span></button>
            <button className="secondary-button" onClick={() => onNavigate('/contributors')}>Meet contributors <span>→</span></button>
          </div>
          <div className="hero-proof">
            <span className="proof-avatars"><Avatar initials="AV" tone="gold" /><Avatar initials="SA" tone="violet" /><Avatar initials="DP" tone="mint" /></span>
            <span><strong>43 students</strong><br />sharing knowledge this month</span>
          </div>
        </div>
        <div className="hero-art" aria-label="Abstract illustration of shared study notes">
          <div className="sun"></div>
          <div className="paper paper-back"><span>SEM 03</span><i></i><i></i></div>
          <div className="paper paper-front"><span>Data Structures</span><b>01</b><i></i><i></i><i></i><small>community notes</small></div>
          <div className="art-caption">OPEN KNOWLEDGE<br /><strong>01 / 03</strong></div>
        </div>
      </section>
      <section className="intro-strip">
        <div><span className="section-number">01</span><h2>Built around how<br /><em>students actually study.</em></h2></div>
        <p>Find what you need by program, branch, semester or subject. Save a resource, share one back, and leave the next student a clearer path.</p>
        <div className="intro-stat"><strong>100%</strong><span>free to access</span></div>
      </section>
      <section className="content-section">
        <div className="section-heading"><div><p className="eyebrow">The latest additions</p><h2>Recently shared</h2></div><button className="section-link" onClick={() => onNavigate('/resources')}>View all resources <span>↗</span></button></div>
        <div className="resource-list">{resources.map((resource) => <ResourceRow key={resource.title} resource={resource} />)}</div>
      </section>
      <section className="contributors-section">
        <div className="section-heading"><div><p className="eyebrow">The people behind the library</p><h2>Top contributors</h2></div><button className="section-link" onClick={() => onNavigate('/contributors')}>Meet everyone <span>↗</span></button></div>
        <div className="contributor-grid">{contributors.map((contributor) => <ContributorCard key={contributor.id} contributor={contributor} onNavigate={onNavigate} />)}</div>
      </section>
      <section className="developers-section">
        <div className="section-heading"><div><p className="eyebrow">The makers of this space</p><h2>Developed by</h2></div><button className="section-link" onClick={() => onNavigate('/team')}>Meet the team <span>↗</span></button></div>
        <div className="developer-grid">{developers.map((developer) => <DeveloperCard key={developer.name} developer={developer} />)}</div>
      </section>
    </main>
  )
}

function App() {
  const [path, setPath] = useState(window.location.pathname)

  const navigate = (nextPath) => {
    window.history.pushState({}, '', nextPath)
    setPath(nextPath)
    window.scrollTo(0, 0)
  }

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
    page = <AdminPage onNavigate={navigate} currentPath={path} />
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
  } else if (path === '/register') {
    page = <AuthPage mode="register" onNavigate={navigate} />
  } else if (path === '/dashboard') {
    page = <DashboardPage onNavigate={navigate} />
  } else if (path === '/upload') {
    page = <UploadPage onNavigate={navigate} />
  } else if (path === '/bookmarks') {
    page = <SavedResourcesPage onNavigate={navigate} />
  } else if (path === '/recently-viewed') {
    page = <SavedResourcesPage mode="recent" onNavigate={navigate} />
  } else {
    page = <Home onNavigate={navigate} />
  }

  return (
    <div className="app-shell">
      <Header onNavigate={navigate} />
      {page}
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

