import { useEffect, useState } from 'react'
import { useAuth } from '../context/useAuth.js'
import { api } from '../services/api.js'

function label(value = '') { return value.replaceAll('_', ' ') }

export default function ResourceDetailPage({ id, onNavigate }) {
  const { accessToken, user } = useAuth()
  const [resource, setResource] = useState(null)
  const [bookmarked, setBookmarked] = useState(false)
  const [status, setStatus] = useState('loading')
  const [message, setMessage] = useState('')
  const [reportOpen, setReportOpen] = useState(false)
  const [correctionOpen, setCorrectionOpen] = useState(false)
  const [requestChangesOpen, setRequestChangesOpen] = useState(false)
  const [changesMessage, setChangesMessage] = useState('')

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'MODERATOR'

  useEffect(() => {
    let active = true
    api.getResource(id).then((data) => {
      if (active) {
        setResource(data)
        setStatus('ready')
        if (accessToken) {
          api.addRecentlyViewed(accessToken, id).catch(() => {})
          api.listBookmarks(accessToken).then((items) => {
            if (active) setBookmarked(items.some((item) => item.resourceId?._id === id))
          }).catch(() => {})
        }
      }
    }).catch(() => { if (active) setStatus('error') })
    return () => { active = false }
  }, [accessToken, id])

  if (status === 'loading') return <main className="directory-page"><p className="empty-state">Loading resource...</p></main>
  if (status === 'error' || !resource) return <main className="directory-page"><div className="directory-hero"><p className="eyebrow">RESOURCE NOT FOUND</p><h1>This resource is<br /><em>not available.</em></h1><p>It may still be under review, rejected, or no longer published.</p><button className="secondary-button" onClick={() => onNavigate('/resources')}>Back to resources →</button></div></main>

  const toggleBookmark = async () => {
    if (!accessToken) return onNavigate('/login')
    setMessage('')
    try {
      if (bookmarked) await api.removeBookmark(accessToken, id)
      else await api.addBookmark(accessToken, id)
      setBookmarked(!bookmarked)
      setMessage(bookmarked ? 'Removed from saved resources.' : 'Saved to your resources.')
    } catch (error) {
      setMessage(error.message)
    }
  }

  const download = async () => {
    try {
      const result = await api.downloadResource(accessToken, id)
      const downloadUrl = result.url?.startsWith('http')
        ? result.url
        : `${import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '') : 'http://localhost:4000'}${result.url}`
      window.open(downloadUrl, '_blank', 'noopener,noreferrer')
      setMessage('Download recorded.')
    } catch (error) {
      setMessage(error.message)
    }
  }

  const submitReport = async (event) => {
    event.preventDefault()
    try {
      const form = new FormData(event.currentTarget)
      await api.reportResource(accessToken, id, { reason: form.get('reason'), details: form.get('details') })
      setReportOpen(false)
      setMessage('Report submitted for review.')
    } catch (error) {
      setMessage(error.message)
    }
  }

  const submitCorrection = async (event) => {
    event.preventDefault()
    try {
      const form = new FormData(event.currentTarget)
      await api.suggest(accessToken, { title: `Correction: ${resource.title}`, category: 'INCORRECT_INFORMATION', description: form.get('details') })
      setCorrectionOpen(false)
      setMessage('Correction suggestion submitted.')
    } catch (error) {
      setMessage(error.message)
    }
  }

  const submitChangesRequest = async (event) => {
    event.preventDefault()
    if (!changesMessage.trim()) return
    try {
      await api.requestChangesResource(accessToken, id, changesMessage.trim())
      setRequestChangesOpen(false)
      setChangesMessage('')
      setMessage('Modification request successfully sent to the author by notification and email.')
    } catch (error) {
      setMessage(error.message)
    }
  }

  return (
    <main className="detail-page">
      <button className="back-link" onClick={() => onNavigate('/resources')}>← All resources</button>
      <div className="detail-header">
        <div>
          <p className="eyebrow">{label(resource.resourceType)} {resource.examType !== 'NONE' ? `• ${label(resource.examType)}` : ''}</p>
          <h1>{resource.title}</h1>
          <p className="detail-meta">
            {resource.academicYear || 'Study material'} <span>•</span> {resource.subjectId?.name || 'Subject'} <span>•</span> {resource.branchId?.code || 'University resource'}
          </p>
        </div>
        <span className="verified-badge">✓ Community Verified</span>
      </div>

      <div className="detail-layout">
        <section className="detail-main">
          <div className="detail-facts">
            <div><span>Program</span><strong>{resource.programId?.name || '—'}</strong></div>
            <div><span>Branch</span><strong>{resource.branchId?.code || '—'}</strong></div>
            <div><span>Semester</span><strong>{resource.semesterId?.number ? `Semester ${resource.semesterId.number}` : '—'}</strong></div>
            <div><span>Subject code</span><strong>{resource.subjectId?.code || '—'}</strong></div>
          </div>
          <p className="detail-description">{resource.description || 'This community resource has been reviewed by the platform team.'}</p>
          <div className="detail-actions">
            <button className="primary-button" onClick={download}>Download PDF ↗</button>
            <button className="secondary-button" onClick={toggleBookmark}>
              {bookmarked ? 'Remove bookmark' : 'Save resource'} {bookmarked ? '✓' : '☆'}
            </button>
          </div>
          {message && <p className="success-message" role="status">{message}</p>}

          <div className="detail-secondary-actions">
            <button
              className="text-link"
              onClick={() => {
                if (!accessToken) return onNavigate('/login')
                setReportOpen(!reportOpen)
                setCorrectionOpen(false)
                setRequestChangesOpen(false)
              }}
            >
              Report resource
            </button>
            <button
              className="text-link"
              onClick={() => {
                if (!accessToken) return onNavigate('/login')
                setCorrectionOpen(!correctionOpen)
                setReportOpen(false)
                setRequestChangesOpen(false)
              }}
            >
              Suggest correction
            </button>
            {isAdmin && (
              <button
                className="text-link"
                style={{ color: '#d97706', fontWeight: 600 }}
                onClick={() => {
                  setRequestChangesOpen(!requestChangesOpen)
                  setReportOpen(false)
                  setCorrectionOpen(false)
                }}
              >
                Request modifications from author
              </button>
            )}
          </div>

          {reportOpen && (
            <form className="inline-form" onSubmit={submitReport}>
              <label>
                Reason
                <select name="reason" defaultValue="INCORRECT_FILE">
                  <option value="INCORRECT_FILE">Incorrect file</option>
                  <option value="WRONG_SUBJECT">Wrong subject</option>
                  <option value="WRONG_SEMESTER">Wrong semester</option>
                  <option value="DUPLICATE">Duplicate</option>
                  <option value="POOR_QUALITY">Poor quality</option>
                  <option value="COPYRIGHT_CONCERN">Copyright concern</option>
                  <option value="OTHER">Other</option>
                </select>
              </label>
              <label>Details<textarea name="details" rows="3" required placeholder="Tell the moderation team what needs attention." /></label>
              <button className="primary-button">Submit report</button>
            </form>
          )}

          {correctionOpen && (
            <form className="inline-form" onSubmit={submitCorrection}>
              <label>Correction details<textarea name="details" rows="3" required placeholder="What information should be corrected?" /></label>
              <button className="primary-button">Submit correction</button>
            </form>
          )}

          {requestChangesOpen && (
            <form className="inline-form" onSubmit={submitChangesRequest}>
              <label>
                Required Modifications for Author
                <textarea
                  name="changesMessage"
                  rows="3"
                  required
                  value={changesMessage}
                  onChange={(e) => setChangesMessage(e.target.value)}
                  placeholder="Explain to the author what needs to be changed (an in-app notification and email will be sent)..."
                />
              </label>
              <button className="primary-button" type="submit">Send Modification Request</button>
            </form>
          )}
        </section>

        <aside className="detail-sidebar">
          <div className="contributor-credit">
            <p className="eyebrow">SHARED BY</p>
            <h2>{resource.contributor || 'Community contributor'}</h2>
            {resource.contributor && resource.contributorId && (
              <button className="text-link" onClick={() => onNavigate(`/contributors/${resource.contributorId}`)}>
                View contributor →
              </button>
            )}
          </div>
          <div className="detail-stat"><strong>{resource.downloadCount || 0}</strong><span>downloads</span></div>
          <div className="detail-stat"><strong>{new Date(resource.createdAt).toLocaleDateString()}</strong><span>uploaded</span></div>
        </aside>
      </div>
    </main>
  )
}
