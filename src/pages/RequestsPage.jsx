import { useEffect, useState } from 'react'
import { api } from '../services/api.js'
import { useAuth } from '../context/useAuth.js'

export default function RequestsPage({ onNavigate }) {
  const { accessToken } = useAuth(); const [requests, setRequests] = useState([]); const [title, setTitle] = useState(''); const [description, setDescription] = useState(''); const [error, setError] = useState('')
  const load = () => api.listRequests().then(setRequests).catch(() => setError('Requests are temporarily unavailable.'))
  useEffect(() => { load() }, [])
  const create = async (event) => { event.preventDefault(); if (!accessToken) return onNavigate('/login'); try { await api.createRequest(accessToken, { title, description }); setTitle(''); setDescription(''); await load() } catch (requestError) { setError(requestError.message) } }
  const upvote = async (id) => { if (!accessToken) return onNavigate('/login'); try { await api.upvoteRequest(accessToken, id); await load() } catch (requestError) { setError(requestError.message) } }
  return <main className="directory-page requests-page"><div className="directory-hero"><p className="eyebrow">COMMUNITY WISHLIST</p><h1>Ask for what<br /><em>you need.</em></h1><p>Request a missing paper, set of notes, or resource. Other students can upvote the requests they need too.</p></div><form className="request-form" onSubmit={create}><input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. DBMS End Term 2024 paper" /><textarea required rows="3" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Add a little context for contributors." /><button className="primary-button">Create request ↗</button></form>{error && <p className="form-error">{error}</p>}<div className="request-list">{requests.length ? requests.map((request) => <article className="request-row" key={request._id}><div><p className="eyebrow">{request.status}</p><h2>{request.title}</h2><p>{request.description}</p></div><button className={`upvote-button ${request.hasUpvoted ? 'upvoted' : ''}`} onClick={() => upvote(request._id)} aria-label={`Upvote ${request.title}`}>↑ {request.upvotes}</button></article>) : <p className="empty-state">No requests yet. Start the wishlist.</p>}</div></main>
}
