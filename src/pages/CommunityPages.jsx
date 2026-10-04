import { useEffect, useState } from 'react'
import { api } from '../services/api.js'

function initials(name = '') {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function Avatar({ name }) {
  return <div className="avatar avatar-blue">{initials(name)}</div>
}

function Loading() {
  return <p className="empty-state">Loading community profiles...</p>
}

function ErrorState() {
  return <p className="empty-state">Community profiles are temporarily unavailable.</p>
}

function ContributorCard({ contributor, onNavigate }) {
  return (
    <article className="contributor-card">
      <div className="contributor-top">
        <Avatar name={contributor.name} />
        <span className="verified">✓ Community profile</span>
      </div>
      <h3>{contributor.name}</h3>
      <p className="contributor-meta">
        {contributor.programId?.name || 'University student'} <span>•</span>{' '}
        {contributor.branchId?.code || 'Branch not listed'}
      </p>
      <p className="muted">
        {contributor.semesterId?.number
          ? `Semester ${contributor.semesterId.number}`
          : 'Semester not listed'}
      </p>
      <div className="contribution-count">
        <strong>{contributor.approvedContributions}</strong>
        <span>approved contributions</span>
      </div>
      <button
        className="text-link"
        onClick={() => onNavigate(`/contributors/${contributor._id}`)}
      >
        View contributions <span>→</span>
      </button>
    </article>
  )
}

export function ContributorsDirectoryPage({ onNavigate, selectedId }) {
  const [state, setState] = useState({
    id: selectedId,
    data: null,
    error: false,
    loading: true,
  })

  useEffect(() => {
    let active = true
    const load = selectedId ? api.getContributor(selectedId) : api.listContributors()
    load
      .then((res) => {
        if (active) setState({ id: selectedId, data: res, error: false, loading: false })
      })
      .catch(() => {
        if (active) setState({ id: selectedId, data: null, error: true, loading: false })
      })
    return () => {
      active = false
    }
  }, [selectedId])

  const isLoading = state.loading || state.id !== selectedId

  if (state.error && state.id === selectedId) {
    return (
      <main className="directory-page">
        <ErrorState />
      </main>
    )
  }

  if (isLoading || !state.data) {
    return (
      <main className="directory-page">
        <Loading />
      </main>
    )
  }

  const data = state.data

  if (selectedId && data.contributor) {
    const contributor = data.contributor
    return (
      <main className="profile-page">
        <button className="back-link" onClick={() => onNavigate('/contributors')}>
          ← All contributors
        </button>
        <div className="profile-header">
          <Avatar name={contributor.name} />
          <div>
            <p className="eyebrow">PUBLIC CONTRIBUTOR PROFILE</p>
            <h1>{contributor.name}'s contributions</h1>
            <p>
              {contributor.programId?.name || 'University student'} <span>•</span>{' '}
              {contributor.branchId?.code || 'Branch not listed'}
            </p>
          </div>
        </div>
        <div className="profile-stats">
          <div>
            <strong>{data.statistics.approvedContributions}</strong>
            <span>Approved contributions</span>
          </div>
          <div>
            <strong>{data.statistics.totalDownloads}</strong>
            <span>Total downloads</span>
          </div>
          <div>
            <strong>{data.statistics.subjectsContributed}</strong>
            <span>Subjects contributed to</span>
          </div>
        </div>
        <div className="profile-toolbar">
          <h2>Academic resources</h2>
          <div>
            <button className="filter-active">All</button>
            <button>Notes</button>
            <button>PYQs</button>
          </div>
        </div>
        <div className="resource-list">
          {data.resources.map((resource) => (
            <article className="resource-row" key={resource._id}>
              <div className="file-icon">PDF</div>
              <div className="resource-main">
                <h3>{resource.title}</h3>
                <p>
                  {resource.resourceType} <span>•</span>{' '}
                  {resource.academicYear || 'Study material'}
                </p>
              </div>
              <a className="download" href={resource.file?.url} target="_blank" rel="noreferrer">
                View ↗
              </a>
            </article>
          ))}
        </div>
      </main>
    )
  }

  const list = Array.isArray(data) ? data : []
  return (
    <main className="directory-page">
      <div className="directory-hero">
        <p className="eyebrow">THE COMMUNITY LIBRARY</p>
        <h1>
          Meet our<br />
          <em>contributors.</em>
        </h1>
        <p>
          Students who turn their notes into a better starting point for everyone. Explore the
          resources they have shared.
        </p>
      </div>
      <div className="directory-controls">
        <input aria-label="Search contributors" placeholder="Search contributors" />
        <select aria-label="Filter by branch" defaultValue="all">
          <option value="all">All branches</option>
          <option>CSE</option>
          <option>ECE</option>
          <option>IMCA</option>
        </select>
      </div>
      <div className="contributor-grid contributor-grid-wide">
        {list.map((contributor) => (
          <ContributorCard key={contributor._id} contributor={contributor} onNavigate={onNavigate} />
        ))}
      </div>
    </main>
  )
}

export function TeamDirectoryPage({ onNavigate, selectedId }) {
  const [developers, setDevelopers] = useState(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let active = true
    api
      .listDevelopers()
      .then((res) => {
        if (active) setDevelopers(res)
      })
      .catch(() => {
        if (active) setError(true)
      })
    return () => {
      active = false
    }
  }, [])

  if (error) {
    return (
      <main className="directory-page team-page">
        <ErrorState />
      </main>
    )
  }

  if (!developers) {
    return (
      <main className="directory-page team-page">
        <Loading />
      </main>
    )
  }

  const selectedDev = selectedId ? developers.find((d) => d._id === selectedId) : null

  if (selectedId && selectedDev) {
    return (
      <main className="profile-page team-profile-page">
        <button className="back-link" onClick={() => onNavigate?.('/team')}>
          ← All developers
        </button>
        <div className="profile-header">
          <Avatar name={selectedDev.name} />
          <div>
            <p className="eyebrow">DEVELOPER TEAM PROFILE</p>
            <h1>{selectedDev.name}</h1>
            <p>{selectedDev.role}</p>
          </div>
        </div>
        <div className="detail-description">
          <p>{selectedDev.description}</p>
        </div>
        <div className="skill-list">
          {selectedDev.skills.map((skill) => (
            <span key={skill}>{skill}</span>
          ))}
        </div>
        <div className="developer-links">
          {selectedDev.websiteUrl && (
            <a
              className="primary-link"
              href={selectedDev.websiteUrl}
              target="_blank"
              rel="noreferrer"
            >
              Visit website ↗
            </a>
          )}
          {selectedDev.githubUrl && (
            <a href={selectedDev.githubUrl} target="_blank" rel="noreferrer">
              GitHub
            </a>
          )}
          {selectedDev.linkedinUrl && (
            <a href={selectedDev.linkedinUrl} target="_blank" rel="noreferrer">
              LinkedIn
            </a>
          )}
        </div>
      </main>
    )
  }

  return (
    <main className="directory-page team-page">
      <div className="directory-hero">
        <p className="eyebrow">THE PEOPLE BEHIND THE PLATFORM</p>
        <h1>
          Made with care,<br />
          <em>for campus life.</em>
        </h1>
        <p>
          Developer profiles are managed from the platform and remain separate from student
          contributor profiles.
        </p>
      </div>
      <div className="developer-grid">
        {developers.map((developer) => (
          <article className="developer-card" key={developer._id}>
            <div className="developer-banner banner-blue">
              <span className="banner-label">DEVELOPED BY</span>
              <span className="banner-shape">✦</span>
            </div>
            <div className="developer-body">
              <Avatar name={developer.name} />
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
                {developer.websiteUrl && (
                  <a
                    className="primary-link"
                    href={developer.websiteUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Visit website ↗
                  </a>
                )}
                {developer.githubUrl && (
                  <a href={developer.githubUrl} target="_blank" rel="noreferrer">
                    GitHub
                  </a>
                )}
                {developer.linkedinUrl && (
                  <a href={developer.linkedinUrl} target="_blank" rel="noreferrer">
                    LinkedIn
                  </a>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </main>
  )
}
