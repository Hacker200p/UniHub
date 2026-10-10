import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../services/api.js'

export function ResourceCard({ resource, onNavigate }) {
  const examLabel =
    resource.examType && resource.examType !== 'NONE'
      ? resource.examType.replace('_', ' ')
      : null

  const typeClass = resource.resourceType?.toLowerCase() || 'notes'
  const contributorName = resource.contributor || 'Community Contributor'
  const contributorInitials =
    contributorName
      .split(' ')
      .map((w) => w[0])
      .filter(Boolean)
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'CC'

  return (
    <article
      className="resource-card"
      onClick={() => onNavigate(`/resources/${resource._id}`)}
      tabIndex={0}
      role="button"
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onNavigate(`/resources/${resource._id}`)
        }
      }}
      aria-label={`View details for ${resource.title}`}
    >
      <div className="resource-card-header">
        <div className="resource-badges">
          <span className={`type-badge badge-${typeClass}`}>
            {resource.resourceType || 'NOTES'}
          </span>
          {examLabel && <span className="exam-badge">{examLabel}</span>}
          {resource.academicYear && (
            <span className="year-badge">Year {resource.academicYear}</span>
          )}
        </div>
        <div className="file-type-pill" title="Verified PDF Document" aria-label="PDF file">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <span>PDF</span>
        </div>
      </div>

      <div className="resource-card-body">
        <h3 className="resource-title" title={resource.title}>
          {resource.title}
        </h3>

        {/* Academic Hierarchy */}
        {(resource.subjectId || resource.subject) && (
          <div className="resource-academic-tags">
            {resource.subjectId?.code && (
              <span className="subject-code-tag">{resource.subjectId.code}</span>
            )}
            <span className="subject-name-tag">
              {resource.subjectId?.name || resource.subject}
            </span>
          </div>
        )}

        {(resource.programId || resource.branchId || resource.semesterId || resource.branch) && (
          <p className="resource-hierarchy-meta">
            {resource.programId?.code || resource.programId?.name || ''}
            {resource.programId && (resource.branchId || resource.branch) ? ' · ' : ''}
            {resource.branchId?.code || resource.branch || ''}
            {resource.semesterId?.number
              ? ` · Sem ${resource.semesterId.number}`
              : resource.semester
              ? ` · ${resource.semester}`
              : ''}
          </p>
        )}
      </div>

      <div className="resource-card-footer">
        <div className="contributor-info">
          <div className="contributor-avatar-mini" aria-hidden="true">
            {contributorInitials}
          </div>
          <span className="contributor-name" title={contributorName}>
            {contributorName}
          </span>
        </div>

        <div className="resource-stats-action">
          <span className="download-counter" title={`${resource.downloadCount || 0} downloads`}>
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {resource.downloadCount || 0}
          </span>
          <button
            type="button"
            className="card-action-btn"
            onClick={(e) => {
              e.stopPropagation()
              onNavigate(`/resources/${resource._id}`)
            }}
            aria-label={`View ${resource.title}`}
          >
            View <span>↗</span>
          </button>
        </div>
      </div>
    </article>
  )
}

const CATEGORY_TABS = [
  { id: 'all', label: 'All Resources' },
  { id: 'NOTES', label: 'Lecture Notes' },
  { id: 'PYQ', label: 'Previous Year Papers (PYQ)' },
  { id: 'ASSIGNMENT', label: 'Assignments' },
  { id: 'LAB_MATERIAL', label: 'Lab Manuals' },
  { id: 'REFERENCE', label: 'References' },
]

export default function ResourcesPage({ onNavigate }) {
  const [resources, setResources] = useState([])
  const params = new URLSearchParams(window.location.search)

  // Search & Type states
  const [query, setQuery] = useState(params.get('q') || '')
  const [debouncedQuery, setDebouncedQuery] = useState(params.get('q') || '')
  const [resourceType, setResourceType] = useState(params.get('resourceType') || 'all')
  const [sortBy, setSortBy] = useState('recent') // 'recent' | 'downloads'

  // Cascading Academic States
  const [programs, setPrograms] = useState([])
  const [programId, setProgramId] = useState(params.get('programId') || '')
  const [branches, setBranches] = useState([])
  const [branchId, setBranchId] = useState(params.get('branchId') || '')
  const [academicYears, setAcademicYears] = useState([])
  const [academicYear, setAcademicYear] = useState(params.get('academicYear') || '')
  const [semesters, setSemesters] = useState([])
  const [semesterId, setSemesterId] = useState(params.get('semesterId') || '')
  const [subjects, setSubjects] = useState([])
  const [subjectId, setSubjectId] = useState(params.get('subjectId') || '')
  const [examType, setExamType] = useState(params.get('examType') || '')

  const [status, setStatus] = useState('loading')
  const [isSearching, setIsSearching] = useState(false)
  const isInitialLoad = useRef(true)
  const debounceTimerRef = useRef(null)

  // 1. Debounce text search
  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedQuery(query.trim())
    }, 280)
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    }
  }, [query])

  // 2. Fetch Initial Programs
  useEffect(() => {
    let active = true
    api
      .listPrograms()
      .then((data) => {
        if (active) setPrograms(data || [])
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  // 3. Handle Cascading program selection
  const handleProgramChange = (e) => {
    const selected = e.target.value
    setProgramId(selected)
    setBranchId('')
    setBranches([])
    setAcademicYear('')
    setAcademicYears([])
    setSemesterId('')
    setSemesters([])
    setSubjectId('')
    setSubjects([])

    if (selected) {
      api.listBranches(selected).then(setBranches).catch(() => {})
      api.listAcademicYears(selected).then(setAcademicYears).catch(() => {})
      api.listSemesters(selected).then(setSemesters).catch(() => {})
    }
  }

  // 4. Handle Branch selection
  const handleBranchChange = (e) => {
    const selected = e.target.value
    setBranchId(selected)
    setAcademicYear('')
    setSemesterId('')
    setSemesters([])
    setSubjectId('')
    setSubjects([])

    if (programId && selected) {
      api.listAcademicYears(programId, selected).then(setAcademicYears).catch(() => {})
      api.listSemesters(programId, selected).then(setSemesters).catch(() => {})
    }
  }

  // 5. Handle Academic Year selection
  const handleYearChange = (e) => {
    const selected = e.target.value
    setAcademicYear(selected)
    setSemesterId('')
    setSemesters([])
    setSubjectId('')
    setSubjects([])

    if (programId) {
      api.listSemesters(programId, branchId, selected).then(setSemesters).catch(() => {})
    }
  }

  // 6. Handle Semester selection
  const handleSemesterChange = (e) => {
    const selected = e.target.value
    setSemesterId(selected)
    setSubjectId('')
    setSubjects([])

    if (programId && selected) {
      api.listSubjects(programId, branchId, selected).then(setSubjects).catch(() => {})
    }
  }

  // 7. Reset all filters
  const resetFilters = useCallback(() => {
    setQuery('')
    setDebouncedQuery('')
    setResourceType('all')
    setProgramId('')
    setBranchId('')
    setAcademicYear('')
    setSemesterId('')
    setSubjectId('')
    setExamType('')
    setSortBy('recent')
    setBranches([])
    setAcademicYears([])
    setSemesters([])
    setSubjects([])
  }, [])

  const hasActiveFilters = Boolean(
    query ||
      (resourceType && resourceType !== 'all') ||
      programId ||
      branchId ||
      academicYear ||
      semesterId ||
      subjectId ||
      examType
  )

  // 8. Fetch filtered resources
  useEffect(() => {
    let active = true
    if (isInitialLoad.current) {
      setStatus('loading')
    } else {
      setIsSearching(true)
    }

    const search = new URLSearchParams()
    if (debouncedQuery) search.set('q', debouncedQuery)
    if (resourceType && resourceType !== 'all') search.set('resourceType', resourceType)
    if (programId) search.set('programId', programId)
    if (branchId) search.set('branchId', branchId)
    if (academicYear) search.set('academicYear', academicYear)
    if (semesterId) search.set('semesterId', semesterId)
    if (subjectId) search.set('subjectId', subjectId)
    if (examType && resourceType === 'PYQ') search.set('examType', examType)

    api
      .listResources(search.toString() ? `?${search.toString()}` : '')
      .then((data) => {
        if (active) {
          setResources(data || [])
          setStatus('ready')
          setIsSearching(false)
          isInitialLoad.current = false
        }
      })
      .catch(() => {
        if (active) {
          setStatus('error')
          setIsSearching(false)
          isInitialLoad.current = false
        }
      })

    return () => {
      active = false
    }
  }, [
    debouncedQuery,
    resourceType,
    programId,
    branchId,
    academicYear,
    semesterId,
    subjectId,
    examType,
  ])

  // Client-side sorting for download counts or recent
  const displayedResources = useMemo(() => {
    if (!resources) return []
    const copy = [...resources]
    if (sortBy === 'downloads') {
      copy.sort((a, b) => (b.downloadCount || 0) - (a.downloadCount || 0))
    } else if (sortBy === 'recent') {
      copy.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    }
    return copy
  }, [resources, sortBy])

  return (
    <main className="directory-page resources-page">
      <div className="directory-hero">
        <p className="eyebrow">THE ACADEMIC ARCHIVE</p>
        <h1>
          Find your next<br />
          <em>starting point.</em>
        </h1>
        <p>
          Browse community-verified notes, question papers, and course guides shared by students and
          academics across the university.
        </p>
      </div>

      {/* Primary Search Bar */}
      <section className="resource-discovery-hero">
        <div className="search-bar-composite">
          <div className="search-input-field">
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
              aria-label="Search resources by title, subject or code"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
                  setDebouncedQuery(query.trim())
                }
              }}
              placeholder="Search notes, PYQs, subject codes (e.g. CS-301) or topics..."
            />
            {query && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => {
                  setQuery('')
                  setDebouncedQuery('')
                  if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
                }}
                aria-label="Clear search input"
              >
                ✕
              </button>
            )}
          </div>

          {/* Category Tabs */}
          <div className="category-pill-row" role="tablist" aria-label="Resource categories">
            {CATEGORY_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={resourceType === tab.id}
                className={`category-pill ${resourceType === tab.id ? 'active' : ''}`}
                onClick={() => setResourceType(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Cascading Curriculum Filters */}
        <div className="cascading-filter-panel" aria-label="Curriculum filters">
          <div className="filter-select-group">
            <label className="filter-field">
              <span className="filter-label">Program</span>
              <select
                value={programId}
                onChange={handleProgramChange}
                aria-label="Filter by program"
              >
                <option value="">All Programs</option>
                {programs.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name} ({p.code})
                  </option>
                ))}
              </select>
            </label>

            <label className="filter-field">
              <span className="filter-label">Branch</span>
              <select
                value={branchId}
                onChange={handleBranchChange}
                disabled={!programId}
                aria-label="Filter by branch"
              >
                <option value="">All Branches</option>
                {branches.map((b) => (
                  <option key={b._id} value={b._id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            </label>

            <label className="filter-field">
              <span className="filter-label">Academic Year</span>
              <select
                value={academicYear}
                onChange={handleYearChange}
                disabled={!programId}
                aria-label="Filter by academic year"
              >
                <option value="">All Years</option>
                {academicYears.length ? (
                  academicYears.map((yr) => (
                    <option key={yr.year || yr} value={yr.year || yr}>
                      Year {yr.year || yr}
                    </option>
                  ))
                ) : (
                  <>
                    <option value="1">Year 1</option>
                    <option value="2">Year 2</option>
                    <option value="3">Year 3</option>
                    <option value="4">Year 4</option>
                  </>
                )}
              </select>
            </label>

            <label className="filter-field">
              <span className="filter-label">Semester</span>
              <select
                value={semesterId}
                onChange={handleSemesterChange}
                disabled={!programId}
                aria-label="Filter by semester"
              >
                <option value="">All Semesters</option>
                {semesters.map((s) => (
                  <option key={s._id} value={s._id}>
                    Semester {s.number}
                  </option>
                ))}
              </select>
            </label>

            <label className="filter-field">
              <span className="filter-label">Subject</span>
              <select
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                disabled={!semesterId}
                aria-label="Filter by subject"
              >
                <option value="">All Subjects</option>
                {subjects.map((sub) => (
                  <option key={sub._id} value={sub._id}>
                    {sub.code} — {sub.name}
                  </option>
                ))}
              </select>
            </label>

            {resourceType === 'PYQ' && (
              <label className="filter-field">
                <span className="filter-label">Exam Type</span>
                <select
                  value={examType}
                  onChange={(e) => setExamType(e.target.value)}
                  aria-label="Filter by examination type"
                >
                  <option value="">All Exams</option>
                  <option value="MID_TERM">Mid Term Exam</option>
                  <option value="END_TERM">End Term Exam</option>
                </select>
              </label>
            )}
          </div>

          {hasActiveFilters && (
            <div className="filter-actions-row">
              <button
                type="button"
                className="clear-all-filters-btn"
                onClick={resetFilters}
                aria-label="Clear all applied filters"
              >
                Reset All Filters ✕
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Results Header Toolbar */}
      <div className="discovery-results-toolbar">
        <div className="results-count">
          {status === 'ready' && (
            <span>
              Showing <strong>{displayedResources.length}</strong>{' '}
              {displayedResources.length === 1 ? 'academic resource' : 'academic resources'}
              {isSearching && <span className="searching-indicator-badge">Searching...</span>}
            </span>
          )}
        </div>

        <div className="sort-control-tabs" role="tablist" aria-label="Sort options">
          <span className="sort-label">Sort:</span>
          <button
            type="button"
            role="tab"
            aria-selected={sortBy === 'recent'}
            className={`sort-tab ${sortBy === 'recent' ? 'active' : ''}`}
            onClick={() => setSortBy('recent')}
          >
            Recently Shared
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={sortBy === 'downloads'}
            className={`sort-tab ${sortBy === 'downloads' ? 'active' : ''}`}
            onClick={() => setSortBy('downloads')}
          >
            Most Downloaded
          </button>
        </div>
      </div>

      {/* Content States */}
      {status === 'loading' && (
        <div className="loading-state-card">
          <div className="spinner-indicator" aria-hidden="true" />
          <p>Fetching academic materials from UniHub archive...</p>
        </div>
      )}

      {status === 'error' && (
        <div className="empty-state error-state">
          <p>Resources are temporarily unavailable. Please try again shortly.</p>
          <button
            type="button"
            className="secondary-button"
            style={{ marginTop: 14 }}
            onClick={() => setDebouncedQuery(query)}
          >
            Retry Search
          </button>
        </div>
      )}

      {status === 'ready' && (
        <>
          {displayedResources.length > 0 ? (
            <div className={`resource-grid ${isSearching ? 'is-searching' : ''}`}>
              {displayedResources.map((resource) => (
                <ResourceCard key={resource._id} resource={resource} onNavigate={onNavigate} />
              ))}
            </div>
          ) : (
            <div className="empty-state no-results-state">
              <p>No study materials match your active search or filters.</p>
              {hasActiveFilters && (
                <button
                  type="button"
                  className="secondary-button"
                  style={{ marginTop: 14 }}
                  onClick={resetFilters}
                >
                  Clear Filters & Show All
                </button>
              )}
            </div>
          )}
        </>
      )}
    </main>
  )
}
