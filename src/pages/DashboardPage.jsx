import { useEffect, useState } from 'react'
import { useAuth } from '../context/useAuth.js'
import { api } from '../services/api.js'

function ResourceMiniList({ items, emptyTitle, emptyText, onNavigate }) {
  const validItems = items?.filter(Boolean) || []
  if (!validItems.length) {
    return (
      <div className="panel-empty-state">
        <p className="empty-panel-title">{emptyTitle}</p>
        <p className="empty-panel-desc">{emptyText}</p>
        <button className="panel-empty-btn" onClick={() => onNavigate('/resources')}>
          Explore resources →
        </button>
      </div>
    )
  }
  return (
    <div className="mini-resource-list">
      {validItems.slice(0, 5).map((item) => {
        const resource = item.resourceId || item
        if (!resource?._id) return null
        return (
          <article className="mini-resource-card" key={resource._id}>
            <div className="mini-card-icon">PDF</div>
            <div className="mini-card-main">
              <h4 onClick={() => onNavigate(`/resources/${resource._id}`)}>
                {resource.title}
              </h4>
              <div className="mini-card-meta">
                <span className="type-tag">{resource.resourceType || 'NOTES'}</span>
                <span>•</span>
                <span>{resource.academicYear || 'Study material'}</span>
              </div>
            </div>
            {resource.file?.url ? (
              <a
                className="mini-card-action"
                href={resource.file.url}
                target="_blank"
                rel="noreferrer"
                title="View document"
              >
                View ↗
              </a>
            ) : (
              <button
                className="mini-card-action"
                onClick={() => onNavigate(`/resources/${resource._id}`)}
              >
                Details →
              </button>
            )}
          </article>
        )
      })}
    </div>
  )
}

function Status({ value }) {
  return (
    <span className={`dashboard-status status-${value.toLowerCase()}`}>
      {value.replaceAll('_', ' ')}
    </span>
  )
}

export default function DashboardPage({ onNavigate }) {
  const { user, accessToken, updateProfile, logout } = useAuth()
  const [dashboard, setDashboard] = useState(null)
  const [profile, setProfile] = useState(user || {})
  const [profileMessage, setProfileMessage] = useState('')
  const [profileError, setProfileError] = useState('')

  useEffect(() => {
    if (accessToken) {
      api.getDashboard(accessToken).then(setDashboard).catch(() => setDashboard(null))
    }
  }, [accessToken])

  if (!user) {
    return (
      <main className="directory-page">
        <div className="directory-hero">
          <p className="eyebrow">MEMBER ACCESS</p>
          <h1>
            Sign in to<br /><em>your workspace.</em>
          </h1>
          <p>Your uploads, contribution history and saved resources live here.</p>
          <button className="primary-button" onClick={() => onNavigate('/login')}>
            Sign in ↗
          </button>
        </div>
      </main>
    )
  }

  const stats = dashboard?.statistics || {
    approvedContributions: 0,
    pendingContributions: 0,
    rejectedContributions: 0,
    changesRequested: 0,
    totalDownloads: 0,
    savedResources: 0,
    unreadNotifications: 0,
  }

  const saveProfile = async (event) => {
    event.preventDefault()
    setProfileMessage('')
    setProfileError('')
    try {
      await updateProfile({
        name: profile.name,
        bio: profile.bio,
        avatarUrl: profile.avatarUrl,
        githubUrl: profile.githubUrl,
        linkedinUrl: profile.linkedinUrl,
        publicProfile: profile.publicProfile,
      })
      setProfileMessage('Profile updated successfully.')
    } catch (error) {
      setProfileError(error.message)
    }
  }

  return (
    <main className="profile-page dashboard-page">
      <div className="dashboard-hero-card">
        <div className="avatar avatar-blue avatar-large dashboard-hero-avatar">
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt={user.name} className="avatar-img" />
          ) : (
            user.name?.slice(0, 2).toUpperCase()
          )}
        </div>
        <div className="dashboard-hero-info">
          <p className="eyebrow">STUDENT WORKSPACE</p>
          <h1>{user.name}</h1>
          <div className="dashboard-hero-meta">
            <span className="hero-email">{user.email}</span>
            <span>•</span>
            <span className="role-tag">{user.role}</span>
          </div>
        </div>
      </div>

      <div className="dashboard-metrics-grid">
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">Approved Uploads</span>
            <span className="metric-icon" aria-hidden="true">✓</span>
          </div>
          <strong className="metric-number">{stats.approvedContributions}</strong>
          <span className="metric-subtext">Verified study materials</span>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">Pending Uploads</span>
            <span className="metric-icon" aria-hidden="true">⏳</span>
          </div>
          <strong className="metric-number">{stats.pendingContributions}</strong>
          <span className="metric-subtext">Under moderator review</span>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">Total Downloads</span>
            <span className="metric-icon" aria-hidden="true">📥</span>
          </div>
          <strong className="metric-number">{stats.totalDownloads}</strong>
          <span className="metric-subtext">Peers helped on campus</span>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">Unread Notifications</span>
            <span className="metric-icon" aria-hidden="true">🔔</span>
          </div>
          <strong className="metric-number">{stats.unreadNotifications}</strong>
          <span className="metric-subtext">Activity alerts</span>
        </div>
      </div>

      <div className="dashboard-actions">
        <button className="primary-button" onClick={() => onNavigate('/upload')}>
          Upload a resource ↗
        </button>
        <button className="secondary-button" onClick={() => onNavigate('/bookmarks')}>
          Saved resources ({stats.savedResources})
        </button>
        <button className="secondary-button" onClick={() => onNavigate('/recently-viewed')}>
          Recently viewed →
        </button>
        <button className="secondary-button" onClick={() => onNavigate('/settings')}>
          Account settings ⚙️
        </button>
        <button
          className="text-link"
          onClick={() => {
            logout()
            onNavigate('/')
          }}
        >
          Log out workspace →
        </button>
      </div>

      <section className="dashboard-section">
        <div className="section-heading">
          <h2>My uploads</h2>
          <span className="status-summary-pill">
            {stats.rejectedContributions} rejected · {stats.changesRequested} changes requested
          </span>
        </div>
        {dashboard ? (
          <div className="dashboard-table">
            {dashboard.uploads.length ? (
              dashboard.uploads.map((upload) => (
                <article className="dashboard-upload" key={upload._id}>
                  <div className="upload-main">
                    <span className="upload-pdf-icon">PDF</span>
                    <div>
                      <h3>{upload.title}</h3>
                      <p>
                        {upload.subjectId?.name || 'Subject'} <span>•</span> {upload.resourceType}
                        {upload.academicYear ? ` • Year ${upload.academicYear}` : ''}
                      </p>
                    </div>
                  </div>
                  <Status value={upload.status} />
                  <span className="muted">{upload.downloadCount || 0} downloads</span>
                  {upload.rejectionReason && <p className="form-error">{upload.rejectionReason}</p>}
                  {upload.requestedChanges && (
                    <p className="form-error">Changes: {upload.requestedChanges}</p>
                  )}
                </article>
              ))
            ) : (
              <div className="dashboard-empty-card">
                <div className="empty-card-icon" aria-hidden="true">📄</div>
                <h3>No resources uploaded yet</h3>
                <p>
                  Share class notes, past exam questions, or lab manuals to earn verified contributor badges and help your peers.
                </p>
                <button className="primary-button" onClick={() => onNavigate('/upload')}>
                  Upload your first resource ↗
                </button>
              </div>
            )}
          </div>
        ) : (
          <p className="empty-state">Loading your uploads...</p>
        )}
      </section>

      <section className="dashboard-columns">
        <section className="dashboard-panel">
          <div className="panel-header">
            <h2>Saved resources</h2>
            <button className="panel-header-link" onClick={() => onNavigate('/bookmarks')}>
              View all ({stats.savedResources}) →
            </button>
          </div>
          <ResourceMiniList
            items={dashboard?.bookmarks?.map((item) => item.resourceId) || []}
            emptyTitle="No saved resources yet"
            emptyText="Bookmark high-yield study materials and question papers for quick access during exam revision."
            onNavigate={onNavigate}
          />
        </section>
        <section className="dashboard-panel">
          <div className="panel-header">
            <h2>Recently viewed</h2>
            <button className="panel-header-link" onClick={() => onNavigate('/recently-viewed')}>
              View history →
            </button>
          </div>
          <ResourceMiniList
            items={dashboard?.recentlyViewed?.map((item) => item.resourceId) || []}
            emptyTitle="Nothing viewed recently"
            emptyText="Any study guides or previous year papers you read will automatically appear here."
            onNavigate={onNavigate}
          />
        </section>
      </section>

      <section className="dashboard-section">
        <h2>My suggestions</h2>
        {dashboard?.suggestions?.length ? (
          <div className="suggestions-list">
            {dashboard.suggestions.map((suggestion) => (
              <article className="suggestion-row" key={suggestion._id}>
                <div>
                  <h3>{suggestion.title}</h3>
                  <p>{suggestion.description}</p>
                </div>
                <Status value={suggestion.status} />
              </article>
            ))}
          </div>
        ) : (
          <div className="dashboard-empty-card suggestions-empty">
            <p className="empty-panel-title">No suggestions submitted</p>
            <p className="empty-panel-desc">Have ideas to improve UniHub? Send curriculum or platform feedback anytime.</p>
          </div>
        )}
      </section>

      <section className="dashboard-section profile-editor">
        <h2>Profile information</h2>
        <form className="settings-form" onSubmit={saveProfile}>
          <div className="form-field">
            <label htmlFor="dash-name">Display Name</label>
            <input
              id="dash-name"
              value={profile.name || ''}
              onChange={(event) => setProfile({ ...profile, name: event.target.value })}
            />
          </div>
          <div className="form-field">
            <label htmlFor="dash-avatar-url">Avatar Image URL</label>
            <input
              id="dash-avatar-url"
              type="url"
              placeholder="https://..."
              value={profile.avatarUrl || ''}
              onChange={(event) => setProfile({ ...profile, avatarUrl: event.target.value })}
            />
          </div>
          <div className="form-field">
            <label htmlFor="dash-bio">Short Bio</label>
            <textarea
              id="dash-bio"
              rows="3"
              placeholder="A few words about what you study or topics you are passionate about..."
              value={profile.bio || ''}
              onChange={(event) => setProfile({ ...profile, bio: event.target.value })}
            />
          </div>
          <div className="form-row-2">
            <div className="form-field">
              <label htmlFor="dash-github">GitHub Profile URL</label>
              <input
                id="dash-github"
                type="url"
                placeholder="https://github.com/username"
                value={profile.githubUrl || ''}
                onChange={(event) => setProfile({ ...profile, githubUrl: event.target.value })}
              />
            </div>
            <div className="form-field">
              <label htmlFor="dash-linkedin">LinkedIn Profile URL</label>
              <input
                id="dash-linkedin"
                type="url"
                placeholder="https://linkedin.com/in/username"
                value={profile.linkedinUrl || ''}
                onChange={(event) => setProfile({ ...profile, linkedinUrl: event.target.value })}
              />
            </div>
          </div>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={profile.publicProfile !== false}
              onChange={(event) => setProfile({ ...profile, publicProfile: event.target.checked })}
            />
            <span>Show my contributor profile publicly</span>
          </label>
          {profileError && <p className="form-error">{profileError}</p>}
          {profileMessage && <p className="success-message">{profileMessage}</p>}
          <div className="form-actions">
            <button type="submit" className="primary-button">Save profile changes</button>
          </div>
        </form>
      </section>
    </main>
  )
}

