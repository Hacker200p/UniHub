import { useEffect, useState, useMemo, useCallback } from 'react'
import { useAuth } from '../context/useAuth.js'
import { api } from '../services/api.js'

function formatDate(dateStr) {
  if (!dateStr) return '-'
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

function formatDateTime(dateStr) {
  if (!dateStr) return '-'
  try {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateStr
  }
}

function MetricCard({ label, value, note, color, onClick }) {
  const content = (
    <>
      <span className="metric-label">{label}</span>
      <strong className="metric-value">{value ?? '0'}</strong>
      {note && <span className="metric-note">{note}</span>}
    </>
  )
  return onClick ? (
    <button type="button" className={`admin-metric-card admin-metric-button ${color ? `metric-${color}` : ''}`} onClick={onClick}>
      {content}
    </button>
  ) : (
    <div className={`admin-metric-card ${color ? `metric-${color}` : ''}`}>
      {content}
    </div>
  )
}

function StatusBadge({ status }) {
  const norm = (status || 'UNKNOWN').toUpperCase()
  let cls = 'status-pill'
  if (['APPROVED', 'ACTIVE', 'RESOLVED', 'COMPLETED', 'FULFILLED'].includes(norm)) cls += ' status-approved'
  else if (['PENDING_REVIEW', 'OPEN', 'INVESTIGATING', 'IN_PROGRESS'].includes(norm)) cls += ' status-pending'
  else if (['REJECTED', 'SUSPENDED', 'DISMISSED'].includes(norm)) cls += ' status-rejected'
  else if (['CHANGES_REQUESTED'].includes(norm)) cls += ' status-changes'
  return <span className={cls}>{norm.replace('_', ' ')}</span>
}

function Modal({ title, onClose, children }) {
  return (
    <div className="admin-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="admin-modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal-header">
          <h3>{title}</h3>
          <button className="admin-modal-close" onClick={onClose} aria-label="Close modal">✕</button>
        </div>
        <div className="admin-modal-body">{children}</div>
      </div>
    </div>
  )
}

// 1. DASHBOARD VIEW
function AdminDashboardView({ overview, onNavigateTab, currentUser }) {
  const stats = overview?.statistics || {}
  const activity = overview?.recentActivity || {}

  return (
    <div className="admin-section-content">
      <div className="admin-header-row">
        <div>
          <p className="eyebrow">STAFF WORKSPACE</p>
          <h2>Admin Workspace</h2>
          <p className="admin-dashboard-subtitle">Monitor study resources, review reports, and manage the UniHub academic community.</p>
        </div>
        <div className="admin-dashboard-profile">
          <div className="avatar avatar-blue avatar-small">
            {currentUser?.avatarUrl ? (
              <img src={currentUser.avatarUrl} alt="" className="avatar-img" />
            ) : (
              currentUser?.name?.slice(0, 2).toUpperCase() || 'AD'
            )}
          </div>
          <div>
            <strong>{currentUser?.name || 'Administrator'}</strong>
            <span>{currentUser?.role === 'MODERATOR' ? 'Moderator' : 'Administrator'}</span>
          </div>
        </div>
        <div className="admin-quick-actions">
          <button className="primary-button" onClick={() => onNavigateTab('uploads')}>
            Review Pending ({stats.pendingUploads || 0}) ↗
          </button>
          <button className="secondary-button" onClick={() => onNavigateTab('analytics')}>
            View Analytics →
          </button>
        </div>
      </div>

      <div className="admin-metrics-grid">
        <MetricCard label="Pending Reviews" value={stats.pendingUploads} color="orange" note="Awaiting moderation" onClick={() => onNavigateTab('uploads')} />
        <MetricCard label="Open Reports" value={stats.pendingReports} color="red" note="Needs investigation" onClick={() => onNavigateTab('reports')} />
        <MetricCard label="Open Resource Requests" value={stats.openRequests} note="Awaiting response" onClick={() => onNavigateTab('requests')} />
        <MetricCard label="Changes Requested" value={stats.changesRequestedResources} color="orange" note="Awaiting corrections" onClick={() => onNavigateTab('resources')} />
        <MetricCard label="Total Users" value={stats.totalUsers} note={`${stats.students || 0} students`} />
        <MetricCard label="Total Resources" value={stats.resources} note={`${stats.approvedResources || 0} approved`} />
        <MetricCard label="Approved Resources" value={stats.approvedResources} color="green" />
        <MetricCard label="Rejected Resources" value={stats.rejectedResources} />
        <MetricCard label="Total Contributors" value={stats.contributors} note="Active sharing" />
        <MetricCard label="Total Downloads" value={stats.downloads} color="blue" />
        <MetricCard label="Pending Suggestions" value={stats.pendingSuggestions} note="Community ideas" />
      </div>

      <div className="admin-activity-grid">
        <div className="admin-card">
          <div className="admin-card-header">
            <h3>Recent Uploads</h3>
            <button className="text-link" onClick={() => onNavigateTab('uploads')}>See all →</button>
          </div>
          {activity.uploads && activity.uploads.length > 0 ? (
            <div className="admin-activity-list">
              {activity.uploads.map((u) => (
                <div key={u._id} className="admin-activity-item">
                  <div>
                    <h4>{u.title}</h4>
                    <p className="muted">{u.contributorId?.name || 'Student'} • {u.subjectId?.name || 'Subject'} • {formatDate(u.createdAt)}</p>
                  </div>
                  <StatusBadge status={u.status} />
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-state">No recent uploads.</p>
          )}
        </div>

        <div className="admin-card">
          <div className="admin-card-header">
            <h3>Pending Reports</h3>
            <button className="text-link" onClick={() => onNavigateTab('reports')}>See all →</button>
          </div>
          {activity.reports && activity.reports.length > 0 ? (
            <div className="admin-activity-list">
              {activity.reports.map((r) => (
                <div key={r._id} className="admin-activity-item">
                  <div>
                    <h4>{r.resourceId?.title || 'Resource'}</h4>
                    <p className="muted">Reported by {r.userId?.name || 'User'} • Reason: {r.reason}</p>
                  </div>
                  <StatusBadge status="OPEN" />
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-state">No open reports.</p>
          )}
        </div>

        <div className="admin-card">
          <div className="admin-card-header">
            <h3>Recent Suggestions</h3>
            <button className="text-link" onClick={() => onNavigateTab('suggestions')}>See all →</button>
          </div>
          {activity.suggestions && activity.suggestions.length > 0 ? (
            <div className="admin-activity-list">
              {activity.suggestions.map((s) => (
                <div key={s._id} className="admin-activity-item">
                  <div>
                    <h4>{s.title}</h4>
                    <p className="muted">{s.category} • by {s.userId?.name || 'Student'} • {formatDate(s.createdAt)}</p>
                  </div>
                  <StatusBadge status="OPEN" />
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-state">No open suggestions.</p>
          )}
        </div>
      </div>
    </div>
  )
}

// 2. PENDING REVIEWS VIEW
function PendingReviewsView({ token, onReloadOverview }) {
  const [uploads, setUploads] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [previewItem, setPreviewItem] = useState(null)
  const [rejectModal, setRejectModal] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [changesModal, setChangesModal] = useState(null)
  const [changesMessage, setChangesMessage] = useState('')
  const [busyId, setBusyId] = useState('')

  const loadPending = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.getAdminQueue(token)
      setUploads(data.uploads || [])
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    loadPending()
  }, [loadPending])

  const handleApprove = async (id) => {
    setBusyId(id)
    try {
      await api.approveResource(token, id)
      await loadPending()
      onReloadOverview?.()
    } catch (err) {
      alert(`Approval error: ${err.message}`)
    } finally {
      setBusyId('')
    }
  }

  const handleRejectSubmit = async (e) => {
    e.preventDefault()
    if (!rejectReason.trim()) return
    setBusyId(rejectModal._id)
    try {
      await api.rejectResource(token, rejectModal._id, rejectReason.trim())
      setRejectModal(null)
      setRejectReason('')
      await loadPending()
      onReloadOverview?.()
    } catch (err) {
      alert(`Rejection error: ${err.message}`)
    } finally {
      setBusyId('')
    }
  }

  const handleChangesSubmit = async (e) => {
    e.preventDefault()
    if (!changesMessage.trim()) return
    setBusyId(changesModal._id)
    try {
      await api.requestChangesResource(token, changesModal._id, changesMessage.trim())
      setChangesModal(null)
      setChangesMessage('')
      await loadPending()
      onReloadOverview?.()
    } catch (err) {
      alert(`Request changes error: ${err.message}`)
    } finally {
      setBusyId('')
    }
  }

  return (
    <div className="admin-section-content">
      <div className="admin-header-row">
        <div>
          <p className="eyebrow">MODERATION QUEUE</p>
          <h2>Pending Uploads ({uploads.length})</h2>
        </div>
        <button className="secondary-button" onClick={loadPending} disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh Queue ↻'}
        </button>
      </div>

      {error && <p className="form-error">{error}</p>}

      {loading ? (
        <p className="empty-state">Loading pending submissions...</p>
      ) : uploads.length === 0 ? (
        <p className="empty-state">No uploads currently awaiting review. The library is up to date!</p>
      ) : (
        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Resource Title</th>
                <th>Contributor</th>
                <th>Academic Hierarchy</th>
                <th>Details</th>
                <th>Uploaded</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {uploads.map((item) => (
                <tr key={item._id}>
                  <td>
                    <strong>{item.title}</strong>
                    {item.file?.fileName && <div className="muted font-mono">{item.file.fileName}</div>}
                  </td>
                  <td>
                    <div>{item.contributorId?.name || 'Anonymous'}</div>
                    <div className="muted font-mono">{item.contributorId?.email}</div>
                  </td>
                  <td>
                    <div>{item.programId?.name || 'Program'} &gt; {item.branchId?.code || 'Branch'}</div>
                    <div className="muted">Sem {item.semesterId?.number || '?'} • {item.subjectId?.name || 'Subject'}</div>
                  </td>
                  <td>
                    <span className="badge-pill">{item.resourceType}</span>
                    {item.examType && <span className="badge-pill">{item.examType}</span>}
                    {item.academicYear && <span className="badge-pill">{item.academicYear}</span>}
                  </td>
                  <td>{formatDate(item.createdAt)}</td>
                  <td>
                    <div className="admin-table-actions">
                      <button className="action-btn preview-btn" onClick={() => setPreviewItem(item)}>
                        Preview
                      </button>
                      <button
                        className="action-btn approve-btn"
                        disabled={busyId === item._id}
                        onClick={() => handleApprove(item._id)}
                      >
                        Approve
                      </button>
                      <button
                        className="action-btn changes-btn"
                        disabled={busyId === item._id}
                        onClick={() => { setChangesModal(item); setChangesMessage('') }}
                      >
                        Request Changes
                      </button>
                      <button
                        className="action-btn reject-btn"
                        disabled={busyId === item._id}
                        onClick={() => { setRejectModal(item); setRejectReason('') }}
                      >
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Preview Modal */}
      {previewItem && (
        <Modal title={`Review: ${previewItem.title}`} onClose={() => setPreviewItem(null)}>
          <div className="admin-preview-content">
            <div className="admin-detail-grid">
              <div><strong>Contributor:</strong> {previewItem.contributorId?.name} ({previewItem.contributorId?.email})</div>
              <div><strong>Program & Branch:</strong> {previewItem.programId?.name} ({previewItem.branchId?.code})</div>
              <div><strong>Semester & Subject:</strong> Sem {previewItem.semesterId?.number} • {previewItem.subjectId?.name}</div>
              <div><strong>Type & Exam:</strong> {previewItem.resourceType} • {previewItem.examType || 'N/A'} • {previewItem.academicYear || 'N/A'}</div>
              <div><strong>File Name:</strong> {previewItem.file?.fileName || 'document.pdf'}</div>
              <div><strong>Storage:</strong> {previewItem.file?.provider || 'local'}</div>
              <div><strong>Submitted Date:</strong> {formatDateTime(previewItem.createdAt)}</div>
            </div>
            {previewItem.description && (
              <div className="admin-detail-desc">
                <strong>Description:</strong>
                <p>{previewItem.description}</p>
              </div>
            )}
            {previewItem.file?.url && (
              <div className="admin-file-link-box">
                <button
                  type="button"
                  className="primary-button"
                  onClick={async () => {
                    try {
                      const res = await fetch(api.getResourceFileUrl(previewItem.file.url), {
                        headers: token ? { Authorization: `Bearer ${token}` } : {},
                      })
                      if (!res.ok) throw new Error('Failed to load document')
                      const blob = await res.blob()
                      const blobUrl = URL.createObjectURL(blob)
                      window.open(blobUrl, '_blank', 'noopener,noreferrer')
                    } catch (err) {
                      alert(err.message || 'Could not open attached PDF')
                    }
                  }}
                >
                  Open / Download Attached PDF ↗
                </button>
              </div>
            )}
            <div className="admin-modal-actions">
              <button
                className="action-btn approve-btn"
                disabled={busyId === previewItem._id}
                onClick={async () => {
                  await handleApprove(previewItem._id)
                  setPreviewItem(null)
                }}
              >
                Approve Resource
              </button>
              <button
                className="action-btn changes-btn"
                onClick={() => {
                  const target = previewItem
                  setPreviewItem(null)
                  setChangesModal(target)
                }}
              >
                Request Changes
              </button>
              <button
                className="action-btn reject-btn"
                onClick={() => {
                  const target = previewItem
                  setPreviewItem(null)
                  setRejectModal(target)
                }}
              >
                Reject
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <Modal title={`Reject: ${rejectModal.title}`} onClose={() => setRejectModal(null)}>
          <form onSubmit={handleRejectSubmit}>
            <p>Please specify why this resource is being rejected. The contributor will receive this reason in their notification.</p>
            <label>
              Rejection Reason *
              <textarea
                required
                rows={4}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Incomplete notes, blurry scans, incorrect subject tagging, copyrighted material..."
              />
            </label>
            <div className="admin-modal-actions">
              <button type="button" className="secondary-button" onClick={() => setRejectModal(null)}>Cancel</button>
              <button type="submit" className="action-btn reject-btn" disabled={busyId === rejectModal._id}>
                {busyId === rejectModal._id ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Request Changes Modal */}
      {changesModal && (
        <Modal title={`Request Changes: ${changesModal.title}`} onClose={() => setChangesModal(null)}>
          <form onSubmit={handleChangesSubmit}>
            <p>Explain the changes needed from the student before this resource can be approved.</p>
            <label>
              Feedback Message *
              <textarea
                required
                rows={4}
                value={changesMessage}
                onChange={(e) => setChangesMessage(e.target.value)}
                placeholder="e.g. Please re-upload with Unit 3 diagrams included, or clarify the subject code..."
              />
            </label>
            <div className="admin-modal-actions">
              <button type="button" className="secondary-button" onClick={() => setChangesModal(null)}>Cancel</button>
              <button type="submit" className="action-btn changes-btn" disabled={busyId === changesModal._id}>
                {busyId === changesModal._id ? 'Sending...' : 'Send Feedback'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

// 3. RESOURCE MANAGEMENT VIEW
function ResourceManagementView({ token, onReloadOverview }) {
  const [resources, setResources] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('ALL')
  const [filterStatus, setFilterStatus] = useState('ALL')
  const [editModal, setEditModal] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [deleteModal, setDeleteModal] = useState(null)
  const [deleteReason, setDeleteReason] = useState('')
  const [changesModal, setChangesModal] = useState(null)
  const [changesMessage, setChangesMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const fetchResources = useCallback(async () => {
    setLoading(true)
    try {
      let query = '?'
      if (search) query += `q=${encodeURIComponent(search)}&`
      if (filterType !== 'ALL') query += `resourceType=${filterType}&`
      if (filterStatus !== 'ALL') query += `status=${filterStatus}&`
      const data = await api.listAdminResources(token, query)
      setResources(data || [])
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [token, search, filterType, filterStatus])

  useEffect(() => {
    fetchResources()
  }, [fetchResources])

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    fetchResources()
  }

  const openEdit = (res) => {
    setEditModal(res)
    setEditForm({
      title: res.title,
      description: res.description || '',
      resourceType: res.resourceType,
      examType: res.examType || 'None',
      academicYear: res.academicYear || new Date().getFullYear(),
      status: res.status,
    })
  }

  const handleEditSubmit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      await api.updateAdminResource(token, editModal._id, editForm)
      setEditModal(null)
      await fetchResources()
      onReloadOverview?.()
    } catch (err) {
      alert(`Update error: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  const handleDeleteSubmit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      await api.deleteAdminResource(token, deleteModal._id, deleteReason)
      setDeleteModal(null)
      setDeleteReason('')
      await fetchResources()
      onReloadOverview?.()
    } catch (err) {
      alert(`Delete error: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  const handleChangesSubmit = async (e) => {
    e.preventDefault()
    if (!changesMessage.trim()) return
    setBusy(true)
    try {
      await api.requestChangesResource(token, changesModal._id, changesMessage.trim())
      setChangesModal(null)
      setChangesMessage('')
      await fetchResources()
      onReloadOverview?.()
    } catch (err) {
      alert(`Request changes error: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="admin-section-content">
      <div className="admin-header-row">
        <div>
          <p className="eyebrow">LIBRARY CATALOG</p>
          <h2>All Resources ({resources.length})</h2>
        </div>
      </div>

      <div className="admin-filters-toolbar">
        <form onSubmit={handleSearchSubmit} className="admin-search-form">
          <input
            placeholder="Search by title or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="submit" className="secondary-button">Search</button>
        </form>

        <div className="admin-filter-group">
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="ALL">All Types</option>
            <option value="Notes">Notes</option>
            <option value="PYQ">PYQ</option>
            <option value="Assignment">Assignment</option>
            <option value="Syllabus">Syllabus</option>
            <option value="Other">Other</option>
          </select>

          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="ALL">All Statuses</option>
            <option value="APPROVED">Approved</option>
            <option value="PENDING_REVIEW">Pending Review</option>
            <option value="CHANGES_REQUESTED">Changes Requested</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
      </div>

      {error && <p className="form-error">{error}</p>}

      {loading ? (
        <p className="empty-state">Loading resources...</p>
      ) : resources.length === 0 ? (
        <p className="empty-state">No resources matched your criteria.</p>
      ) : (
        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Contributor</th>
                <th>Subject & Hierarchy</th>
                <th>Type & Year</th>
                <th>Downloads</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {resources.map((item) => (
                <tr key={item._id}>
                  <td>
                    <strong>{item.title}</strong>
                    {item.file?.url && (
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const res = await fetch(api.getResourceFileUrl(item.file.url), {
                              headers: token ? { Authorization: `Bearer ${token}` } : {},
                            })
                            if (!res.ok) throw new Error('Failed to load document')
                            const blob = await res.blob()
                            const blobUrl = URL.createObjectURL(blob)
                            window.open(blobUrl, '_blank', 'noopener,noreferrer')
                          } catch (err) {
                            alert(err.message || 'Could not open attached PDF')
                          }
                        }}
                        className="text-link block font-mono"
                      >
                        View File ↗
                      </button>
                    )}
                  </td>
                  <td>{item.contributorId?.name || 'Anonymous'}</td>
                  <td>
                    <div>{item.subjectId?.name || 'Subject'}</div>
                    <div className="muted">{item.programId?.code} • {item.branchId?.code} • Sem {item.semesterId?.number}</div>
                  </td>
                  <td>{item.resourceType} ({item.academicYear || '-'})</td>
                  <td><strong>{item.downloadCount || 0}</strong></td>
                  <td><StatusBadge status={item.status} /></td>
                  <td>
                    <div className="admin-table-actions">
                      <button className="action-btn preview-btn" onClick={() => { setChangesModal(item); setChangesMessage('') }}>Request Changes</button>
                      <button className="action-btn edit-btn" onClick={() => openEdit(item)}>Edit</button>
                      <button className="action-btn delete-btn" onClick={() => { setDeleteModal(item); setDeleteReason('') }}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Modal */}
      {editModal && (
        <Modal title={`Edit Metadata: ${editModal.title}`} onClose={() => setEditModal(null)}>
          <form onSubmit={handleEditSubmit} className="admin-form-grid">
            <label>
              Title *
              <input
                required
                value={editForm.title}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
              />
            </label>
            <label>
              Description
              <textarea
                rows={3}
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              />
            </label>
            <div className="form-row-2">
              <label>
                Resource Type
                <select
                  value={editForm.resourceType}
                  onChange={(e) => setEditForm({ ...editForm, resourceType: e.target.value })}
                >
                  <option value="Notes">Notes</option>
                  <option value="PYQ">PYQ</option>
                  <option value="Assignment">Assignment</option>
                  <option value="Syllabus">Syllabus</option>
                  <option value="Other">Other</option>
                </select>
              </label>
              <label>
                Exam Type
                <select
                  value={editForm.examType}
                  onChange={(e) => setEditForm({ ...editForm, examType: e.target.value })}
                >
                  <option value="None">None</option>
                  <option value="Mid Term">Mid Term</option>
                  <option value="End Term">End Term</option>
                  <option value="Class Test">Class Test</option>
                  <option value="Quiz">Quiz</option>
                </select>
              </label>
            </div>
            <div className="form-row-2">
              <label>
                Academic Year
                <input
                  type="number"
                  value={editForm.academicYear}
                  onChange={(e) => setEditForm({ ...editForm, academicYear: Number(e.target.value) })}
                />
              </label>
              <label>
                Status
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                >
                  <option value="APPROVED">Approved</option>
                  <option value="PENDING_REVIEW">Pending Review</option>
                  <option value="CHANGES_REQUESTED">Changes Requested</option>
                  <option value="REJECTED">Rejected</option>
                </select>
              </label>
            </div>
            <div className="admin-modal-actions">
              <button type="button" className="secondary-button" onClick={() => setEditModal(null)}>Cancel</button>
              <button type="submit" className="primary-button" disabled={busy}>
                {busy ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Modal */}
      {deleteModal && (
        <Modal title={`Delete Resource: ${deleteModal.title}`} onClose={() => setDeleteModal(null)}>
          <form onSubmit={handleDeleteSubmit}>
            <p className="form-warning">Warning: This action will permanently remove the resource from the database.</p>
            <label>
              Reason for Deletion (Optional)
              <input
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="e.g. Duplicate upload, requested by original creator..."
              />
            </label>
            <div className="admin-modal-actions">
              <button type="button" className="secondary-button" onClick={() => setDeleteModal(null)}>Cancel</button>
              <button type="submit" className="action-btn delete-btn" disabled={busy}>
                {busy ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Request Changes Modal */}
      {changesModal && (
        <Modal title={`Request Modifications: ${changesModal.title}`} onClose={() => setChangesModal(null)}>
          <form onSubmit={handleChangesSubmit}>
            <p style={{ marginBottom: 12 }}>
              Send modification request to the author <strong>{changesModal.contributorId?.name || 'Contributor'}</strong> ({changesModal.contributorId?.email || 'email'}).
              They will receive an in-app notification and an email detailing what to change.
            </p>
            <label>
              Requested Modifications *
              <textarea
                required
                rows={4}
                value={changesMessage}
                onChange={(e) => setChangesMessage(e.target.value)}
                placeholder="Specify the exact revisions or corrections needed before approval..."
              />
            </label>
            <div className="admin-modal-actions">
              <button type="button" className="secondary-button" onClick={() => setChangesModal(null)}>Cancel</button>
              <button type="submit" className="action-btn changes-btn" disabled={busy}>
                {busy ? 'Sending...' : 'Send Request to Author'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

// 4. USER MANAGEMENT VIEW
function UserManagementView({ token, currentUser, onReloadOverview }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState('ALL')
  const [filterStatus, setFilterStatus] = useState('ALL')
  const [userDetailModal, setUserDetailModal] = useState(null)
  const [roleModal, setRoleModal] = useState(null)
  const [selectedRole, setSelectedRole] = useState('STUDENT')
  const [busyId, setBusyId] = useState('')

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      let query = '?'
      if (search) query += `q=${encodeURIComponent(search)}&`
      if (filterRole !== 'ALL') query += `role=${filterRole}&`
      if (filterStatus !== 'ALL') query += `isActive=${filterStatus === 'ACTIVE'}&`
      const data = await api.listAdminUsers(token, query)
      setUsers(data || [])
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [token, search, filterRole, filterStatus])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    fetchUsers()
  }

  const handleViewDetail = async (user) => {
    try {
      const detail = await api.getAdminUserDetail(token, user._id)
      setUserDetailModal(detail)
    } catch (err) {
      alert(`Error loading user stats: ${err.message}`)
    }
  }

  const handleRoleChange = async (e) => {
    e.preventDefault()
    if (!roleModal) return
    setBusyId(roleModal._id)
    try {
      await api.updateUserRole(token, roleModal._id, selectedRole)
      setRoleModal(null)
      await fetchUsers()
      onReloadOverview?.()
    } catch (err) {
      alert(`Failed to update role: ${err.message}`)
    } finally {
      setBusyId('')
    }
  }

  const handleToggleStatus = async (user) => {
    const nextStatus = !user.isActive
    if (!confirm(`Are you sure you want to ${nextStatus ? 'restore' : 'suspend'} ${user.name}?`)) return
    setBusyId(user._id)
    try {
      await api.updateUserStatus(token, user._id, nextStatus)
      await fetchUsers()
      onReloadOverview?.()
    } catch (err) {
      alert(`Failed to update status: ${err.message}`)
    } finally {
      setBusyId('')
    }
  }

  const isAdmin = currentUser?.role === 'ADMIN'

  return (
    <div className="admin-section-content">
      <div className="admin-header-row">
        <div>
          <p className="eyebrow">ACCOUNTS & ROLES</p>
          <h2>User Directory ({users.length})</h2>
        </div>
      </div>

      <div className="admin-filters-toolbar">
        <form onSubmit={handleSearchSubmit} className="admin-search-form">
          <input
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="submit" className="secondary-button">Search</button>
        </form>

        <div className="admin-filter-group">
          <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
            <option value="ALL">All Roles</option>
            <option value="STUDENT">Student</option>
            <option value="MODERATOR">Moderator</option>
            <option value="ADMIN">Admin</option>
          </select>

          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active Accounts</option>
            <option value="SUSPENDED">Suspended Accounts</option>
          </select>
        </div>
      </div>

      {error && <p className="form-error">{error}</p>}

      {loading ? (
        <p className="empty-state">Loading users...</p>
      ) : users.length === 0 ? (
        <p className="empty-state">No users found.</p>
      ) : (
        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>User Details</th>
                <th>Academic Info</th>
                <th>Role</th>
                <th>Status</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u._id}>
                  <td>
                    <strong>{u.name}</strong>
                    <div className="muted font-mono">{u.email}</div>
                  </td>
                  <td>
                    <div>{u.programId?.name || '-'} ({u.branchId?.code || '-'})</div>
                    <div className="muted">Sem {u.semesterId?.number || '-'}</div>
                  </td>
                  <td>
                    <span className={`role-badge role-${u.role?.toLowerCase()}`}>
                      {u.role}
                    </span>
                  </td>
                  <td>
                    <StatusBadge status={u.isActive ? 'ACTIVE' : 'SUSPENDED'} />
                  </td>
                  <td>{formatDate(u.createdAt)}</td>
                  <td>
                    <div className="admin-table-actions">
                      <button className="action-btn preview-btn" onClick={() => handleViewDetail(u)}>
                        Stats
                      </button>
                      {isAdmin && (
                        <>
                          <button
                            className="action-btn edit-btn"
                            onClick={() => { setRoleModal(u); setSelectedRole(u.role) }}
                          >
                            Change Role
                          </button>
                          <button
                            className={`action-btn ${u.isActive ? 'reject-btn' : 'approve-btn'}`}
                            disabled={busyId === u._id || u._id === currentUser?._id}
                            onClick={() => handleToggleStatus(u)}
                          >
                            {u.isActive ? 'Suspend' : 'Restore'}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* User Stats Modal */}
      {userDetailModal && (
        <Modal title={`User Profile: ${userDetailModal.user.name}`} onClose={() => setUserDetailModal(null)}>
          <div className="admin-preview-content">
            <div className="admin-detail-grid">
              <div><strong>Email:</strong> {userDetailModal.user.email}</div>
              <div><strong>Role:</strong> {userDetailModal.user.role}</div>
              <div><strong>Account Status:</strong> {userDetailModal.user.isActive ? 'Active' : 'Suspended'}</div>
              <div><strong>Program:</strong> {userDetailModal.user.programId?.name || 'None'}</div>
              <div><strong>Branch & Sem:</strong> {userDetailModal.user.branchId?.name || 'None'} • Sem {userDetailModal.user.semesterId?.number || '-'}</div>
              <div><strong>Joined:</strong> {formatDateTime(userDetailModal.user.createdAt)}</div>
            </div>
            <div className="admin-metrics-grid mt-4">
              <MetricCard label="Total Uploads" value={userDetailModal.statistics.totalUploads} />
              <MetricCard label="Approved Notes" value={userDetailModal.statistics.approvedContributions} color="green" />
              <MetricCard label="Total Downloads" value={userDetailModal.statistics.totalDownloads} color="blue" />
            </div>
            <div className="admin-modal-actions">
              <button className="primary-button" onClick={() => setUserDetailModal(null)}>Close</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Change Role Modal */}
      {roleModal && (
        <Modal title={`Update Role: ${roleModal.name}`} onClose={() => setRoleModal(null)}>
          <form onSubmit={handleRoleChange}>
            <p>Select the authorization privilege level for this account.</p>
            <label>
              Role
              <select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)}>
                <option value="STUDENT">Student (Standard user)</option>
                <option value="MODERATOR">Moderator (Review & moderate content)</option>
                <option value="ADMIN">Admin (Full administrative privileges)</option>
              </select>
            </label>
            <div className="admin-modal-actions">
              <button type="button" className="secondary-button" onClick={() => setRoleModal(null)}>Cancel</button>
              <button type="submit" className="primary-button" disabled={busyId === roleModal._id}>
                {busyId === roleModal._id ? 'Saving...' : 'Save Role'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

// 5. ACADEMIC STRUCTURE MANAGEMENT
function AcademicStructureView({ token, currentUser }) {
  const [data, setData] = useState({ programs: [], branches: [], semesters: [], subjects: [] })
  const [activeTab, setActiveTab] = useState('programs')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalType, setModalType] = useState(null)
  const [editingItem, setEditingItem] = useState(null)
  const [form, setForm] = useState({})
  const [busy, setBusy] = useState(false)

  const isAdmin = currentUser?.role === 'ADMIN'

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.listAllAcademic(token)
      setData(res || { programs: [], branches: [], semesters: [], subjects: [] })
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    loadData()
  }, [loadData])

  const openCreateModal = (type) => {
    setModalType(type)
    setEditingItem(null)
    setForm({})
  }

  const openEditModal = (type, item) => {
    setModalType(type)
    setEditingItem(item)
    setForm({ ...item })
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      if (modalType === 'program') {
        if (editingItem) await api.updateProgram(token, editingItem._id, form)
        else await api.createProgram(token, form)
      } else if (modalType === 'branch') {
        if (editingItem) await api.updateBranch(token, editingItem._id, form)
        else await api.createBranch(token, form)
      } else if (modalType === 'semester') {
        if (editingItem) await api.updateSemester(token, editingItem._id, form)
        else await api.createSemester(token, form)
      } else if (modalType === 'subject') {
        if (editingItem) await api.updateSubject(token, editingItem._id, form)
        else await api.createSubject(token, form)
      }
      setModalType(null)
      await loadData()
    } catch (err) {
      alert(`Save error: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (type, id, name) => {
    if (!confirm(`Are you sure you want to delete ${name}?`)) return
    try {
      if (type === 'program') await api.deleteProgram(token, id)
      else if (type === 'branch') await api.deleteBranch(token, id)
      else if (type === 'semester') await api.deleteSemester(token, id)
      else if (type === 'subject') await api.deleteSubject(token, id)
      await loadData()
    } catch (err) {
      alert(`Delete error: ${err.message}`)
    }
  }

  return (
    <div className="admin-section-content">
      <div className="admin-header-row">
        <div>
          <p className="eyebrow">CURRICULUM ARCHITECTURE</p>
          <h2>Academic Structure</h2>
        </div>
        {isAdmin && (
          <button className="primary-button" onClick={() => openCreateModal(activeTab.slice(0, -1))}>
            + Add {activeTab.slice(0, -1).toUpperCase()}
          </button>
        )}
      </div>

      <div className="admin-subtabs">
        <button className={activeTab === 'programs' ? 'active' : ''} onClick={() => setActiveTab('programs')}>
          Programs ({data.programs.length})
        </button>
        <button className={activeTab === 'branches' ? 'active' : ''} onClick={() => setActiveTab('branches')}>
          Branches ({data.branches.length})
        </button>
        <button className={activeTab === 'semesters' ? 'active' : ''} onClick={() => setActiveTab('semesters')}>
          Semesters ({data.semesters.length})
        </button>
        <button className={activeTab === 'subjects' ? 'active' : ''} onClick={() => setActiveTab('subjects')}>
          Subjects ({data.subjects.length})
        </button>
      </div>

      {error && <p className="form-error">{error}</p>}

      {loading ? (
        <p className="empty-state">Loading curriculum structure...</p>
      ) : activeTab === 'programs' ? (
        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Program Name</th>
                <th>Code</th>
                <th>Slug</th>
                <th>Program ID</th>
                {isAdmin && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {data.programs.map((p) => (
                <tr key={p._id}>
                  <td><strong>{p.name}</strong></td>
                  <td><span className="badge-pill">{p.code}</span></td>
                  <td className="muted font-mono">{p.slug}</td>
                  <td className="muted font-mono">{p._id}</td>
                  {isAdmin && (
                    <td>
                      <div className="admin-table-actions">
                        <button className="action-btn edit-btn" onClick={() => openEditModal('program', p)}>Edit</button>
                        <button className="action-btn delete-btn" onClick={() => handleDelete('program', p._id, p.name)}>Delete</button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : activeTab === 'branches' ? (
        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Branch Name</th>
                <th>Code</th>
                <th>Parent Program</th>
                <th>Branch ID</th>
                {isAdmin && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {data.branches.map((b) => (
                <tr key={b._id}>
                  <td><strong>{b.name}</strong></td>
                  <td><span className="badge-pill">{b.code}</span></td>
                  <td>{b.programId?.name || 'Unassigned'} ({b.programId?.code})</td>
                  <td className="muted font-mono">{b._id}</td>
                  {isAdmin && (
                    <td>
                      <div className="admin-table-actions">
                        <button className="action-btn edit-btn" onClick={() => openEditModal('branch', b)}>Edit</button>
                        <button className="action-btn delete-btn" onClick={() => handleDelete('branch', b._id, b.name)}>Delete</button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : activeTab === 'semesters' ? (
        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Semester Number</th>
                <th>Display Name</th>
                <th>Program</th>
                <th>Branch (Optional)</th>
                {isAdmin && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {data.semesters.map((s) => (
                <tr key={s._id}>
                  <td><strong>Semester {s.number}</strong></td>
                  <td>{s.name}</td>
                  <td>{s.programId?.name || 'All'}</td>
                  <td>{s.branchId?.code || 'Common / All'}</td>
                  {isAdmin && (
                    <td>
                      <div className="admin-table-actions">
                        <button className="action-btn edit-btn" onClick={() => openEditModal('semester', s)}>Edit</button>
                        <button className="action-btn delete-btn" onClick={() => handleDelete('semester', s._id, s.name)}>Delete</button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Subject Name</th>
                <th>Subject Code</th>
                <th>Hierarchy</th>
                <th>Description</th>
                {isAdmin && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {data.subjects.map((sub) => (
                <tr key={sub._id}>
                  <td><strong>{sub.name}</strong></td>
                  <td><span className="badge-pill">{sub.code || '-'}</span></td>
                  <td>
                    <div>{sub.programId?.code || '-'} &gt; {sub.branchId?.code || 'All'}</div>
                    <div className="muted">Sem {sub.semesterId?.number || '-'}</div>
                  </td>
                  <td className="muted">{sub.description || '-'}</td>
                  {isAdmin && (
                    <td>
                      <div className="admin-table-actions">
                        <button className="action-btn edit-btn" onClick={() => openEditModal('subject', sub)}>Edit</button>
                        <button className="action-btn delete-btn" onClick={() => handleDelete('subject', sub._id, sub.name)}>Delete</button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Academic Entity Modal */}
      {modalType && (
        <Modal
          title={`${editingItem ? 'Edit' : 'Create'} ${modalType.toUpperCase()}`}
          onClose={() => setModalType(null)}
        >
          <form onSubmit={handleSave} className="admin-form-grid">
            {modalType === 'program' && (
              <>
                <label>
                  Program Name *
                  <input
                    required
                    value={form.name || ''}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Bachelor of Technology"
                  />
                </label>
                <label>
                  Program Code *
                  <input
                    required
                    value={form.code || ''}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    placeholder="e.g. BTECH or IMCA"
                  />
                </label>
              </>
            )}

            {modalType === 'branch' && (
              <>
                <label>
                  Program *
                  <select
                    required
                    value={form.programId?._id || form.programId || ''}
                    onChange={(e) => setForm({ ...form, programId: e.target.value })}
                  >
                    <option value="">Select Program</option>
                    {data.programs.map((p) => (
                      <option key={p._id} value={p._id}>{p.name} ({p.code})</option>
                    ))}
                  </select>
                </label>
                <label>
                  Branch Name *
                  <input
                    required
                    value={form.name || ''}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Computer Science & Engineering"
                  />
                </label>
                <label>
                  Branch Code *
                  <input
                    required
                    value={form.code || ''}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    placeholder="e.g. CSE"
                  />
                </label>
              </>
            )}

            {modalType === 'semester' && (
              <>
                <label>
                  Program *
                  <select
                    required
                    value={form.programId?._id || form.programId || ''}
                    onChange={(e) => setForm({ ...form, programId: e.target.value })}
                  >
                    <option value="">Select Program</option>
                    {data.programs.map((p) => (
                      <option key={p._id} value={p._id}>{p.name} ({p.code})</option>
                    ))}
                  </select>
                </label>
                <label>
                  Branch (Optional)
                  <select
                    value={form.branchId?._id || form.branchId || ''}
                    onChange={(e) => setForm({ ...form, branchId: e.target.value })}
                  >
                    <option value="">Common across branches</option>
                    {data.branches.map((b) => (
                      <option key={b._id} value={b._id}>{b.name} ({b.code})</option>
                    ))}
                  </select>
                </label>
                <label>
                  Semester Number *
                  <input
                    required
                    type="number"
                    min="1"
                    max="12"
                    value={form.number || ''}
                    onChange={(e) => setForm({ ...form, number: Number(e.target.value) })}
                    placeholder="e.g. 1 to 10 for IMCA, 1 to 8 for B.Tech"
                  />
                </label>
                <label>
                  Display Name
                  <input
                    value={form.name || ''}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Semester 3"
                  />
                </label>
              </>
            )}

            {modalType === 'subject' && (
              <>
                <label>
                  Program *
                  <select
                    required
                    value={form.programId?._id || form.programId || ''}
                    onChange={(e) => setForm({ ...form, programId: e.target.value })}
                  >
                    <option value="">Select Program</option>
                    {data.programs.map((p) => (
                      <option key={p._id} value={p._id}>{p.name} ({p.code})</option>
                    ))}
                  </select>
                </label>
                <label>
                  Branch (Optional)
                  <select
                    value={form.branchId?._id || form.branchId || ''}
                    onChange={(e) => setForm({ ...form, branchId: e.target.value })}
                  >
                    <option value="">Common / All Branches</option>
                    {data.branches.map((b) => (
                      <option key={b._id} value={b._id}>{b.name} ({b.code})</option>
                    ))}
                  </select>
                </label>
                <label>
                  Semester *
                  <select
                    required
                    value={form.semesterId?._id || form.semesterId || ''}
                    onChange={(e) => setForm({ ...form, semesterId: e.target.value })}
                  >
                    <option value="">Select Semester</option>
                    {data.semesters.map((s) => (
                      <option key={s._id} value={s._id}>{s.name || `Semester ${s.number}`}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Subject Name *
                  <input
                    required
                    value={form.name || ''}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Operating Systems"
                  />
                </label>
                <label>
                  Subject Code
                  <input
                    value={form.code || ''}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    placeholder="e.g. CS301"
                  />
                </label>
                <label>
                  Description
                  <textarea
                    rows={2}
                    value={form.description || ''}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </label>
              </>
            )}

            <div className="admin-modal-actions">
              <button type="button" className="secondary-button" onClick={() => setModalType(null)}>Cancel</button>
              <button type="submit" className="primary-button" disabled={busy}>
                {busy ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

// 6. CONTRIBUTOR MANAGEMENT VIEW
function ContributorManagementView({ token, onNavigate }) {
  const [contributors, setContributors] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    api.listAdminContributors(token)
      .then((res) => {
        if (active) {
          setContributors(res || [])
          setError('')
          setLoading(false)
        }
      })
      .catch((err) => {
        if (active) {
          setError(err.message)
          setLoading(false)
        }
      })
    return () => { active = false }
  }, [token])

  return (
    <div className="admin-section-content">
      <div className="admin-header-row">
        <div>
          <p className="eyebrow">COMMUNITY LEADERSHIP</p>
          <h2>Active Contributors ({contributors.length})</h2>
        </div>
      </div>

      {error && <p className="form-error">{error}</p>}

      {loading ? (
        <p className="empty-state">Loading contributors...</p>
      ) : contributors.length === 0 ? (
        <p className="empty-state">No student contributors registered yet.</p>
      ) : (
        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Contributor</th>
                <th>Program & Branch</th>
                <th>Approved</th>
                <th>Pending</th>
                <th>Rejected</th>
                <th>Total Downloads</th>
                <th>Subjects</th>
                <th>Last Upload</th>
                <th>Public Profile</th>
              </tr>
            </thead>
            <tbody>
              {contributors.map((c) => (
                <tr key={c._id}>
                  <td>
                    <strong>{c.name}</strong>
                    <div className="muted font-mono">{c.email}</div>
                  </td>
                  <td>{c.programId?.code || '-'} • {c.branchId?.code || '-'}</td>
                  <td><strong className="text-green">{c.approvedContributions}</strong></td>
                  <td>{c.pendingContributions}</td>
                  <td>{c.rejectedContributions}</td>
                  <td><strong>{c.totalDownloads}</strong></td>
                  <td>{c.subjectsCount}</td>
                  <td>{formatDate(c.lastUploadDate)}</td>
                  <td>
                    <button
                      className="text-link"
                      onClick={() => onNavigate(`/contributors/${c._id}`)}
                    >
                      View Public Profile ↗
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// 7. DEVELOPER / TEAM MANAGEMENT VIEW
function DeveloperManagementView({ token, currentUser }) {
  const [developers, setDevelopers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [form, setForm] = useState({
    name: '',
    role: '',
    description: '',
    skills: '',
    websiteUrl: '',
    githubUrl: '',
    linkedinUrl: '',
    displayOrder: 0,
    isPublished: true,
  })
  const [busy, setBusy] = useState(false)

  const isAdmin = currentUser?.role === 'ADMIN'

  const loadDevelopers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.listAdminDevelopers(token)
      setDevelopers(res || [])
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    loadDevelopers()
  }, [loadDevelopers])

  const openCreate = () => {
    setEditingItem(null)
    setForm({
      name: '',
      role: '',
      description: '',
      skills: '',
      websiteUrl: '',
      githubUrl: '',
      linkedinUrl: '',
      displayOrder: developers.length,
      isPublished: true,
    })
    setModalOpen(true)
  }

  const openEdit = (dev) => {
    setEditingItem(dev)
    setForm({
      ...dev,
      skills: Array.isArray(dev.skills) ? dev.skills.join(', ') : dev.skills || '',
    })
    setModalOpen(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setBusy(true)
    const payload = {
      ...form,
      skills: typeof form.skills === 'string'
        ? form.skills.split(',').map((s) => s.trim()).filter(Boolean)
        : form.skills,
    }
    try {
      if (editingItem) {
        await api.updateDeveloper(token, editingItem._id, payload)
      } else {
        await api.createDeveloper(token, payload)
      }
      setModalOpen(false)
      await loadDevelopers()
    } catch (err) {
      alert(`Developer save error: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (dev) => {
    if (!confirm(`Delete developer profile for ${dev.name}?`)) return
    try {
      await api.deleteDeveloper(token, dev._id)
      await loadDevelopers()
    } catch (err) {
      alert(`Delete error: ${err.message}`)
    }
  }

  return (
    <div className="admin-section-content">
      <div className="admin-header-row">
        <div>
          <p className="eyebrow">PLATFORM CREATORS</p>
          <h2>Developer Team Profiles ({developers.length})</h2>
        </div>
        {isAdmin && (
          <button className="primary-button" onClick={openCreate}>
            + Add Developer Profile
          </button>
        )}
      </div>

      {error && <p className="form-error">{error}</p>}

      {loading ? (
        <p className="empty-state">Loading developer profiles...</p>
      ) : developers.length === 0 ? (
        <p className="empty-state">No developer profiles created yet.</p>
      ) : (
        <div className="admin-cards-grid">
          {developers.map((dev) => (
            <div key={dev._id} className="admin-dev-card">
              <div className="admin-card-header">
                <div>
                  <h3>{dev.name}</h3>
                  <p className="eyebrow">{dev.role}</p>
                </div>
                <StatusBadge status={dev.isPublished ? 'APPROVED' : 'CHANGES_REQUESTED'} />
              </div>
              <p className="admin-dev-desc">{dev.description}</p>
              <div className="skill-list">
                {(dev.skills || []).map((s) => <span key={s}>{s}</span>)}
              </div>
              <div className="admin-dev-links">
                {dev.websiteUrl && <a href={dev.websiteUrl} target="_blank" rel="noreferrer" className="text-link">Visit Website ↗</a>}
                {dev.githubUrl && <a href={dev.githubUrl} target="_blank" rel="noreferrer" className="text-link">GitHub ↗</a>}
                {dev.linkedinUrl && <a href={dev.linkedinUrl} target="_blank" rel="noreferrer" className="text-link">LinkedIn ↗</a>}
              </div>
              {isAdmin && (
                <div className="admin-card-footer mt-4">
                  <button className="action-btn edit-btn" onClick={() => openEdit(dev)}>Edit</button>
                  <button className="action-btn delete-btn" onClick={() => handleDelete(dev)}>Delete</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Developer Modal */}
      {modalOpen && (
        <Modal title={`${editingItem ? 'Edit' : 'Add'} Developer Profile`} onClose={() => setModalOpen(false)}>
          <form onSubmit={handleSave} className="admin-form-grid">
            <div className="form-row-2">
              <label>
                Name *
                <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </label>
              <label>
                Role *
                <input required value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="e.g. Full Stack Developer" />
              </label>
            </div>
            <label>
              Description *
              <textarea required rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </label>
            <label>
              Skills (comma-separated)
              <input value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} placeholder="React, Node.js, MongoDB" />
            </label>
            <div className="form-row-3">
              <label>
                Personal Website URL
                <input type="url" value={form.websiteUrl} onChange={(e) => setForm({ ...form, websiteUrl: e.target.value })} placeholder="https://..." />
              </label>
              <label>
                GitHub URL
                <input type="url" value={form.githubUrl} onChange={(e) => setForm({ ...form, githubUrl: e.target.value })} placeholder="https://github.com/..." />
              </label>
              <label>
                LinkedIn URL
                <input type="url" value={form.linkedinUrl} onChange={(e) => setForm({ ...form, linkedinUrl: e.target.value })} placeholder="https://linkedin.com/in/..." />
              </label>
            </div>
            <div className="form-row-2 items-center">
              <label>
                Display Order
                <input type="number" value={form.displayOrder} onChange={(e) => setForm({ ...form, displayOrder: Number(e.target.value) })} />
              </label>
              <label className="checkbox-label mt-4">
                <input type="checkbox" checked={form.isPublished} onChange={(e) => setForm({ ...form, isPublished: e.target.checked })} />
                Publish on public /team page
              </label>
            </div>
            <div className="admin-modal-actions">
              <button type="button" className="secondary-button" onClick={() => setModalOpen(false)}>Cancel</button>
              <button type="submit" className="primary-button" disabled={busy}>
                {busy ? 'Saving...' : 'Save Developer'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

// 8. SUGGESTIONS MANAGEMENT VIEW
function SuggestionsManagementView({ token, onReloadOverview }) {
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filterStatus, setFilterStatus] = useState('ACTIVE')
  const [replyModal, setReplyModal] = useState(null)
  const [replyStatus, setReplyStatus] = useState('COMPLETED')
  const [replyText, setReplyText] = useState('')
  const [busy, setBusy] = useState(false)

  const loadFeedback = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.listAllSuggestions(token)
      setSuggestions(Array.isArray(data) ? data : (data?.suggestions || []))
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    loadFeedback()
  }, [loadFeedback])

  const filtered = useMemo(() => {
    if (filterStatus === 'ACTIVE') return suggestions.filter((s) => ['OPEN', 'ACCEPTED'].includes(s.status))
    if (filterStatus === 'HISTORY') return suggestions.filter((s) => ['COMPLETED', 'REJECTED'].includes(s.status))
    if (filterStatus === 'ALL') return suggestions
    return suggestions.filter((s) => s.status === filterStatus)
  }, [suggestions, filterStatus])

  const handleReplySubmit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      await api.updateSuggestion(token, replyModal._id, replyStatus, replyText)
      setReplyModal(null)
      setReplyText('')
      await loadFeedback()
      onReloadOverview?.()
    } catch (err) {
      alert(`Update error: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="admin-section-content">
      <div className="admin-header-row">
        <div>
          <p className="eyebrow">COMMUNITY INPUT</p>
          <h2>Platform Suggestions ({filtered.length})</h2>
        </div>
        <div className="admin-filter-group">
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="ACTIVE">Active</option>
            <option value="HISTORY">History</option>
            <option value="ALL">All Statuses</option>
            <option value="OPEN">Open</option>
            <option value="ACCEPTED">Accepted / In Progress</option>
            <option value="COMPLETED">Completed</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
      </div>

      {error && <p className="form-error">{error}</p>}

      {loading ? (
        <p className="empty-state">Loading suggestions...</p>
      ) : filtered.length === 0 ? (
        <p className="empty-state">No suggestions found.</p>
      ) : (
        <div className="admin-cards-grid">
          {filtered.map((item) => (
            <div key={item._id} className="admin-feedback-card">
              <div className="admin-card-header">
                <div>
                  <span className="badge-pill">{item.category}</span>
                  <h3>{item.title}</h3>
                </div>
                <StatusBadge status={item.status} />
              </div>
              <p className="admin-feedback-desc">{item.description}</p>
              <div className="admin-feedback-meta muted">
                Submitted by <strong>{item.userId?.name || 'Student'}</strong> ({item.userId?.email}) on {formatDate(item.createdAt)}
              </div>
              {item.adminReply && (
                <div className="admin-reply-box">
                  <strong>Staff Reply:</strong>
                  <p>{item.adminReply}</p>
                </div>
              )}
              <div className="admin-card-footer mt-4">
                <button
                  className="action-btn preview-btn"
                  onClick={() => {
                    setReplyModal(item)
                    setReplyStatus(item.status === 'OPEN' ? 'COMPLETED' : item.status)
                    setReplyText(item.adminReply || '')
                  }}
                >
                  Respond / Change Status
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reply Modal */}
      {replyModal && (
        <Modal title={`Respond to: ${replyModal.title}`} onClose={() => setReplyModal(null)}>
          <form onSubmit={handleReplySubmit}>
            <label>
              Update Status *
              <select value={replyStatus} onChange={(e) => setReplyStatus(e.target.value)}>
                <option value="OPEN">Open</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed / Implemented</option>
                <option value="REJECTED">Rejected / Declined</option>
              </select>
            </label>
            <label>
              Staff Response Message
              <textarea
                rows={4}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Write a reply message to notify the student..."
              />
            </label>
            <div className="admin-modal-actions">
              <button type="button" className="secondary-button" onClick={() => setReplyModal(null)}>Cancel</button>
              <button type="submit" className="primary-button" disabled={busy}>
                {busy ? 'Saving...' : 'Submit Response'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

// 9. REPORTS MANAGEMENT VIEW
function ReportsManagementView({ token, onReloadOverview }) {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filterStatus, setFilterStatus] = useState('ACTIVE')
  const [replyModal, setReplyModal] = useState(null)
  const [replyStatus, setReplyStatus] = useState('RESOLVED')
  const [replyText, setReplyText] = useState('')
  const [modalError, setModalError] = useState('')
  const [busy, setBusy] = useState(false)

  const loadReports = useCallback(async () => {
    setLoading(true)
    try {
      let data = []
      try {
        data = await api.listAllReports(token)
      } catch {
        const res = await api.listModerationFeedback(token)
        data = res?.reports || []
      }
      setReports(Array.isArray(data) ? data : (data?.reports || []))
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    loadReports()
  }, [loadReports])

  const filtered = useMemo(() => {
    if (filterStatus === 'ACTIVE') return reports.filter((r) => ['OPEN', 'INVESTIGATING'].includes(r.status))
    if (filterStatus === 'HISTORY') return reports.filter((r) => ['RESOLVED', 'DISMISSED'].includes(r.status))
    if (filterStatus === 'ALL') return reports
    return reports.filter((r) => r.status === filterStatus)
  }, [reports, filterStatus])

  const handleReplySubmit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setModalError('')
    try {
      await api.updateReport(token, replyModal._id, replyStatus, replyText)
      setReplyModal(null)
      setReplyText('')
      await loadReports()
      onReloadOverview?.()
    } catch (err) {
      setModalError(err.message || 'Failed to update report')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="admin-section-content">
      <div className="admin-header-row">
        <div>
          <p className="eyebrow">TRUST & SAFETY</p>
          <h2>Flagged Reports ({filtered.length})</h2>
        </div>
        <div className="admin-filter-group">
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="ACTIVE">Active</option>
            <option value="HISTORY">History</option>
            <option value="ALL">All Statuses</option>
            <option value="OPEN">Open</option>
            <option value="INVESTIGATING">Investigating</option>
            <option value="RESOLVED">Resolved</option>
            <option value="DISMISSED">Dismissed</option>
          </select>
        </div>
      </div>

      {error && <p className="form-error">{error}</p>}

      {loading ? (
        <p className="empty-state">Loading reports...</p>
      ) : filtered.length === 0 ? (
        <p className="empty-state">No flagged reports matching this filter.</p>
      ) : (
        <div className="admin-cards-grid">
          {filtered.map((item) => (
            <div key={item._id} className="admin-feedback-card">
              <div className="admin-card-header">
                <div>
                  <span className="badge-pill status-rejected">Report</span>
                  <h3>{item.resourceId?.title || 'Resource'}</h3>
                </div>
                <StatusBadge status={item.status} />
              </div>
              <p className="admin-feedback-desc"><strong>Report Reason:</strong> {item.reason}</p>
              <div className="admin-feedback-meta muted">
                Reported by <strong>{item.userId?.name || 'Student'}</strong> ({item.userId?.email || 'Anonymous'}) on {formatDate(item.createdAt)}
              </div>
              {item.adminReply && (
                <div className="admin-reply-box">
                  <strong>Moderator Notes:</strong>
                  <p>{item.adminReply}</p>
                </div>
              )}
              {item.dismissalReason && (
                <div className="admin-reply-box" style={{ background: '#fef2f2', borderColor: '#fca5a5' }}>
                  <strong style={{ color: '#b91c1c' }}>Dismissal Reason (False Alarm):</strong>
                  <p>{item.dismissalReason}</p>
                </div>
              )}
              {item.resolutionNote && item.resolutionNote !== item.adminReply && (
                <div className="admin-reply-box" style={{ background: '#f0fdf4', borderColor: '#86efac' }}>
                  <strong style={{ color: '#15803d' }}>Resolution Note:</strong>
                  <p>{item.resolutionNote}</p>
                </div>
              )}
              <div className="admin-card-footer mt-4" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  className="action-btn preview-btn"
                  onClick={() => {
                    setReplyModal(item)
                    setReplyStatus(item.status)
                    setReplyText(item.adminReply || item.moderatorReply || '')
                    setModalError('')
                  }}
                >
                  Manage / Respond
                </button>
                {item.status !== 'RESOLVED' && (
                  <button
                    className="action-btn approve-btn"
                    onClick={() => {
                      setReplyModal(item)
                      setReplyStatus('RESOLVED')
                      setReplyText(item.resolutionNote || item.adminReply || '')
                      setModalError('')
                    }}
                  >
                    Resolve
                  </button>
                )}
                {item.status !== 'DISMISSED' && (
                  <button
                    className="action-btn reject-btn"
                    onClick={() => {
                      setReplyModal(item)
                      setReplyStatus('DISMISSED')
                      setReplyText(item.dismissalReason || item.adminReply || '')
                      setModalError('')
                    }}
                  >
                    Dismiss (False)
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Resolve / Reply Modal */}
      {replyModal && (
        <Modal title={`Manage Report: ${replyModal.resourceId?.title || 'Resource'}`} onClose={() => setReplyModal(null)}>
          <form onSubmit={handleReplySubmit}>
            {modalError && <p className="form-error" style={{ marginBottom: 12 }}>{modalError}</p>}
            <p style={{ marginBottom: 12, fontSize: 13, color: '#6b7280' }}>
              Reported for <strong>{replyModal.reason}</strong> by {replyModal.userId?.name || 'Student'}.
              Reports remain in the management interface across all status changes until explicitly resolved or marked as false alarm.
            </p>
            <label>
              Report Status *
              <select value={replyStatus} onChange={(e) => setReplyStatus(e.target.value)}>
                <option value="OPEN">Open (Awaiting action)</option>
                <option value="INVESTIGATING">Under Investigation</option>
                <option value="RESOLVED">Resolved</option>
                <option value="DISMISSED">Dismissed (Mark as false alarm)</option>
              </select>
            </label>
            <label>
              Moderator Action Notes / Reply (Sent to Reporter)
              <textarea
                rows={4}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Document actions taken or explanation for reporter..."
              />
            </label>
            <div className="admin-modal-actions">
              <button type="button" className="secondary-button" onClick={() => setReplyModal(null)}>Cancel</button>
              <button type="submit" className="primary-button" disabled={busy}>
                {busy ? 'Saving...' : 'Save & Update Report'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

// 10. RESOURCE REQUESTS VIEW
function ResourceRequestsView({ token, onReloadOverview }) {
  const [requests, setRequests] = useState([])
  const [approvedResources, setApprovedResources] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [fulfillModal, setFulfillModal] = useState(null)
  const [selectedResourceId, setSelectedResourceId] = useState('')
  const [fulfillReply, setFulfillReply] = useState('')
  const [replyModal, setReplyModal] = useState(null)
  const [replyStatus, setReplyStatus] = useState('OPEN')
  const [replyText, setReplyText] = useState('')
  const [modalError, setModalError] = useState('')
  const [busy, setBusy] = useState(false)

  const loadRequests = useCallback(async () => {
    setLoading(true)
    try {
      const [reqList, resList] = await Promise.all([
        api.listRequests(),
        api.listAdminResources(token, '?status=APPROVED'),
      ])
      setRequests(reqList || [])
      setApprovedResources(resList || [])
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    loadRequests()
  }, [loadRequests])

  const handleFulfill = async (e) => {
    e.preventDefault()
    if (!selectedResourceId) return
    setBusy(true)
    try {
      await api.fulfillRequest(token, fulfillModal._id, selectedResourceId, fulfillReply)
      setFulfillModal(null)
      setSelectedResourceId('')
      setFulfillReply('')
      await loadRequests()
      onReloadOverview?.()
    } catch (err) {
      alert(`Fulfill error: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  const handleReplySubmit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setModalError('')
    try {
      await api.adminReplyRequest(token, replyModal._id, replyStatus, replyText)
      setReplyModal(null)
      setReplyText('')
      await loadRequests()
      onReloadOverview?.()
    } catch (err) {
      setModalError(err.message || 'Failed to update request')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="admin-section-content">
      <div className="admin-header-row">
        <div>
          <p className="eyebrow">DEMAND & REQUESTS</p>
          <h2>Resource Requests ({requests.length})</h2>
        </div>
      </div>

      {error && <p className="form-error">{error}</p>}

      {loading ? (
        <p className="empty-state">Loading resource requests...</p>
      ) : requests.length === 0 ? (
        <p className="empty-state">No student requests submitted.</p>
      ) : (
        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Request Title</th>
                <th>Academic Hierarchy</th>
                <th>Requester</th>
                <th>Upvotes</th>
                <th>Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r._id}>
                  <td>
                    <strong>{r.title}</strong>
                    {r.description && <div className="muted">{r.description}</div>}
                    {r.adminReply && (
                      <div className="admin-reply-box" style={{ marginTop: 6, fontSize: 12 }}>
                        <strong>Staff Reply:</strong> <span>{r.adminReply}</span>
                      </div>
                    )}
                  </td>
                  <td>
                    <div>{r.programId?.code || '-'} &gt; {r.branchId?.code || '-'}</div>
                    <div className="muted">Sem {r.semesterId?.number || '-'} • {r.subjectId?.name || 'Subject'}</div>
                  </td>
                  <td>{r.creatorId?.name || 'Student'}</td>
                  <td><strong>▲ {r.upvotes ?? r.upvoterIds?.length ?? 0}</strong></td>
                  <td>{formatDate(r.createdAt)}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="action-btn preview-btn"
                        onClick={() => {
                          setReplyModal(r)
                          setReplyStatus(r.status)
                          setReplyText(r.adminReply || '')
                        }}
                      >
                        Respond / Status
                      </button>
                      {r.status === 'OPEN' && (
                        <button
                          type="button"
                          className="action-btn approve-btn"
                          onClick={() => {
                            setFulfillModal(r)
                            setSelectedResourceId(approvedResources[0]?._id || '')
                            setFulfillReply('')
                          }}
                        >
                          Fulfill
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Reply Modal */}
      {replyModal && (
        <Modal title={`Respond to Request: ${replyModal.title}`} onClose={() => setReplyModal(null)}>
          <form onSubmit={handleReplySubmit}>
            <label>
              Update Status *
              <select value={replyStatus} onChange={(e) => setReplyStatus(e.target.value)}>
                <option value="OPEN">Open</option>
                <option value="FULFILLED">Fulfilled</option>
                <option value="CLOSED">Closed / Declined</option>
              </select>
            </label>
            <label>
              Staff Response Message (Sent to Requester in-app & by email)
              <textarea
                rows={4}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Write an update to notify the student..."
              />
            </label>
            <div className="admin-modal-actions">
              <button type="button" className="secondary-button" onClick={() => setReplyModal(null)}>
                Cancel
              </button>
              <button type="submit" className="primary-button" disabled={busy}>
                {busy ? 'Saving...' : 'Send Response'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Fulfill Modal */}
      {fulfillModal && (
        <Modal title={`Fulfill Request: ${fulfillModal.title}`} onClose={() => setFulfillModal(null)}>
          <form onSubmit={handleFulfill}>
            <p>Select an approved library resource to attach and fulfill this request. All requesting students will be notified.</p>
            <label>
              Matching Approved Resource *
              <select
                required
                value={selectedResourceId}
                onChange={(e) => setSelectedResourceId(e.target.value)}
              >
                <option value="">Select Resource</option>
                {approvedResources.map((res) => (
                  <option key={res._id} value={res._id}>
                    {res.title} ({res.resourceType} - {res.subjectId?.name || 'Subject'})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Optional Note / Staff Reply
              <textarea
                rows={3}
                value={fulfillReply}
                onChange={(e) => setFulfillReply(e.target.value)}
                placeholder="e.g. Attached professor verified lecture slides."
              />
            </label>
            <div className="admin-modal-actions">
              <button type="button" className="secondary-button" onClick={() => setFulfillModal(null)}>Cancel</button>
              <button type="submit" className="primary-button" disabled={busy || !selectedResourceId}>
                {busy ? 'Fulfilling...' : 'Confirm Fulfillment'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

// 11. ANALYTICS VIEW
function AnalyticsView({ token }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    api.getAdminAnalytics(token)
      .then((res) => {
        if (active) {
          setData(res)
          setError('')
          setLoading(false)
        }
      })
      .catch((err) => {
        if (active) {
          setError(err.message)
          setLoading(false)
        }
      })
    return () => { active = false }
  }, [token])

  if (loading) return <p className="empty-state">Loading platform analytics...</p>
  if (error) return <p className="form-error">{error}</p>
  if (!data) return <p className="empty-state">No analytics available.</p>

  const totalTypeCount = (data.byType || []).reduce((sum, item) => sum + item.count, 0) || 1
  const totalBranchCount = (data.byBranch || []).reduce((sum, item) => sum + item.count, 0) || 1

  return (
    <div className="admin-section-content">
      <div className="admin-header-row">
        <div>
          <p className="eyebrow">DEEP INSIGHTS</p>
          <h2>Platform Analytics</h2>
        </div>
      </div>

      <div className="admin-analytics-grid">
        {/* Resource Distribution by Type */}
        <div className="admin-card">
          <h3>Resources by Type</h3>
          <div className="admin-chart-bars">
            {(data.byType || []).map((t) => {
              const pct = Math.round((t.count / totalTypeCount) * 100)
              return (
                <div key={t._id} className="admin-bar-row">
                  <div className="bar-labels">
                    <span>{t._id}</span>
                    <strong>{t.count} ({pct}%)</strong>
                  </div>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Resources by Branch */}
        <div className="admin-card">
          <h3>Resources by Branch</h3>
          <div className="admin-chart-bars">
            {(data.byBranch || []).map((b) => {
              const pct = Math.round((b.count / totalBranchCount) * 100)
              return (
                <div key={b._id} className="admin-bar-row">
                  <div className="bar-labels">
                    <span>{b.name} ({b.code})</span>
                    <strong>{b.count} ({pct}%)</strong>
                  </div>
                  <div className="bar-track">
                    <div className="bar-fill bar-orange" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Resources by Semester */}
        <div className="admin-card">
          <h3>Resources by Semester</h3>
          <div className="admin-chart-bars">
            {(data.bySemester || []).map((s) => (
              <div key={s._id} className="admin-bar-row">
                <div className="bar-labels">
                  <span>Semester {s.number || '?'} ({s.name})</span>
                  <strong>{s.count}</strong>
                </div>
                <div className="bar-track">
                  <div className="bar-fill bar-blue" style={{ width: `${Math.min(100, s.count * 10)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Exam Types */}
        <div className="admin-card">
          <h3>Exam Paper Distribution</h3>
          <div className="admin-chart-bars">
            {(data.byExamType || []).map((e) => (
              <div key={e._id || 'None'} className="admin-bar-row">
                <div className="bar-labels">
                  <span>{e._id || 'Standard Note'}</span>
                  <strong>{e.count}</strong>
                </div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${Math.min(100, e.count * 10)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Contributors */}
        <div className="admin-card">
          <h3>Top Contributors Leaderboard</h3>
          <div className="admin-activity-list">
            {(data.topContributors || []).map((tc, idx) => (
              <div key={tc._id || idx} className="admin-activity-item">
                <div>
                  <strong>#{idx + 1} {tc.name || 'Student'}</strong>
                  <div className="muted">{tc.count} approved uploads</div>
                </div>
                <strong className="text-orange">{tc.downloads} downloads</strong>
              </div>
            ))}
          </div>
        </div>

        {/* Most Downloaded */}
        <div className="admin-card">
          <h3>Most Downloaded Resources</h3>
          <div className="admin-activity-list">
            {(data.popularResources || []).map((pr, idx) => (
              <div key={pr._id} className="admin-activity-item">
                <div>
                  <strong>#{idx + 1} {pr.title}</strong>
                  <div className="muted">{pr.subjectId?.name || 'Subject'} • {pr.resourceType}</div>
                </div>
                <strong className="text-blue">{pr.downloadCount} dl</strong>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// 12. AUDIT LOGS VIEW
function AuditLogsView({ token }) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filterAction, setFilterAction] = useState('ALL')

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.listAdminAuditLogs(token)
      setLogs(res || [])
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchAction = filterAction === 'ALL' || log.action === filterAction
      const matchSearch =
        !search ||
        log.action?.toLowerCase().includes(search.toLowerCase()) ||
        log.actorId?.name?.toLowerCase().includes(search.toLowerCase()) ||
        log.entityType?.toLowerCase().includes(search.toLowerCase()) ||
        JSON.stringify(log.metadata || '').toLowerCase().includes(search.toLowerCase())
      return matchAction && matchSearch
    })
  }, [logs, filterAction, search])

  const distinctActions = useMemo(() => {
    return Array.from(new Set(logs.map((l) => l.action))).filter(Boolean)
  }, [logs])

  return (
    <div className="admin-section-content">
      <div className="admin-header-row">
        <div>
          <p className="eyebrow">SECURITY & COMPLIANCE</p>
          <h2>Audit Trail ({filteredLogs.length})</h2>
        </div>
        <button className="secondary-button" onClick={fetchLogs} disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh Logs ↻'}
        </button>
      </div>

      <div className="admin-filters-toolbar">
        <div className="admin-search-form">
          <input
            placeholder="Filter audit actions, actors, or metadata..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="admin-filter-group">
          <select value={filterAction} onChange={(e) => setFilterAction(e.target.value)}>
            <option value="ALL">All Actions</option>
            {distinctActions.map((act) => (
              <option key={act} value={act}>{act}</option>
            ))}
          </select>
        </div>
      </div>

      {error && <p className="form-error">{error}</p>}

      {loading ? (
        <p className="empty-state">Loading security audit logs...</p>
      ) : filteredLogs.length === 0 ? (
        <p className="empty-state">No audit log records match your filter.</p>
      ) : (
        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Entity Target</th>
                <th>Details / Reason</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log) => (
                <tr key={log._id}>
                  <td className="muted font-mono">{formatDateTime(log.createdAt)}</td>
                  <td>
                    <strong>{log.actorId?.name || 'System / Security'}</strong>
                    {log.actorId?.role && <div className="muted">{log.actorId.role}</div>}
                  </td>
                  <td>
                    <span className="audit-action-pill">{log.action}</span>
                  </td>
                  <td>
                    <div>{log.entityType || '-'}</div>
                    {log.entityId && <div className="muted font-mono">{log.entityId}</div>}
                  </td>
                  <td>
                    {log.reason && <div className="font-semibold">{log.reason}</div>}
                    {log.metadata && (
                      <pre className="audit-meta-pre">
                        {JSON.stringify(log.metadata, null, 2)}
                      </pre>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// 13. SETTINGS & PROFILE VIEW
function AdminSettingsView({ currentUser, onLogout, onLogoutAll, onProfileUpdated }) {
  const { updateProfile } = useAuth()
  const [name, setName] = useState(currentUser?.name || '')
  const [bio, setBio] = useState(currentUser?.bio || '')
  const [busy, setBusy] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  const handleProfileSubmit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    setSuccess('')
    try {
      const updated = await updateProfile({ name, bio })
      onProfileUpdated?.(updated)
      setSuccess('Profile updated successfully!')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="admin-section-content">
      <div className="admin-header-row">
        <div>
          <p className="eyebrow">STAFF ACCOUNT</p>
          <h2>Admin Settings & Profile</h2>
        </div>
      </div>

      <div className="admin-cards-grid">
        <div className="admin-card">
          <h3>Your Profile</h3>
          <div className="admin-detail-grid mb-4">
            <div><strong>Email:</strong> {currentUser?.email}</div>
            <div><strong>Role:</strong> <span className={`role-badge role-${currentUser?.role?.toLowerCase()}`}>{currentUser?.role}</span></div>
            <div><strong>Account ID:</strong> <span className="font-mono muted">{currentUser?._id}</span></div>
          </div>

          <form onSubmit={handleProfileSubmit} className="admin-form-grid">
            <label>
              Display Name
              <input required value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label>
              Bio / Title
              <textarea rows={2} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="e.g. Lead Administrator" />
            </label>
            {error && <p className="form-error">{error}</p>}
            {success && <p className="success-message">{success}</p>}
            <button type="submit" className="primary-button" disabled={busy}>
              {busy ? 'Saving...' : 'Update Profile'}
            </button>
          </form>
        </div>

        <div className="admin-card">
          <h3>Session & Security</h3>
          <p className="muted mb-4">Manage your staff session tokens across devices.</p>

          <div className="admin-session-actions">
            <div className="session-item">
              <div>
                <strong>Sign Out Current Session</strong>
                <p className="muted">Revokes your current browser refresh token and ends this session.</p>
              </div>
              <button className="action-btn reject-btn" onClick={onLogout}>Sign Out</button>
            </div>

            <div className="session-item mt-4">
              <div>
                <strong>Sign Out All Devices</strong>
                <p className="muted">Revokes all active token families and refresh sessions across every device.</p>
              </div>
              <button className="action-btn delete-btn" onClick={onLogoutAll}>Sign Out All Devices</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// MAIN ADMIN PAGE EXPORT
export default function AdminPage({ currentPath = '/admin', onNavigate }) {
  const { user, accessToken, logout, logoutAll } = useAuth()
  const [overview, setOverview] = useState(null)
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)
  const [error, setError] = useState('')

  const getTabFromPath = (path) => {
    if (path.includes('/admin/uploads')) return 'uploads'
    if (path.includes('/admin/resources')) return 'resources'
    if (path.includes('/admin/users')) return 'users'
    if (path.includes('/admin/academic')) return 'academic'
    if (path.includes('/admin/contributors')) return 'contributors'
    if (path.includes('/admin/team')) return 'team'
    if (path.includes('/admin/suggestions')) return 'suggestions'
    if (path.includes('/admin/reports')) return 'reports'
    if (path.includes('/admin/requests')) return 'requests'
    if (path.includes('/admin/analytics')) return 'analytics'
    if (path.includes('/admin/audit')) return 'audit'
    if (path.includes('/admin/settings')) return 'settings'
    return 'dashboard'
  }

  const activeTab = getTabFromPath(currentPath)

  const navigateTab = (tab) => {
    setMobileDrawerOpen(false)
    const nextPath = tab === 'dashboard' ? '/admin' : `/admin/${tab}`
    onNavigate(nextPath)
  }

  const loadOverview = useCallback(() => {
    if (accessToken && ['ADMIN', 'MODERATOR'].includes(user?.role)) {
      api.getAdminOverview(accessToken)
        .then(setOverview)
        .catch((err) => setError(err.message))
    }
  }, [accessToken, user?.role])

  useEffect(() => {
    loadOverview()
  }, [loadOverview])

  if (!user || !accessToken) {
    return (
      <main className="directory-page">
        <div className="directory-hero">
          <p className="eyebrow">ADMINISTRATION</p>
          <h1>
            Sign in to<br />
            <em>continue.</em>
          </h1>
          <p>This workspace is restricted to moderators and administrators.</p>
          <button className="primary-button" onClick={() => onNavigate('/login')}>
            Sign in ↗
          </button>
        </div>
      </main>
    )
  }

  if (!['ADMIN', 'MODERATOR'].includes(user.role)) {
    return (
      <main className="directory-page">
        <div className="directory-hero">
          <p className="eyebrow">ACCESS RESTRICTED</p>
          <h1>
            This space is<br />
            <em>staff only.</em>
          </h1>
          <p>Your student account does not have moderation or administrative permissions.</p>
          <button className="secondary-button" onClick={() => onNavigate('/dashboard')}>
            Back to dashboard →
          </button>
        </div>
      </main>
    )
  }

  const stats = overview?.statistics || {}

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'uploads', label: 'Pending Reviews', icon: '📥', count: stats.pendingUploads },
    { id: 'resources', label: 'Resources', icon: '📚' },
    { id: 'users', label: 'Users', icon: '👥' },
    { id: 'academic', label: 'Academic Structure', icon: '🏛️' },
    { id: 'contributors', label: 'Contributors', icon: '🌟' },
    { id: 'team', label: 'Developers / Team', icon: '💻' },
    { id: 'suggestions', label: 'Suggestions', icon: '💡', count: stats.pendingSuggestions },
    { id: 'reports', label: 'Reports', icon: '🚩', count: stats.pendingReports },
    { id: 'requests', label: 'Resource Requests', icon: '❓', count: stats.openRequests },
    { id: 'analytics', label: 'Analytics', icon: '📈' },
    { id: 'audit', label: 'Audit Logs', icon: '📜' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
  ]

  return (
    <div className="admin-layout">
      {/* Mobile Drawer Toggle Header */}
      <div className="admin-mobile-bar">
        <button
          className="admin-menu-toggle"
          onClick={() => setMobileDrawerOpen(!mobileDrawerOpen)}
          aria-label="Toggle admin navigation"
        >
          {mobileDrawerOpen ? '✕ Close Menu' : '☰ Admin Menu'}
        </button>
        <div className="admin-user-pill">
          <span>{user.name}</span>
          <span className={`role-badge role-${user.role.toLowerCase()}`}>{user.role}</span>
        </div>
      </div>

      {/* Admin Sidebar Navigation */}
      <aside className={`admin-sidebar ${mobileDrawerOpen ? 'drawer-open' : ''}`}>
        <div className="admin-sidebar-header">
          <p className="eyebrow">STAFF WORKSPACE</p>
          <h2>Admin Hub</h2>
          <div className="admin-user-info">
            <div className="font-semibold">{user.name}</div>
            <span className={`role-badge role-${user.role.toLowerCase()}`}>{user.role}</span>
          </div>
        </div>

        <nav className="admin-sidebar-nav" aria-label="Admin Navigation">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`admin-nav-button ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => navigateTab(item.id)}
            >
              <span className="nav-icon" aria-hidden="true">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
              {item.count > 0 && <span className="nav-count-badge">{item.count}</span>}
            </button>
          ))}
        </nav>

        <div className="admin-sidebar-footer">
          <button className="admin-nav-button" onClick={() => onNavigate('/dashboard')}>
            <span className="nav-icon">←</span>
            <span className="nav-label">Student View</span>
          </button>
          <button className="admin-nav-button text-red" onClick={logout}>
            <span className="nav-icon">⏻</span>
            <span className="nav-label">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="admin-main-viewport">
        {error && <p className="form-error">{error}</p>}

        {activeTab === 'dashboard' && (
          <AdminDashboardView overview={overview} onNavigateTab={navigateTab} currentUser={user} />
        )}
        {activeTab === 'uploads' && (
          <PendingReviewsView
            token={accessToken}
            onReloadOverview={loadOverview}
          />
        )}
        {activeTab === 'resources' && (
          <ResourceManagementView
            token={accessToken}
            onReloadOverview={loadOverview}
          />
        )}
        {activeTab === 'users' && (
          <UserManagementView
            token={accessToken}
            currentUser={user}
            onReloadOverview={loadOverview}
          />
        )}
        {activeTab === 'academic' && (
          <AcademicStructureView
            token={accessToken}
            currentUser={user}
          />
        )}
        {activeTab === 'contributors' && (
          <ContributorManagementView
            token={accessToken}
            onNavigate={onNavigate}
          />
        )}
        {activeTab === 'team' && (
          <DeveloperManagementView
            token={accessToken}
            currentUser={user}
          />
        )}
        {activeTab === 'suggestions' && (
          <SuggestionsManagementView
            token={accessToken}
            onReloadOverview={loadOverview}
          />
        )}
        {activeTab === 'reports' && (
          <ReportsManagementView
            token={accessToken}
            onReloadOverview={loadOverview}
          />
        )}
        {activeTab === 'requests' && (
          <ResourceRequestsView
            token={accessToken}
            onReloadOverview={loadOverview}
          />
        )}
        {activeTab === 'analytics' && (
          <AnalyticsView token={accessToken} />
        )}
        {activeTab === 'audit' && (
          <AuditLogsView token={accessToken} />
        )}
        {activeTab === 'settings' && (
          <AdminSettingsView
            currentUser={user}
            onLogout={logout}
            onLogoutAll={logoutAll}
          />
        )}
      </main>
    </div>
  )
}
