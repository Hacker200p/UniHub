import { useEffect, useState } from 'react'
import { api } from '../services/api.js'

function ResourceCard({ resource, onNavigate }) {
  return <article className="resource-card"><div className="file-icon">PDF</div><div><p className="eyebrow">{resource.resourceType} {resource.examType !== 'NONE' ? `• ${resource.examType.replace('_', ' ')}` : ''}</p><h3>{resource.title}</h3><p className="resource-card-meta">{resource.academicYear || 'Study material'} <span>•</span> {resource.contributor || 'Community contributor'}</p></div><button className="download" onClick={() => onNavigate(`/resources/${resource._id}`)}>View ↗</button></article>
}

export default function ResourcesPage({ onNavigate }) {
  const [resources, setResources] = useState([])
  const params = new URLSearchParams(window.location.search)
  const [query, setQuery] = useState(params.get('q') || '')
  const [resourceType, setResourceType] = useState(params.get('resourceType') || 'all')
  const [status, setStatus] = useState('loading')
  useEffect(() => { let active = true; const search = new URLSearchParams(window.location.search); if (query) search.set('q', query); if (resourceType !== 'all') search.set('resourceType', resourceType); api.listResources(search.toString() ? `?${search.toString()}` : '').then((data) => { if (active) { setResources(data); setStatus('ready') } }).catch(() => { if (active) setStatus('error') }); return () => { active = false } }, [query, resourceType])
  const filtered = resources
  return <main className="directory-page resources-page"><div className="directory-hero"><p className="eyebrow">THE COMMUNITY LIBRARY</p><h1>Find your next<br /><em>starting point.</em></h1><p>Browse community-verified notes and previous-year questions shared by students across the university.</p></div><div className="directory-controls"><input aria-label="Search resources" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search resources" /><select aria-label="Filter resource type" value={resourceType} onChange={(event) => setResourceType(event.target.value)}><option value="all">All resource types</option><option value="NOTES">Notes</option><option value="PYQ">PYQs</option></select></div>{status === 'loading' && <p className="empty-state">Loading resources...</p>}{status === 'error' && <p className="empty-state">Resources are temporarily unavailable. Please try again shortly.</p>}{status === 'ready' && <div className="resource-grid">{filtered.length ? filtered.map((resource) => <ResourceCard key={resource._id} resource={resource} onNavigate={onNavigate} />) : <p className="empty-state">No resources match your search yet.</p>}</div>}</main>
}
