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
                href={api.getResourceFileUrl(resource.file.url)}
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
  const { user, accessToken } = useAuth()
  const [dashboard, setDashboard] = useState(null)

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
          <p className="eyebrow">YOUR UNI HUB</p>
          <h1>Welcome back, {user.name}</h1>
          <div className="dashboard-hero-meta">
            <span>Your resources, activity, and updates in one place.</span>
            <span className="role-tag">{user.role === 'STUDENT' ? 'Student' : user.role}</span>
          </div>
        </div>
        <div className="dashboard-hero-actions">
          <button className="primary-button" onClick={() => onNavigate('/upload')}>Upload Resource ↗</button>
          <button className="secondary-button" onClick={() => onNavigate('/resources')}>Explore Resources</button>
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

        <button
          type="button"
          className="metric-card metric-card-action"
          onClick={() => document.getElementById('dashboard-uploads')?.scrollIntoView({ behavior: 'smooth' })}
          title="View your pending uploads"
        >
          <div className="metric-header">
            <span className="metric-label">Pending Uploads</span>
            <span className="metric-icon" aria-hidden="true">⏳</span>
          </div>
          <strong className="metric-number">{stats.pendingContributions}</strong>
          <span className="metric-subtext">Under moderator review</span>
        </button>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">Total Downloads</span>
            <span className="metric-icon" aria-hidden="true">📥</span>
          </div>
          <strong className="metric-number">{stats.totalDownloads}</strong>
          <span className="metric-subtext">Peers helped on campus</span>
        </div>

        <button
          type="button"
          className="metric-card metric-card-action"
          onClick={() => {
            const el = document.getElementById('dashboard-notifications')
            if (el) el.scrollIntoView({ behavior: 'smooth' })
            else onNavigate('/settings/notifications')
          }}
          style={{ cursor: 'pointer' }}
          title="Click to view notifications and messages"
        >
          <div className="metric-header">
            <span className="metric-label">Unread Notifications</span>
            <span className="metric-icon" aria-hidden="true">🔔</span>
          </div>
          <strong className="metric-number">{stats.unreadNotifications}</strong>
          <span className="metric-subtext">Click to view alerts →</span>
        </button>
      </div>

      <div className="dashboard-actions">
        <button className="primary-button" onClick={() => onNavigate('/upload')}>
          Upload a resource ↗
        </button>
        <button
          className="secondary-button"
          onClick={() => {
            const el = document.getElementById('dashboard-notifications')
            if (el) el.scrollIntoView({ behavior: 'smooth' })
            else onNavigate('/settings/notifications')
          }}
        >
          🔔 Notifications & Messages ({stats.unreadNotifications})
        </button>
        <button className="secondary-button" onClick={() => onNavigate('/bookmarks')}>
          Saved resources ({stats.savedResources})
        </button>
        <button className="secondary-button" onClick={() => onNavigate('/recently-viewed')}>
          Recently viewed →
        </button>
        <button className="secondary-button" onClick={() => onNavigate('/settings')}>
          Profile settings →
        </button>
      </div>

      {/* NOTIFICATIONS & MESSAGES SECTION */}
      <section className="dashboard-section" id="dashboard-notifications">
        <div className="section-heading">
          <h2>Notifications & Messages</h2>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span className="status-summary-pill">
              {stats.unreadNotifications} unread
            </span>
            {dashboard?.notifications?.some((n) => !n.isRead) && (
              <button
                className="text-link"
                onClick={async () => {
                  try {
                    await api.markNotificationsRead(accessToken)
                    const updated = await api.getDashboard(accessToken)
                    setDashboard(updated)
                  } catch (e) {
                    console.error(e)
                  }
                }}
              >
                Mark all as read ✓
              </button>
            )}
          </div>
        </div>

        {dashboard?.notifications && dashboard.notifications.length > 0 ? (
          <div className="notifications-list">
            {dashboard.notifications.slice(0, 3).map((notif) => (
              <article
                key={notif._id}
                className={`notification-item ${!notif.isRead ? 'unread' : ''}`}
                style={{
                  background: notif.type === 'CHANGES_REQUESTED' ? '#fffbeb' : notif.type === 'REPORT_DISMISSED' ? '#fef2f2' : undefined,
                  borderColor: notif.type === 'CHANGES_REQUESTED' ? '#fde68a' : notif.type === 'REPORT_DISMISSED' ? '#fecaca' : undefined,
                }}
              >
                <div className="notification-meta">
                  <span className={`notif-type ${notif.type === 'CHANGES_REQUESTED' ? 'notif-changes' : ''}`}>
                    {notif.type?.replace(/_/g, ' ')}
                  </span>
                  <span className="muted">{new Date(notif.createdAt).toLocaleString()}</span>
                </div>
                <h3>{notif.title}</h3>
                <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{notif.message}</p>
                <div style={{ marginTop: 10, display: 'flex', gap: 12 }}>
                  {notif.resourceId && !notif.reportId && (
                    <button
                      className="text-link"
                      onClick={() => onNavigate(`/resources/${notif.resourceId._id || notif.resourceId}`)}
                    >
                      View Resource ↗
                    </button>
                  )}
                  {notif.requestId && (
                    <button
                      className="text-link"
                      onClick={() => onNavigate('/requests')}
                    >
                      View Requests ↗
                    </button>
                  )}
                  {notif.reportId && (
                    notif.resourceId ? (
                      <button
                        className="text-link"
                        onClick={() => onNavigate(`/resources/${notif.resourceId._id || notif.resourceId}`)}
                      >
                        View reported resource ↗
                      </button>
                    ) : (
                      <span className="muted">The reported record is no longer available.</span>
                    )
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="dashboard-compact-empty notifications-empty">
            <h3>No messages or notifications yet</h3>
            <p>Updates from administrators will appear here.</p>
          </div>
        )}
        {dashboard?.notifications?.length > 3 && (
          <button className="panel-header-link" onClick={() => onNavigate('/settings/notifications')}>View all notifications →</button>
        )}
      </section>

      <section className="dashboard-section" id="dashboard-uploads">
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
                  <button className="text-link" onClick={() => onNavigate(`/resources/${upload._id}`)}>View details →</button>
                  <Status value={upload.status} />
                  <span className="muted">{upload.downloadCount || 0} downloads</span>
                  {upload.requestedChanges && (
                    <div className="upload-feedback-banner changes-banner" style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: '10px 14px', marginTop: 8 }}>
                      <strong style={{ color: '#b45309', display: 'block', marginBottom: 4 }}>⚠️ Administrator Requested Changes:</strong>
                      <p style={{ margin: 0, color: '#92400e', fontSize: 13, whiteSpace: 'pre-wrap' }}>{upload.requestedChanges}</p>
                    </div>
                  )}
                  {upload.rejectionReason && (
                    <div className="upload-feedback-banner rejection-banner" style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '10px 14px', marginTop: 8 }}>
                      <strong style={{ color: '#b91c1c', display: 'block', marginBottom: 4 }}>❌ Rejection Reason:</strong>
                      <p style={{ margin: 0, color: '#991b1b', fontSize: 13, whiteSpace: 'pre-wrap' }}>{upload.rejectionReason}</p>
                    </div>
                  )}
                </article>
              ))
            ) : (
              <div className="dashboard-compact-empty">
                <h3>No resources uploaded yet</h3>
                <p>
                  Share notes, past exam questions, or lab materials with your university community.
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
          <div className="dashboard-compact-empty suggestions-empty">
            <p className="empty-panel-title">No suggestions submitted</p>
            <p className="empty-panel-desc">Have ideas to improve UniHub? Send curriculum or platform feedback anytime.</p>
          </div>
        )}
      </section>

      <section className="dashboard-section dashboard-settings-link">
        <h2>Profile and account</h2>
        <p>Update your display name, avatar, bio, public contributor profile, and connected links in Settings.</p>
        <button className="secondary-button" onClick={() => onNavigate('/settings')}>Open Profile Settings →</button>
      </section>
    </main>
  )
}
