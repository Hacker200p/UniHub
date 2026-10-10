import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../context/useAuth.js'
import { api } from '../services/api.js'

export default function UploadPage({ onNavigate }) {
  const { isAuthenticated, accessToken } = useAuth()
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Academic Dropdown Data
  const [programs, setPrograms] = useState([])
  const [branches, setBranches] = useState([])
  const [academicYears, setAcademicYears] = useState([])
  const [semesters, setSemesters] = useState([])
  const [subjects, setSubjects] = useState([])

  // Selected Academic IDs
  const [selectedProgramId, setSelectedProgramId] = useState('')
  const [selectedBranchId, setSelectedBranchId] = useState('')
  const [selectedAcademicYear, setSelectedAcademicYear] = useState('')
  const [selectedSemesterId, setSelectedSemesterId] = useState('')
  const [selectedSubjectId, setSelectedSubjectId] = useState('')

  // Subject filtering within selected semester
  const [subjectSearch, setSubjectSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('ALL') // ALL | Theory | Practical
  const [electiveFilter, setElectiveFilter] = useState('ALL')

  // Loading States
  const [loadingPrograms, setLoadingPrograms] = useState(false)
  const [loadingBranches, setLoadingBranches] = useState(false)
  const [loadingYears, setLoadingYears] = useState(false)
  const [loadingSemesters, setLoadingSemesters] = useState(false)
  const [loadingSubjects, setLoadingSubjects] = useState(false)

  // Resource Meta
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [resourceType, setResourceType] = useState('NOTES')
  const [examType, setExamType] = useState('NONE')
  const [examYear, setExamYear] = useState('')
  const [pdfFile, setPdfFile] = useState(null)
  const [dragActive, setDragActive] = useState(false)

  // 1. Initial Load: Programs
  useEffect(() => {
    let isMounted = true
    setLoadingPrograms(true)
    api
      .listPrograms()
      .then((data) => {
        if (isMounted) setPrograms(data || [])
      })
      .catch((err) => {
        if (isMounted) setError(err.message || 'Unable to load programs.')
      })
      .finally(() => {
        if (isMounted) setLoadingPrograms(false)
      })
    return () => {
      isMounted = false
    }
  }, [])

  // 2. Cascade: When Program Changes
  const handleProgramChange = (programId) => {
    setSelectedProgramId(programId)
    setSelectedBranchId('')
    setSelectedAcademicYear('')
    setSelectedSemesterId('')
    setSelectedSubjectId('')
    setBranches([])
    setAcademicYears([])
    setSemesters([])
    setSubjects([])
    setSubjectSearch('')
    setTypeFilter('ALL')
    setElectiveFilter('ALL')

    if (!programId) return

    setLoadingBranches(true)
    api
      .listBranches(programId)
      .then((data) => setBranches(data || []))
      .catch((err) => setError(err.message || 'Failed to load branches.'))
      .finally(() => setLoadingBranches(false))
  }

  // 3. Cascade: When Branch Changes
  const handleBranchChange = (branchId) => {
    setSelectedBranchId(branchId)
    setSelectedAcademicYear('')
    setSelectedSemesterId('')
    setSelectedSubjectId('')
    setAcademicYears([])
    setSemesters([])
    setSubjects([])
    setSubjectSearch('')
    setTypeFilter('ALL')
    setElectiveFilter('ALL')

    if (!branchId) return

    setLoadingYears(true)
    api
      .listAcademicYears(selectedProgramId, branchId)
      .then((years) => {
        setAcademicYears(years || [])
      })
      .catch((err) => setError(err.message || 'Failed to load academic years.'))
      .finally(() => setLoadingYears(false))
  }

  // 4. Cascade: When Academic Year Changes
  const handleAcademicYearChange = (year) => {
    setSelectedAcademicYear(year)
    setSelectedSemesterId('')
    setSelectedSubjectId('')
    setSemesters([])
    setSubjects([])
    setSubjectSearch('')
    setTypeFilter('ALL')
    setElectiveFilter('ALL')

    if (!year) return

    setLoadingSemesters(true)
    api
      .listSemesters(selectedProgramId, selectedBranchId, year)
      .then((data) => setSemesters(data || []))
      .catch((err) => setError(err.message || 'Failed to load semesters.'))
      .finally(() => setLoadingSemesters(false))
  }

  // 5. Cascade: When Semester Changes
  const handleSemesterChange = (semesterId) => {
    setSelectedSemesterId(semesterId)
    setSelectedSubjectId('')
    setSubjects([])
    setSubjectSearch('')
    setTypeFilter('ALL')
    setElectiveFilter('ALL')

    if (!semesterId) return

    setLoadingSubjects(true)
    api
      .listSubjects(selectedProgramId, selectedBranchId, semesterId)
      .then((data) => setSubjects(data || []))
      .catch((err) => setError(err.message || 'Failed to load subjects.'))
      .finally(() => setLoadingSubjects(false))
  }

  // Derived: Available Elective Groups for chosen semester
  const availableElectiveGroups = useMemo(() => {
    const groups = new Set()
    subjects.forEach((s) => {
      if (s.electiveGroup && s.electiveGroup !== 'Core') {
        groups.add(s.electiveGroup)
      }
    })
    return Array.from(groups).sort()
  }, [subjects])

  // Derived: Filtered subjects
  const filteredSubjects = useMemo(() => {
    return subjects.filter((s) => {
      // Type filter
      if (typeFilter !== 'ALL' && s.subjectType !== typeFilter) {
        return false
      }
      // Elective group filter
      if (electiveFilter !== 'ALL') {
        if (electiveFilter === 'Core' && s.electiveGroup !== 'Core') return false
        if (electiveFilter !== 'Core' && s.electiveGroup !== electiveFilter) return false
      }
      // Search filter
      if (subjectSearch.trim()) {
        const query = subjectSearch.toLowerCase().trim()
        const matchCode = (s.code || '').toLowerCase().includes(query)
        const matchName = (s.name || '').toLowerCase().includes(query)
        const matchGroup = (s.electiveGroup || '').toLowerCase().includes(query)
        return matchCode || matchName || matchGroup
      }
      return true
    })
  }, [subjects, typeFilter, electiveFilter, subjectSearch])

  // Selected subject object for preview
  const selectedSubject = useMemo(() => {
    return subjects.find((s) => s._id === selectedSubjectId) || null
  }, [subjects, selectedSubjectId])

  // Form submission
  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    if (!selectedProgramId) {
      setError('Please select an Academic Program.')
      return
    }
    if (!selectedBranchId && branches.length > 0) {
      setError('Please select a Branch.')
      return
    }
    if (!selectedSemesterId) {
      setError('Please select a Semester.')
      return
    }
    if (!selectedSubjectId) {
      setError('Please select a Subject.')
      return
    }
    if (!pdfFile) {
      setError('Please choose a valid PDF file.')
      return
    }

    try {
      setSubmitting(true)
      const form = new FormData()
      form.append('title', title.trim())
      form.append('description', description.trim())
      form.append('resourceType', resourceType)
      form.append('examType', examType)
      form.append('programId', selectedProgramId)
      if (selectedBranchId) form.append('branchId', selectedBranchId)
      form.append('semesterId', selectedSemesterId)
      form.append('subjectId', selectedSubjectId)

      // Distinguish Examination Year vs Study Academic Year
      if (resourceType === 'PYQ' && examYear) {
        form.append('academicYear', examYear)
      } else if (selectedAcademicYear) {
        form.append('academicYear', selectedAcademicYear)
      }

      form.append('pdf', pdfFile)

      await api.uploadResource(accessToken, form)
      setSubmitted(true)
    } catch (submissionError) {
      setError(submissionError.message || 'Resource submission failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // Drag and drop handlers
  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0]
      if (file.type === 'application/pdf') {
        setPdfFile(file)
      } else {
        setError('Only PDF documents are supported.')
      }
    }
  }

  if (!isAuthenticated) {
    return (
      <main className="directory-page">
        <div className="directory-hero">
          <p className="eyebrow">CONTRIBUTE TO THE LIBRARY</p>
          <h1>
            Share what
            <br />
            <em>helped you.</em>
          </h1>
          <p>Sign in to submit verified notes or question papers for moderator review.</p>
          <button className="primary-button" onClick={() => onNavigate('/login')}>
            Sign in to upload ↗
          </button>
        </div>
      </main>
    )
  }

  if (submitted) {
    return (
      <main className="directory-page">
        <div className="directory-hero">
          <p className="eyebrow">SUBMISSION RECEIVED</p>
          <h1>
            Thank you for
            <br />
            <em>sharing.</em>
          </h1>
          <p>
            Your resource has been submitted with verified academic metadata and is waiting for moderator review.
          </p>
          <div className="hero-actions">
            <button
              className="primary-button"
              onClick={() => {
                setSubmitted(false)
                setTitle('')
                setDescription('')
                setPdfFile(null)
                setSelectedSubjectId('')
              }}
            >
              Upload another resource ↗
            </button>
            <button className="secondary-button" onClick={() => onNavigate('/dashboard')}>
              Back to dashboard →
            </button>
          </div>
        </div>
      </main>
    )
  }

  const isAcademicReady = selectedProgramId && selectedSemesterId && selectedSubjectId

  return (
    <main className="upload-page">
      <div className="directory-hero">
        <p className="eyebrow">CONTRIBUTE TO THE LIBRARY</p>
        <h1>
          Share what
          <br />
          <em>helped you.</em>
        </h1>
        <p>
          Every upload is reviewed before it appears publicly. Choose the exact curriculum placement from the official university catalog.
        </p>
      </div>

      <form className="upload-form enhanced-upload-form" onSubmit={handleSubmit}>
        {/* SECTION 1: Resource Metadata */}
        <div className="form-section">
          <h2 className="section-title">1. Resource Information</h2>

          <label>
            Resource title <span className="required-star">*</span>
            <input
              required
              name="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Complete Unit 1-4 Notes with Solved Derivations"
            />
          </label>

          <div className="form-row-2">
            <label>
              Resource type <span className="required-star">*</span>
              <select
                name="resourceType"
                value={resourceType}
                onChange={(e) => {
                  setResourceType(e.target.value)
                  if (e.target.value === 'PYQ' && examType === 'NONE') {
                    setExamType('END_TERM')
                  }
                }}
              >
                <option value="NOTES">Notes / Lecture Materials</option>
                <option value="PYQ">Previous Year Question Paper (PYQ)</option>
                <option value="ASSIGNMENT">Assignment / Problem Set</option>
                <option value="LAB_MATERIAL">Lab Manual / Practical Code</option>
                <option value="REFERENCE">Reference Sheet / Formula Book</option>
                <option value="SYLLABUS">Official Syllabus</option>
                <option value="OTHER">Other Academic Resource</option>
              </select>
            </label>

            <label>
              Exam type
              <select
                name="examType"
                value={examType}
                onChange={(e) => setExamType(e.target.value)}
              >
                <option value="NONE">None / General</option>
                <option value="MID_TERM">Mid Term Exam</option>
                <option value="END_TERM">End Term Exam</option>
              </select>
            </label>
          </div>

          {resourceType === 'PYQ' && (
            <div className="pyq-banner">
              <label>
                Examination Year (Optional)
                <input
                  type="number"
                  min="2000"
                  max="2099"
                  value={examYear}
                  onChange={(e) => setExamYear(e.target.value)}
                  placeholder="e.g. 2024 (Year exam was held)"
                />
              </label>
              <p className="field-hint">
                Note: Examination year refers to the calendar year when this question paper was administered (e.g. 2024), separate from the curriculum study year below.
              </p>
            </div>
          )}
        </div>

        {/* SECTION 2: Cascading Curriculum Selection */}
        <div className="form-section">
          <h2 className="section-title">2. Curriculum Placement</h2>
          <p className="section-hint">
            Selections cascade downward based on the official university subject catalog. Select parent options to unlock prerequisites.
          </p>

          <div className="form-row-2">
            {/* 1. Program Dropdown */}
            <label className="dropdown-label">
              Program <span className="required-star">*</span>
              {loadingPrograms && <span className="loading-badge">Loading...</span>}
              <select
                value={selectedProgramId}
                onChange={(e) => handleProgramChange(e.target.value)}
                disabled={loadingPrograms || programs.length === 0}
              >
                <option value="">Choose program</option>
                {programs.map((prog) => (
                  <option key={prog._id} value={prog._id}>
                    {prog.name} ({prog.code})
                  </option>
                ))}
              </select>
            </label>

            {/* 2. Branch Dropdown */}
            <label className="dropdown-label">
              Branch <span className="required-star">*</span>
              {loadingBranches && <span className="loading-badge">Loading...</span>}
              <select
                value={selectedBranchId}
                onChange={(e) => handleBranchChange(e.target.value)}
                disabled={!selectedProgramId || loadingBranches || branches.length === 0}
              >
                <option value="">
                  {!selectedProgramId ? 'Select program first' : 'Choose branch'}
                </option>
                {branches.map((b) => (
                  <option key={b._id} value={b._id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="form-row-2">
            {/* 3. Academic Year Dropdown */}
            <label className="dropdown-label">
              Academic Year <span className="required-star">*</span>
              {loadingYears && <span className="loading-badge">Loading...</span>}
              <select
                value={selectedAcademicYear}
                onChange={(e) => handleAcademicYearChange(e.target.value)}
                disabled={!selectedBranchId || loadingYears || academicYears.length === 0}
              >
                <option value="">
                  {!selectedBranchId ? 'Select branch first' : 'Choose academic year'}
                </option>
                {academicYears.map((yr) => (
                  <option key={yr} value={yr}>
                    Year {yr} ({yr === 1 ? '1st' : yr === 2 ? '2nd' : yr === 3 ? '3rd' : yr === 4 ? '4th' : `${yr}th`} Year)
                  </option>
                ))}
              </select>
            </label>

            {/* 4. Semester Dropdown */}
            <label className="dropdown-label">
              Semester <span className="required-star">*</span>
              {loadingSemesters && <span className="loading-badge">Loading...</span>}
              <select
                value={selectedSemesterId}
                onChange={(e) => handleSemesterChange(e.target.value)}
                disabled={!selectedAcademicYear || loadingSemesters || semesters.length === 0}
              >
                <option value="">
                  {!selectedAcademicYear ? 'Select academic year first' : 'Choose semester'}
                </option>
                {semesters.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name} {s.roman ? `(Semester ${s.roman})` : ''}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* 5. Subject Dropdown with Search & Filters */}
          <div className="subject-selection-container">
            <div className="subject-header">
              <label className="dropdown-label">
                Subject <span className="required-star">*</span>
                {loadingSubjects && <span className="loading-badge">Loading subjects...</span>}
              </label>

              {/* Sub-filters when semester is selected */}
              {selectedSemesterId && subjects.length > 0 && (
                <div className="subject-subfilters">
                  <div className="pill-group">
                    <button
                      type="button"
                      className={`filter-pill ${typeFilter === 'ALL' ? 'active' : ''}`}
                      onClick={() => setTypeFilter('ALL')}
                    >
                      All Types
                    </button>
                    <button
                      type="button"
                      className={`filter-pill ${typeFilter === 'Theory' ? 'active' : ''}`}
                      onClick={() => setTypeFilter('Theory')}
                    >
                      Theory
                    </button>
                    <button
                      type="button"
                      className={`filter-pill ${typeFilter === 'Practical' ? 'active' : ''}`}
                      onClick={() => setTypeFilter('Practical')}
                    >
                      Practical
                    </button>
                  </div>

                  {availableElectiveGroups.length > 0 && (
                    <select
                      className="elective-filter-select"
                      value={electiveFilter}
                      onChange={(e) => setElectiveFilter(e.target.value)}
                    >
                      <option value="ALL">All Groups</option>
                      <option value="Core">Core Only</option>
                      {availableElectiveGroups.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
            </div>

            {/* Subject Search Bar */}
            {selectedSemesterId && subjects.length > 0 && (
              <input
                type="text"
                className="subject-search-bar"
                placeholder="Search subject by code or title (e.g. CS1003, Algorithms)..."
                value={subjectSearch}
                onChange={(e) => setSubjectSearch(e.target.value)}
              />
            )}

            {/* Subject Select */}
            <select
              className="subject-dropdown-select"
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              disabled={!selectedSemesterId || loadingSubjects || subjects.length === 0}
            >
              <option value="">
                {!selectedSemesterId
                  ? 'Select semester first'
                  : loadingSubjects
                  ? 'Loading subjects...'
                  : filteredSubjects.length === 0
                  ? 'No matching subjects found'
                  : 'Choose subject'}
              </option>
              {filteredSubjects.map((sub) => (
                <option key={sub._id} value={sub._id}>
                  {sub.code ? `${sub.code} — ` : ''}{sub.name} [{sub.subjectType || 'Theory'}{sub.electiveGroup && sub.electiveGroup !== 'Core' ? ` · ${sub.electiveGroup}` : ''}]
                </option>
              ))}
            </select>

            {/* Selected Subject Preview Card */}
            {selectedSubject && (
              <div className="selected-subject-card">
                <div className="card-badge-row">
                  <span className="subject-code-badge">{selectedSubject.code}</span>
                  <span className={`subject-type-badge ${selectedSubject.subjectType?.toLowerCase()}`}>
                    {selectedSubject.subjectType}
                  </span>
                  {selectedSubject.electiveGroup && (
                    <span className="elective-group-badge">{selectedSubject.electiveGroup}</span>
                  )}
                </div>
                <h3 className="subject-name">{selectedSubject.name}</h3>
                {selectedSubject.sourcePdf && (
                  <p className="provenance-info">
                    Source: {selectedSubject.sourcePdf} {selectedSubject.sourcePage ? `(${selectedSubject.sourcePage})` : ''}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* SECTION 3: Content and PDF Upload */}
        <div className="form-section">
          <h2 className="section-title">3. Document Upload</h2>

          <label>
            Description (Optional)
            <textarea
              name="description"
              rows="3"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide context on what this document contains (e.g. handwritten derivations, mid-term 2024 solutions)..."
            />
          </label>

          <label>
            PDF file <span className="required-star">*</span>
            <div
              className={`pdf-dropzone ${dragActive ? 'drag-active' : ''} ${pdfFile ? 'has-file' : ''}`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <input
                required={!pdfFile}
                name="pdf"
                type="file"
                accept="application/pdf"
                className="dropzone-file-input"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setPdfFile(e.target.files[0])
                  }
                }}
              />
              <div className="dropzone-content">
                {pdfFile ? (
                  <>
                    <p className="dropzone-filename">📄 {pdfFile.name}</p>
                    <p className="dropzone-filesize">
                      {(pdfFile.size / 1024 / 1024).toFixed(2)} MB · Click or drag to replace
                    </p>
                  </>
                ) : (
                  <>
                    <p className="dropzone-prompt">Choose a PDF file or drag it here</p>
                    <p className="dropzone-hint">PDF documents only, up to 25 MB</p>
                  </>
                )}
              </div>
            </div>
          </label>
        </div>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <button
          className="primary-button submit-btn"
          disabled={!isAcademicReady || !title.trim() || !pdfFile || submitting}
        >
          {submitting ? 'Submitting for review...' : 'Submit for review'} <span>↗</span>
        </button>
      </form>
    </main>
  )
}
