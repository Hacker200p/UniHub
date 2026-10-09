import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../context/useAuth.js'
import { api } from '../services/api.js'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api'

function GoogleIcon() {
  return (
    <svg className="provider-icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.27A7.17 7.17 0 0 1 4.9 12c0-.79.14-1.57.38-2.27V6.58H1.25A11.97 11.97 0 0 0 0 12c0 1.92.45 3.74 1.25 5.42l4.03-3.15z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
      />
    </svg>
  )
}

function GithubIcon() {
  return (
    <svg className="provider-icon" viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  )
}

function MicrosoftIcon() {
  return (
    <svg className="provider-icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path fill="#F25022" d="M1 1h10v10H1z" />
      <path fill="#7FBA00" d="M13 1h10v10H13z" />
      <path fill="#00A4EF" d="M1 13h10v10H1z" />
      <path fill="#FFB900" d="M13 13h10v10H13z" />
    </svg>
  )
}

export default function SettingsPage({ activeTab = 'profile', onNavigate }) {
  const { user, accessToken, updateProfile, logout, logoutAll } = useAuth()
  const [currentTab, setCurrentTab] = useState(activeTab)

  // Profile Form State
  const [profileForm, setProfileForm] = useState({
    name: user?.name || '',
    bio: user?.bio || '',
    avatarUrl: user?.avatarUrl || '',
    githubUrl: user?.githubUrl || '',
    linkedinUrl: user?.linkedinUrl || '',
    publicProfile: user?.publicProfile !== false,
  })
  const [profileStatus, setProfileStatus] = useState({ success: '', error: '', loading: false })

  // Security State
  const [securityData, setSecurityData] = useState(null)
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [showCurrentPass, setShowCurrentPass] = useState(false)
  const [showNewPass, setShowNewPass] = useState(false)
  const [securityStatus, setSecurityStatus] = useState({ success: '', error: '', loading: false })

  // Sessions State
  const [sessions, setSessions] = useState([])
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [sessionMessage, setSessionMessage] = useState('')

  // Privacy State
  const [privacySettings, setPrivacySettings] = useState({
    publicProfile: true,
    showAvatar: true,
    showBio: true,
    showGithub: true,
    showLinkedin: true,
    showAcademicInfo: true,
  })
  const [privacyStatus, setPrivacyStatus] = useState({ success: '', error: '', loading: false })

  // Notifications State
  const [notifications, setNotifications] = useState([])
  const [notificationsLoading, setNotificationsLoading] = useState(false)

  // Sync tab with props
  useEffect(() => {
    setCurrentTab(activeTab)
  }, [activeTab])

  // Load Security Details
  const loadSecurity = useCallback(async () => {
    if (!accessToken) return
    try {
      const data = await api.getUserSecurity(accessToken)
      setSecurityData(data)
    } catch {
      // ignore
    }
  }, [accessToken])

  // Load Sessions
  const loadSessions = useCallback(async () => {
    if (!accessToken) return
    setSessionsLoading(true)
    try {
      const data = await api.listUserSessions(accessToken)
      setSessions(data || [])
    } catch {
      setSessions([])
    } finally {
      setSessionsLoading(false)
    }
  }, [accessToken])

  // Load Notifications
  const loadNotifications = useCallback(async () => {
    if (!accessToken) return
    setNotificationsLoading(true)
    try {
      const data = await api.listNotifications(accessToken)
      setNotifications(data || [])
    } catch {
      setNotifications([])
    } finally {
      setNotificationsLoading(false)
    }
  }, [accessToken])

  useEffect(() => {
    if (user) {
      setProfileForm({
        name: user.name || '',
        bio: user.bio || '',
        avatarUrl: user.avatarUrl || '',
        githubUrl: user.githubUrl || '',
        linkedinUrl: user.linkedinUrl || '',
        publicProfile: user.publicProfile !== false,
      })
      if (user.privacySettings) {
        setPrivacySettings({
          publicProfile: user.publicProfile !== false,
          showAvatar: user.privacySettings.showAvatar !== false,
          showBio: user.privacySettings.showBio !== false,
          showGithub: user.privacySettings.showGithub !== false,
          showLinkedin: user.privacySettings.showLinkedin !== false,
          showAcademicInfo: user.privacySettings.showAcademicInfo !== false,
        })
      }
    }
  }, [user])

  useEffect(() => {
    if (currentTab === 'security') loadSecurity()
    if (currentTab === 'sessions') loadSessions()
    if (currentTab === 'notifications') loadNotifications()
  }, [currentTab, loadSecurity, loadSessions, loadNotifications])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const successMsg = params.get('success')
    const errorMsg = params.get('error')
    if (successMsg) {
      setSecurityStatus({ success: decodeURIComponent(successMsg), error: '', loading: false })
      window.history.replaceState({}, document.title, window.location.pathname)
    } else if (errorMsg) {
      setSecurityStatus({ success: '', error: decodeURIComponent(errorMsg), loading: false })
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }, [])

  if (!user) {
    return (
      <main className="directory-page">
        <div className="directory-hero">
          <p className="eyebrow">SETTINGS & SECURITY</p>
          <h1>Please sign in</h1>
          <p>You must be signed in to manage your account settings and security credentials.</p>
          <button className="primary-button" onClick={() => onNavigate('/login')}>
            Sign in ↗
          </button>
        </div>
      </main>
    )
  }

  // --- Handlers ---

  const handleProfileSubmit = async (event) => {
    event.preventDefault()
    setProfileStatus({ success: '', error: '', loading: true })
    try {
      await updateProfile(profileForm)
      setProfileStatus({ success: 'Profile updated successfully.', error: '', loading: false })
    } catch (err) {
      setProfileStatus({ success: '', error: err.message, loading: false })
    }
  }

  const handlePasswordSubmit = async (event) => {
    event.preventDefault()
    setSecurityStatus({ success: '', error: '', loading: true })

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setSecurityStatus({ success: '', error: 'New passwords do not match.', loading: false })
      return
    }

    try {
      await api.setPassword(accessToken, {
        currentPassword: passwordForm.currentPassword || undefined,
        newPassword: passwordForm.newPassword,
        confirmPassword: passwordForm.confirmPassword,
      })
      setSecurityStatus({
        success: securityData?.hasPassword ? 'Password updated successfully.' : 'Password created successfully.',
        error: '',
        loading: false,
      })
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      loadSecurity()
    } catch (err) {
      setSecurityStatus({ success: '', error: err.message, loading: false })
    }
  }

  const handleConnectProvider = async (provider) => {
    try {
      setSecurityStatus({ success: '', error: '', loading: true })
      const res = await api.getOAuthUrl(provider, 'link', accessToken)
      const targetUrl = res?.data?.url || res?.url
      if (targetUrl) {
        window.location.href = targetUrl
      } else {
        window.location.href = `${API_URL}/auth/${provider}?intent=link&token=${encodeURIComponent(accessToken)}`
      }
    } catch {
      window.location.href = `${API_URL}/auth/${provider}?intent=link&token=${encodeURIComponent(accessToken)}`
    }
  }

  const handleUnlinkProvider = async (provider) => {
    if (!window.confirm(`Are you sure you want to disconnect ${provider}?`)) return
    setSecurityStatus({ success: '', error: '', loading: true })
    try {
      await api.unlinkProvider(accessToken, provider)
      setSecurityStatus({
        success: `${provider.charAt(0).toUpperCase() + provider.slice(1)} account disconnected.`,
        error: '',
        loading: false,
      })
      loadSecurity()
    } catch (err) {
      setSecurityStatus({ success: '', error: err.message, loading: false })
    }
  }

  const handleRevokeSession = async (sessionId) => {
    try {
      await api.revokeUserSession(accessToken, sessionId)
      setSessionMessage('Session revoked.')
      loadSessions()
    } catch (err) {
      setSessionMessage(err.message || 'Failed to revoke session.')
    }
  }

  const handleLogoutOthers = async () => {
    try {
      await api.logoutOtherSessions(accessToken)
      setSessionMessage('All other sessions were logged out.')
      loadSessions()
    } catch (err) {
      setSessionMessage(err.message || 'Failed to logout other sessions.')
    }
  }

  const handlePrivacySubmit = async (event) => {
    event.preventDefault()
    setPrivacyStatus({ success: '', error: '', loading: true })
    try {
      await api.updatePrivacySettings(accessToken, privacySettings)
      setPrivacyStatus({ success: 'Privacy preferences updated.', error: '', loading: false })
    } catch (err) {
      setPrivacyStatus({ success: '', error: err.message, loading: false })
    }
  }

  const handleMarkNotificationsRead = async () => {
    try {
      await api.markNotificationsRead(accessToken)
      loadNotifications()
    } catch {
      // ignore
    }
  }

  const isProviderLinked = (providerName) => {
    return securityData?.authProviders?.find((p) => p.provider === providerName)
  }

  const canUnlink = (providerName) => {
    if (!securityData) return false
    const totalMethods = (securityData.hasPassword ? 1 : 0) + (securityData.authProviders?.length || 0)
    return totalMethods > 1
  }

  return (
    <main className="settings-page">
      <div className="settings-container">
        <header className="settings-header">
          <p className="eyebrow">ACCOUNT MANAGEMENT</p>
          <h1>Settings & Workspace</h1>
          <p className="muted">Manage your credentials, connected identity providers, sessions, and privacy.</p>
        </header>

        <div className="settings-layout">
          {/* Settings Navigation Sidebar / Tabs */}
          <nav className="settings-tabs" aria-label="Settings navigation">
            <button
              className={`tab-btn ${currentTab === 'profile' ? 'active' : ''}`}
              onClick={() => {
                setCurrentTab('profile')
                onNavigate('/settings')
              }}
            >
              👤 Profile
            </button>
            <button
              className={`tab-btn ${currentTab === 'security' ? 'active' : ''}`}
              onClick={() => {
                setCurrentTab('security')
                onNavigate('/settings/security')
              }}
            >
              🔒 Security & Accounts
            </button>
            <button
              className={`tab-btn ${currentTab === 'sessions' ? 'active' : ''}`}
              onClick={() => {
                setCurrentTab('sessions')
                onNavigate('/settings/sessions')
              }}
            >
              📱 Active Sessions
            </button>
            <button
              className={`tab-btn ${currentTab === 'privacy' ? 'active' : ''}`}
              onClick={() => {
                setCurrentTab('privacy')
                onNavigate('/settings/privacy')
              }}
            >
              🛡️ Privacy Settings
            </button>
            <button
              className={`tab-btn ${currentTab === 'notifications' ? 'active' : ''}`}
              onClick={() => {
                setCurrentTab('notifications')
                onNavigate('/settings/notifications')
              }}
            >
              🔔 Notifications
            </button>
          </nav>

          {/* Tab Content Panel */}
          <section className="settings-content-panel">
            {/* 1. PROFILE TAB */}
            {currentTab === 'profile' && (
              <div className="tab-pane">
                <div className="tab-header">
                  <h2>Public Profile</h2>
                  <p className="muted">Information that will represent your academic contributions.</p>
                </div>

                <form onSubmit={handleProfileSubmit} className="settings-form">
                  <div className="avatar-preview-section">
                    <div className="avatar avatar-blue avatar-large">
                      {profileForm.avatarUrl ? (
                        <img src={profileForm.avatarUrl} alt={user.name} className="avatar-img" />
                      ) : (
                        user.name?.slice(0, 2).toUpperCase()
                      )}
                    </div>
                    <div>
                      <h3>{user.name}</h3>
                      <p className="muted">{user.email} · {user.role}</p>
                    </div>
                  </div>

                  <label>
                    Display Name
                    <input
                      required
                      value={profileForm.name}
                      onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                    />
                  </label>

                  <label>
                    Avatar Image URL
                    <input
                      type="url"
                      placeholder="https://..."
                      value={profileForm.avatarUrl}
                      onChange={(e) => setProfileForm({ ...profileForm, avatarUrl: e.target.value })}
                    />
                  </label>

                  <label>
                    Bio
                    <textarea
                      rows="3"
                      placeholder="Tell peers what you study or what resources you specialize in..."
                      value={profileForm.bio}
                      onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
                    />
                  </label>

                  <label>
                    GitHub Profile URL
                    <input
                      type="url"
                      placeholder="https://github.com/your-username"
                      value={profileForm.githubUrl}
                      onChange={(e) => setProfileForm({ ...profileForm, githubUrl: e.target.value })}
                    />
                  </label>

                  <label>
                    LinkedIn Profile URL
                    <input
                      type="url"
                      placeholder="https://linkedin.com/in/your-profile"
                      value={profileForm.linkedinUrl}
                      onChange={(e) => setProfileForm({ ...profileForm, linkedinUrl: e.target.value })}
                    />
                  </label>

                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={profileForm.publicProfile}
                      onChange={(e) =>
                        setProfileForm({ ...profileForm, publicProfile: e.target.checked })
                      }
                    />
                    Display my profile on the public Contributors directory
                  </label>

                  {profileStatus.error && <p className="form-error">{profileStatus.error}</p>}
                  {profileStatus.success && <p className="success-message">{profileStatus.success}</p>}

                  <button className="primary-button" disabled={profileStatus.loading}>
                    {profileStatus.loading ? 'Saving...' : 'Save Profile Changes'} <span>↗</span>
                  </button>
                </form>
              </div>
            )}

            {/* 2. SECURITY & CONNECTED ACCOUNTS TAB */}
            {currentTab === 'security' && (
              <div className="tab-pane">
                <div className="tab-header">
                  <h2>Security & Connected Accounts</h2>
                  <p className="muted">Manage your social authentication providers and university password.</p>
                </div>

                {securityStatus.error && <p className="form-error">{securityStatus.error}</p>}
                {securityStatus.success && <p className="success-message">{securityStatus.success}</p>}

                {/* Connected Social Accounts */}
                <div className="security-section">
                  <h3>Connected Accounts</h3>
                  <p className="muted">
                    Sign in seamlessly with verified university-authorized third-party providers.
                  </p>

                  <div className="connected-providers-list">
                    {/* Google */}
                    <div className="provider-card">
                      <div className="provider-info">
                        <GoogleIcon />
                        <div>
                          <strong>Google</strong>
                          {isProviderLinked('google') ? (
                            <span className="linked-badge">
                              ✓ Connected ({isProviderLinked('google').email})
                            </span>
                          ) : (
                            <span className="unlinked-badge">Not connected</span>
                          )}
                        </div>
                      </div>
                      <div className="provider-actions">
                        {isProviderLinked('google') ? (
                          <button
                            type="button"
                            className="disconnect-btn"
                            disabled={!canUnlink('google') || securityStatus.loading}
                            onClick={() => handleUnlinkProvider('google')}
                            title={!canUnlink('google') ? 'Cannot disconnect sole login method' : ''}
                          >
                            Disconnect
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="connect-btn"
                            onClick={() => handleConnectProvider('google')}
                          >
                            Connect
                          </button>
                        )}
                      </div>
                    </div>

                    {/* GitHub */}
                    <div className="provider-card">
                      <div className="provider-info">
                        <GithubIcon />
                        <div>
                          <strong>GitHub</strong>
                          {isProviderLinked('github') ? (
                            <span className="linked-badge">
                              ✓ Connected ({isProviderLinked('github').email})
                            </span>
                          ) : (
                            <span className="unlinked-badge">Not connected</span>
                          )}
                        </div>
                      </div>
                      <div className="provider-actions">
                        {isProviderLinked('github') ? (
                          <button
                            type="button"
                            className="disconnect-btn"
                            disabled={!canUnlink('github') || securityStatus.loading}
                            onClick={() => handleUnlinkProvider('github')}
                            title={!canUnlink('github') ? 'Cannot disconnect sole login method' : ''}
                          >
                            Disconnect
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="connect-btn"
                            onClick={() => handleConnectProvider('github')}
                          >
                            Connect
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Microsoft */}
                    <div className="provider-card">
                      <div className="provider-info">
                        <MicrosoftIcon />
                        <div>
                          <strong>Microsoft</strong>
                          {isProviderLinked('microsoft') ? (
                            <span className="linked-badge">
                              ✓ Connected ({isProviderLinked('microsoft').email})
                            </span>
                          ) : (
                            <span className="unlinked-badge">Not connected</span>
                          )}
                        </div>
                      </div>
                      <div className="provider-actions">
                        {isProviderLinked('microsoft') ? (
                          <button
                            type="button"
                            className="disconnect-btn"
                            disabled={!canUnlink('microsoft') || securityStatus.loading}
                            onClick={() => handleUnlinkProvider('microsoft')}
                            title={!canUnlink('microsoft') ? 'Cannot disconnect sole login method' : ''}
                          >
                            Disconnect
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="connect-btn"
                            onClick={() => handleConnectProvider('microsoft')}
                          >
                            Connect
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Set or Change Password */}
                <div className="security-section">
                  <h3>{securityData?.hasPassword ? 'Change Password' : 'Create Password'}</h3>
                  <p className="muted">
                    {securityData?.hasPassword
                      ? 'Ensure your password is at least 12 characters long and uses a mix of character types.'
                      : 'You currently authenticate using a connected social account. Set a password to allow signing in directly with email.'}
                  </p>

                  <form onSubmit={handlePasswordSubmit} className="settings-form">
                    {securityData?.hasPassword && (
                      <label>
                        Current Password
                        <div className="password-input-wrap">
                          <input
                            required
                            type={showCurrentPass ? 'text' : 'password'}
                            value={passwordForm.currentPassword}
                            onChange={(e) =>
                              setPasswordForm({ ...passwordForm, currentPassword: e.target.value })
                            }
                          />
                          <button
                            type="button"
                            className="password-toggle-btn"
                            onClick={() => setShowCurrentPass(!showCurrentPass)}
                          >
                            {showCurrentPass ? 'Hide' : 'Show'}
                          </button>
                        </div>
                      </label>
                    )}

                    <label>
                      New Password
                      <div className="password-input-wrap">
                        <input
                          required
                          minLength="12"
                          type={showNewPass ? 'text' : 'password'}
                          value={passwordForm.newPassword}
                          onChange={(e) =>
                            setPasswordForm({ ...passwordForm, newPassword: e.target.value })
                          }
                        />
                        <button
                          type="button"
                          className="password-toggle-btn"
                          onClick={() => setShowNewPass(!showNewPass)}
                        >
                          {showNewPass ? 'Hide' : 'Show'}
                        </button>
                      </div>
                    </label>

                    <label>
                      Confirm New Password
                      <input
                        required
                        minLength="12"
                        type={showNewPass ? 'text' : 'password'}
                        value={passwordForm.confirmPassword}
                        onChange={(e) =>
                          setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })
                        }
                      />
                    </label>

                    <button className="primary-button" disabled={securityStatus.loading}>
                      {securityStatus.loading
                        ? 'Updating...'
                        : securityData?.hasPassword
                        ? 'Update Password'
                        : 'Create Password'}{' '}
                      <span>↗</span>
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* 3. ACTIVE SESSIONS TAB */}
            {currentTab === 'sessions' && (
              <div className="tab-pane">
                <div className="tab-header session-tab-header">
                  <div>
                    <h2>Active Login Sessions</h2>
                    <p className="muted">
                      Review all devices currently signed in to your university account.
                    </p>
                  </div>
                  <div className="session-header-actions">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={handleLogoutOthers}
                      disabled={sessions.length <= 1}
                    >
                      Log Out Other Sessions
                    </button>
                    <button
                      type="button"
                      className="danger-button"
                      onClick={() => {
                        logoutAll()
                        onNavigate('/')
                      }}
                    >
                      Log Out All Devices
                    </button>
                  </div>
                </div>

                {sessionMessage && <p className="success-message">{sessionMessage}</p>}

                {sessionsLoading ? (
                  <p className="empty-state">Loading active sessions...</p>
                ) : sessions.length ? (
                  <div className="sessions-list">
                    {sessions.map((sess) => (
                      <article
                        className={`session-card ${sess.isCurrentSession ? 'current-session' : ''}`}
                        key={sess.id}
                      >
                        <div className="session-icon">
                          {sess.device?.deviceType === 'mobile' ? '📱' : '💻'}
                        </div>
                        <div className="session-details">
                          <div className="session-title-row">
                            <strong>
                              {sess.device?.browser || 'Browser'} on {sess.device?.os || 'System'}
                            </strong>
                            {sess.isCurrentSession && (
                              <span className="current-badge">This Device (Current)</span>
                            )}
                          </div>
                          <p className="muted session-meta">
                            Signed in: {new Date(sess.createdAt).toLocaleDateString()}
                          </p>
                          <p className="muted session-last-used">
                            Last active: {new Date(sess.lastUsedAt || sess.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <div className="session-action">
                          {sess.isCurrentSession ? (
                            <button
                              type="button"
                              className="disconnect-btn"
                              onClick={() => {
                                logout()
                                onNavigate('/')
                              }}
                            >
                              Sign Out
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="disconnect-btn"
                              onClick={() => handleRevokeSession(sess.id)}
                            >
                              Revoke
                            </button>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="empty-state">No active sessions found.</p>
                )}
              </div>
            )}

            {/* 4. PRIVACY TAB */}
            {currentTab === 'privacy' && (
              <div className="tab-pane">
                <div className="tab-header">
                  <h2>Privacy Preferences</h2>
                  <p className="muted">Control what information other students and visitors can see.</p>
                </div>

                {privacyStatus.error && <p className="form-error">{privacyStatus.error}</p>}
                {privacyStatus.success && <p className="success-message">{privacyStatus.success}</p>}

                <form onSubmit={handlePrivacySubmit} className="settings-form">
                  <div className="privacy-toggles">
                    <label className="checkbox-label toggle-card">
                      <input
                        type="checkbox"
                        checked={privacySettings.publicProfile}
                        onChange={(e) =>
                          setPrivacySettings({ ...privacySettings, publicProfile: e.target.checked })
                        }
                      />
                      <div>
                        <strong>Public Contributor Profile</strong>
                        <p className="muted">Allow your name and profile to appear on public contributor lists.</p>
                      </div>
                    </label>

                    <label className="checkbox-label toggle-card">
                      <input
                        type="checkbox"
                        checked={privacySettings.showAvatar}
                        onChange={(e) =>
                          setPrivacySettings({ ...privacySettings, showAvatar: e.target.checked })
                        }
                      />
                      <div>
                        <strong>Show Profile Avatar</strong>
                        <p className="muted">Display your avatar alongside resources and contributions.</p>
                      </div>
                    </label>

                    <label className="checkbox-label toggle-card">
                      <input
                        type="checkbox"
                        checked={privacySettings.showBio}
                        onChange={(e) =>
                          setPrivacySettings({ ...privacySettings, showBio: e.target.checked })
                        }
                      />
                      <div>
                        <strong>Show Bio</strong>
                        <p className="muted">Include your biography text on your public profile card.</p>
                      </div>
                    </label>

                    <label className="checkbox-label toggle-card">
                      <input
                        type="checkbox"
                        checked={privacySettings.showGithub}
                        onChange={(e) =>
                          setPrivacySettings({ ...privacySettings, showGithub: e.target.checked })
                        }
                      />
                      <div>
                        <strong>Show GitHub Profile Link</strong>
                        <p className="muted">Allow peers to find your GitHub profile.</p>
                      </div>
                    </label>

                    <label className="checkbox-label toggle-card">
                      <input
                        type="checkbox"
                        checked={privacySettings.showLinkedin}
                        onChange={(e) =>
                          setPrivacySettings({ ...privacySettings, showLinkedin: e.target.checked })
                        }
                      />
                      <div>
                        <strong>Show LinkedIn Profile Link</strong>
                        <p className="muted">Allow peers to connect with you on LinkedIn.</p>
                      </div>
                    </label>

                    <label className="checkbox-label toggle-card">
                      <input
                        type="checkbox"
                        checked={privacySettings.showAcademicInfo}
                        onChange={(e) =>
                          setPrivacySettings({ ...privacySettings, showAcademicInfo: e.target.checked })
                        }
                      />
                      <div>
                        <strong>Show Program & Academic Info</strong>
                        <p className="muted">Display your program, branch, and semester on contributions.</p>
                      </div>
                    </label>
                  </div>

                  <button className="primary-button" disabled={privacyStatus.loading}>
                    {privacyStatus.loading ? 'Saving...' : 'Save Privacy Settings'} <span>↗</span>
                  </button>
                </form>
              </div>
            )}

            {/* 5. NOTIFICATIONS TAB */}
            {currentTab === 'notifications' && (
              <div className="tab-pane">
                <div className="tab-header session-tab-header">
                  <div>
                    <h2>Security & System Notifications</h2>
                    <p className="muted">Recent security alerts, contribution updates, and system notices.</p>
                  </div>
                  {notifications.some((n) => !n.isRead) && (
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={handleMarkNotificationsRead}
                    >
                      Mark All as Read
                    </button>
                  )}
                </div>

                {notificationsLoading ? (
                  <p className="empty-state">Loading notifications...</p>
                ) : notifications.length ? (
                  <div className="notifications-list">
                    {notifications.map((notif) => (
                      <article
                        key={notif._id}
                        className={`notification-item ${!notif.isRead ? 'unread' : ''}`}
                      >
                        <div className="notification-meta">
                          <span className="notif-type">{notif.type}</span>
                          <span className="muted">{new Date(notif.createdAt).toLocaleString()}</span>
                        </div>
                        <h3>{notif.title}</h3>
                        <p>{notif.message}</p>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="empty-state">No notifications right now.</p>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  )
}
