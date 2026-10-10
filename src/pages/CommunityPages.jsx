import { useEffect, useState } from 'react'
import { api } from '../services/api.js'
import { ResourceCard } from './ResourcesPage.jsx'

function initials(name = '') {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function Avatar({ name, src = '' }) {
  const [error, setError] = useState(false)
  if (src && !error) {
    return (
      <div className="avatar avatar-blue">
        <img
          src={src}
          alt={name || 'Avatar'}
          className="avatar-img"
          onError={() => setError(true)}
        />
        <span className="avatar-text">{initials(name)}</span>
      </div>
    )
  }
  return (
    <div className="avatar avatar-blue">
      <span className="avatar-text">{initials(name)}</span>
    </div>
  )
}

function Loading() {
  return (
    <div className="loading-state-card">
      <div className="spinner-indicator" aria-hidden="true" />
      <p>Loading verified contributor profiles...</p>
    </div>
  )
}

function ErrorState() {
  return <p className="empty-state">Community profiles are temporarily unavailable.</p>
}

export function ContributorCard({ contributor, onNavigate }) {
  const contributorInitials = initials(contributor.name)
  const programBranch = [
    contributor.programId?.code || contributor.programId?.name || contributor.program,
    contributor.branchId?.code || contributor.branch,
  ]
    .filter(Boolean)
    .join(' · ') || 'University student'

  const semesterText = contributor.semesterId?.number
    ? `Semester ${contributor.semesterId.number}`
    : contributor.semester || ''

  const count = contributor.approvedContributions ?? contributor.count ?? 0
  const downloads = contributor.totalDownloads ?? contributor.downloads ?? 0

  return (
    <article
      className="contributor-card"
      tabIndex={0}
      role="button"
      onClick={() => onNavigate(`/contributors/${contributor._id || contributor.id}`)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onNavigate(`/contributors/${contributor._id || contributor.id}`)
        }
      }}
      aria-label={`View contributions by ${contributor.name}`}
    >
      <div className="contributor-card-main">
        <div className="contributor-top">
          <div className="contributor-avatar-wrapper" aria-hidden="true">
            <Avatar name={contributor.name} src={contributor.avatarUrl} />
          </div>
          <span className="verified-badge">
            {contributor.role === 'MODERATOR' || contributor.role === 'ADMIN'
              ? '✓ Community Staff'
              : '✓ Contributor'}
          </span>
        </div>

        <h3 className="contributor-name-heading">{contributor.name}</h3>
        <div className="contributor-meta-row">
          <span className="contributor-branch-tag">{programBranch}</span>
          {semesterText && <span className="contributor-sem-tag">{semesterText}</span>}
        </div>

        {contributor.bio ? (
          <p className="contributor-bio">{contributor.bio}</p>
        ) : (
          <p className="contributor-bio contributor-bio-empty">
            Active academic contributor sharing course materials with the UniHub community.
          </p>
        )}
      </div>

      <div className="contributor-card-bottom">
        <div className="contribution-count">
          <strong>{count}</strong>
          <span>
            {count === 1 ? 'approved resource' : 'approved resources'}
            {downloads > 0 ? ` · ${downloads} downloads` : ''}
          </span>
        </div>
        <button
          type="button"
          className="card-action-btn"
          onClick={(e) => {
            e.stopPropagation()
            onNavigate(`/contributors/${contributor._id || contributor.id}`)
          }}
          aria-label={`Explore resources shared by ${contributor.name}`}
        >
          View contributions <span>→</span>
        </button>
      </div>
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
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedBranch, setSelectedBranch] = useState('all')

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
          <Avatar name={contributor.name} src={contributor.avatarUrl} />
          <div>
            <p className="eyebrow">PUBLIC CONTRIBUTOR PROFILE</p>
            <h1>{contributor.name}'s contributions</h1>
            <p>
              {contributor.programId?.name || contributor.program || 'University student'}{' '}
              <span>•</span> {contributor.branchId?.code || contributor.branch || 'Branch not listed'}
            </p>
            {contributor.bio && <p className="profile-bio-text">{contributor.bio}</p>}
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
        </div>
        <div className="resource-grid">
          {data.resources && data.resources.length ? (
            data.resources.map((resource) => (
              <ResourceCard
                key={resource._id}
                resource={{
                  ...resource,
                  contributor: contributor.name,
                }}
                onNavigate={onNavigate}
              />
            ))
          ) : (
            <p className="empty-state">No published resources found for this contributor.</p>
          )}
        </div>
      </main>
    )
  }

  const list = Array.isArray(data) ? data : []

  // Extract distinct branch codes/names from actual community data
  const availableBranches = Array.from(
    new Set(
      list
        .map((c) => c.branchId?.code || c.branch)
        .filter(Boolean)
    )
  ).sort()

  // Filter contributors by search query and branch
  const q = searchQuery.trim().toLowerCase()
  const filteredContributors = list.filter((c) => {
    if (selectedBranch !== 'all') {
      const bCode = (c.branchId?.code || c.branch || '').toLowerCase()
      const bName = (c.branchId?.name || '').toLowerCase()
      if (bCode !== selectedBranch.toLowerCase() && bName !== selectedBranch.toLowerCase()) {
        return false
      }
    }
    if (q) {
      const name = (c.name || '').toLowerCase()
      const bio = (c.bio || '').toLowerCase()
      const program = (c.programId?.name || c.programId?.code || c.program || '').toLowerCase()
      const branch = (c.branchId?.name || c.branchId?.code || c.branch || '').toLowerCase()
      if (!name.includes(q) && !bio.includes(q) && !program.includes(q) && !branch.includes(q)) {
        return false
      }
    }
    return true
  })

  return (
    <main className="directory-page contributors-page">
      <div className="directory-hero">
        <p className="eyebrow">THE ACADEMIC COMMUNITY</p>
        <h1>
          Meet our<br />
          <em>contributors.</em>
        </h1>
        <p>
          Students and academic peers who turn their coursework into structured, reliable starting
          points for everyone. Discover verified notes and study materials from your campus community.
        </p>
      </div>

      {/* Styled Controls Bar */}
      <section className="contributor-filter-bar" aria-label="Contributor search and branch filters">
        <div className="contributor-search-input-wrapper">
          <svg
            className="search-field-icon"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="search"
            aria-label="Search contributors by name, biography, or program"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search contributors by name, branch, or biography..."
          />
          {searchQuery && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => setSearchQuery('')}
              aria-label="Clear contributor search input"
            >
              ✕
            </button>
          )}
        </div>

        <div className="contributor-branch-select-wrapper">
          <select
            aria-label="Filter contributors by academic branch"
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
          >
            <option value="all">
              All Branches ({availableBranches.length ? `${availableBranches.length} available` : 'All'})
            </option>
            {availableBranches.map((br) => (
              <option key={br} value={br}>
                Branch: {br}
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* Results Header Toolbar */}
      <div className="contributor-results-meta">
        <span>
          Showing <strong>{filteredContributors.length}</strong>{' '}
          {filteredContributors.length === 1 ? 'academic contributor' : 'academic contributors'}
        </span>
        {(searchQuery || selectedBranch !== 'all') && (
          <button
            type="button"
            className="clear-all-filters-btn"
            onClick={() => {
              setSearchQuery('')
              setSelectedBranch('all')
            }}
          >
            Reset Filters ✕
          </button>
        )}
      </div>

      {/* Contributor Grid or Empty State */}
      {filteredContributors.length > 0 ? (
        <div className="contributor-grid contributor-grid-wide">
          {filteredContributors.map((contributor) => (
            <ContributorCard
              key={contributor._id || contributor.id}
              contributor={contributor}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      ) : (
        <div className="empty-state no-results-state">
          <p>
            {searchQuery || selectedBranch !== 'all'
              ? 'No contributors found matching your active filter criteria.'
              : 'No verified contributors are available right now.'}
          </p>
          {(searchQuery || selectedBranch !== 'all') && (
            <button
              type="button"
              className="secondary-button"
              style={{ marginTop: 14 }}
              onClick={() => {
                setSearchQuery('')
                setSelectedBranch('all')
              }}
            >
              Clear Filters & Show All
            </button>
          )}
        </div>
      )}
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
              <div className="developer-avatar-wrapper">
                <Avatar name={developer.name} src={developer.avatarUrl} />
              </div>
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
