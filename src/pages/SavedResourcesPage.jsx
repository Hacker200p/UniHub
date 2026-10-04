import { useEffect, useState } from 'react'
import { useAuth } from '../context/useAuth.js'
import { api } from '../services/api.js'

function ResourceList({ items, emptyLabel }) { if (!items.length) return <p className="empty-state">{emptyLabel}</p>; return <div className="resource-list">{items.map((item) => { const resource = item.resourceId || item; return <article className="resource-row" key={resource._id}><div className="file-icon">PDF</div><div className="resource-main"><h3>{resource.title}</h3><p>{resource.resourceType} <span>•</span> {resource.academicYear || 'Study material'}</p></div>{resource.file?.url && <a className="download" href={resource.file.url} target="_blank" rel="noreferrer">View ↗</a>}</article> })}</div> }

export default function SavedResourcesPage({ mode = 'bookmarks', onNavigate }) {
  const { accessToken } = useAuth()
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => { if (!accessToken) return; const load = mode === 'bookmarks' ? api.listBookmarks(accessToken) : api.listRecentlyViewed(accessToken); load.then(setItems).catch((requestError) => setError(requestError.message)) }, [accessToken, mode])
  if (!accessToken) return <main className="directory-page"><div className="directory-hero"><p className="eyebrow">MEMBER ACCESS</p><h1>Sign in to see<br /><em>your library.</em></h1><button className="primary-button" onClick={() => onNavigate('/login')}>Sign in ↗</button></div></main>
  return <main className="directory-page saved-page"><div className="directory-hero"><p className="eyebrow">YOUR PERSONAL LIBRARY</p><h1>{mode === 'bookmarks' ? <>Saved <em>resources.</em></> : <>Recently <em>viewed.</em></>}</h1><p>{mode === 'bookmarks' ? 'Keep useful notes and question papers close for your next study session.' : 'Pick up where you left off in the community library.'}</p></div>{error ? <p className="empty-state">{error}</p> : !items ? <p className="empty-state">Loading your resources...</p> : <ResourceList items={items} emptyLabel={mode === 'bookmarks' ? 'You have not bookmarked any resources yet.' : 'Nothing viewed recently.'} />}</main>
}
