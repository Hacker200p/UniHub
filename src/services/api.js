const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api'

async function request(path, options = {}, accessToken = '') {
  const authorization = accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
  const response = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...authorization, ...options.headers },
    ...options,
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.message || 'Request failed')
  return payload.data
}

export const api = {
  getResourceFileUrl: (url) => {
    if (!url) return ''
    if (/^https?:\/\//i.test(url)) return url
    return `${API_URL}${url.startsWith('/api') ? url.slice(4) : url}`
  },
  // Public Resource endpoints
  listResources: (query = '') => request(`/resources${query}`),
  getResource: (id) => request(`/resources/${id}`),
  downloadResource: (token, id) => request(`/resources/${id}/download`, { method: 'POST' }, token),
  reportResource: (token, id, body) =>
    request(`/resources/${id}/reports`, { method: 'POST', body: JSON.stringify(body) }, token),
  suggest: (token, body) =>
    request('/suggestions', { method: 'POST', body: JSON.stringify(body) }, token),
  listContributors: () => request('/contributors'),
  getContributor: (id) => request(`/contributors/${id}`),
  listDevelopers: () => request('/team'),

  // Social OAuth & Auth Providers
  getAuthProviders: () => request('/auth/providers'),
  forgotPassword: (email) =>
    request('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  verifyEmail: (token) =>
    request('/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }) }),
  verifyResetOtp: (email, otp) =>
    request('/auth/forgot-password/verify', { method: 'POST', body: JSON.stringify({ email, otp }) }),
  resetPassword: (grant, password) =>
    request('/auth/reset-password', { method: 'POST', body: JSON.stringify({ grant, password }) }),
  exchangeOAuthCode: (code) =>
    request('/auth/oauth/exchange', {
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({ code }),
    }),
  getOAuthUrl: (provider, intent = 'login', token = '') =>
    request(`/auth/${provider}?intent=${intent}&format=json`, {}, token),

  // Academic structure endpoints
  listPrograms: () => request('/programs'),
  listBranches: (programId) => request(`/branches?programId=${programId}`),
  listAcademicYears: (programId, branchId = '') =>
    request(`/academic-years?programId=${programId}${branchId ? `&branchId=${branchId}` : ''}`),
  listSemesters: (programId, branchId = '', academicYear = '') =>
    request(
      `/semesters?programId=${programId}${branchId ? `&branchId=${branchId}` : ''}${academicYear ? `&academicYear=${academicYear}` : ''}`,
    ),
  listSubjects: (programId, branchId = '', semesterId = '', subjectType = '', electiveGroup = '') =>
    request(
      `/subjects?programId=${programId}${branchId ? `&branchId=${branchId}` : ''}${semesterId ? `&semesterId=${semesterId}` : ''}${subjectType ? `&subjectType=${subjectType}` : ''}${electiveGroup ? `&electiveGroup=${encodeURIComponent(electiveGroup)}` : ''}`,
    ),

  // Student / User endpoints
  getDashboard: (token) => request('/user/dashboard', {}, token),
  updateProfile: (token, body) =>
    request('/user/profile', { method: 'PATCH', body: JSON.stringify(body) }, token),
  getUserSecurity: (token) => request('/user/security', {}, token),
  unlinkProvider: (token, provider) =>
    request('/user/unlink-provider', { method: 'POST', body: JSON.stringify({ provider }) }, token),
  setPassword: (token, body) =>
    request('/user/set-password', { method: 'POST', body: JSON.stringify(body) }, token),
  listUserSessions: (token) => request('/user/sessions', {}, token),
  revokeUserSession: (token, id) =>
    request(`/user/sessions/${id}`, { method: 'DELETE' }, token),
  logoutOtherSessions: (token) =>
    request('/user/sessions/logout-others', { method: 'POST' }, token),
  updatePrivacySettings: (token, body) =>
    request('/user/privacy', { method: 'PATCH', body: JSON.stringify(body) }, token),

  listBookmarks: (token) => request('/user/bookmarks', {}, token),
  addBookmark: (token, resourceId) =>
    request(`/user/bookmarks/${resourceId}`, { method: 'POST' }, token),
  removeBookmark: (token, resourceId) =>
    request(`/user/bookmarks/${resourceId}`, { method: 'DELETE' }, token),
  listRecentlyViewed: (token) => request('/user/recently-viewed', {}, token),
  addRecentlyViewed: (token, resourceId) =>
    request(`/user/recently-viewed/${resourceId}`, { method: 'POST' }, token),
  listNotifications: (token) => request('/user/notifications', {}, token),
  markNotificationsRead: (token) =>
    request('/user/notifications/read', { method: 'POST' }, token),

  // University Email OTP Verification
  getUniversityEmailStatus: (token) => request('/user/university-email/status', {}, token),
  requestUniversityEmailOtp: (token, email) =>
    request(
      '/user/university-email/request-otp',
      { method: 'POST', body: JSON.stringify({ email }) },
      token,
    ),
  verifyUniversityEmailOtp: (token, email, otp) =>
    request(
      '/user/university-email/verify-otp',
      { method: 'POST', body: JSON.stringify({ email, otp }) },
      token,
    ),

  // Upload endpoint
  uploadResource: async (token, formData) => {
    const response = await fetch(`${API_URL}/resources/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      const err = new Error(payload.message || 'Upload failed')
      err.code = payload.code
      err.requiresUniversityEmailVerification =
        payload.requiresUniversityEmailVerification ||
        payload.code === 'UNIVERSITY_EMAIL_VERIFICATION_REQUIRED'
      throw err
    }
    return payload.data
  },

  // Resource requests
  listRequests: () => request('/requests'),
  createRequest: (token, body) =>
    request('/requests', { method: 'POST', body: JSON.stringify(body) }, token),
  upvoteRequest: (token, id) =>
    request(`/requests/${id}/upvote`, { method: 'POST' }, token),
  fulfillRequest: (token, id, resourceId, reply = '') =>
    request(
      `/admin/requests/${id}/fulfill`,
      { method: 'PATCH', body: JSON.stringify({ resourceId, reply }) },
      token,
    ),
  adminReplyRequest: (token, id, status, reply = '') =>
    request(
      `/admin/requests/${id}`,
      { method: 'PATCH', body: JSON.stringify({ status, reply }) },
      token,
    ),

  // Admin & Moderator APIs
  getAdminOverview: (token) => request('/admin/overview', {}, token),
  getAdminQueue: (token) => request('/admin/queue', {}, token),
  getAdminAnalytics: (token) => request('/admin/analytics', {}, token),
  listAdminAuditLogs: (token) => request('/admin/audit', {}, token),
  listAdminContributors: (token) => request('/admin/contributors', {}, token),

  // Admin Resource Management
  listAdminResources: (token, query = '') => request(`/admin/resources${query}`, {}, token),
  updateAdminResource: (token, id, body) =>
    request(`/admin/resources/${id}`, { method: 'PATCH', body: JSON.stringify(body) }, token),
  deleteAdminResource: (token, id, reason = '') =>
    request(`/admin/resources/${id}`, { method: 'DELETE', body: JSON.stringify({ reason }) }, token),
  approveResource: (token, id) =>
    request(`/admin/resources/${id}/approve`, { method: 'PATCH' }, token),
  rejectResource: (token, id, reason) =>
    request(
      `/admin/resources/${id}/reject`,
      { method: 'PATCH', body: JSON.stringify({ reason }) },
      token,
    ),
  requestChangesResource: (token, id, message) =>
    request(
      `/admin/resources/${id}/changes-requested`,
      { method: 'PATCH', body: JSON.stringify({ message }) },
      token,
    ),

  // Admin User Management
  listAdminUsers: (token, query = '') => request(`/admin/users${query}`, {}, token),
  getAdminUserDetail: (token, id) => request(`/admin/users/${id}`, {}, token),
  updateUserRole: (token, id, role) =>
    request(`/admin/users/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) }, token),
  updateUserStatus: (token, id, isActive) =>
    request(
      `/admin/users/${id}/status`,
      { method: 'PATCH', body: JSON.stringify({ isActive }) },
      token,
    ),

  // Admin Academic Structure
  listAllAcademic: (token) => request('/admin/academic/all', {}, token),
  createProgram: (token, body) =>
    request('/admin/programs', { method: 'POST', body: JSON.stringify(body) }, token),
  updateProgram: (token, id, body) =>
    request(`/admin/programs/${id}`, { method: 'PATCH', body: JSON.stringify(body) }, token),
  deleteProgram: (token, id) =>
    request(`/admin/programs/${id}`, { method: 'DELETE' }, token),

  createBranch: (token, body) =>
    request('/admin/branches', { method: 'POST', body: JSON.stringify(body) }, token),
  updateBranch: (token, id, body) =>
    request(`/admin/branches/${id}`, { method: 'PATCH', body: JSON.stringify(body) }, token),
  deleteBranch: (token, id) =>
    request(`/admin/branches/${id}`, { method: 'DELETE' }, token),

  createSemester: (token, body) =>
    request('/admin/semesters', { method: 'POST', body: JSON.stringify(body) }, token),
  updateSemester: (token, id, body) =>
    request(`/admin/semesters/${id}`, { method: 'PATCH', body: JSON.stringify(body) }, token),
  deleteSemester: (token, id) =>
    request(`/admin/semesters/${id}`, { method: 'DELETE' }, token),

  createSubject: (token, body) =>
    request('/admin/subjects', { method: 'POST', body: JSON.stringify(body) }, token),
  updateSubject: (token, id, body) =>
    request(`/admin/subjects/${id}`, { method: 'PATCH', body: JSON.stringify(body) }, token),
  deleteSubject: (token, id) =>
    request(`/admin/subjects/${id}`, { method: 'DELETE' }, token),

  // Developer / Team Management
  listAdminDevelopers: (token) => request('/admin/developers', {}, token),
  createDeveloper: (token, body) =>
    request('/admin/team', { method: 'POST', body: JSON.stringify(body) }, token),
  updateDeveloper: (token, id, body) =>
    request(`/admin/team/${id}`, { method: 'PATCH', body: JSON.stringify(body) }, token),
  deleteDeveloper: (token, id) =>
    request(`/admin/team/${id}`, { method: 'DELETE' }, token),

  // Suggestions & Reports Feedback
  listModerationFeedback: (token) => request('/admin/feedback', {}, token),
  listAllSuggestions: (token, query = '') => request(`/admin/suggestions/all${query}`, {}, token),
  listAllReports: (token, query = '') => request(`/admin/reports${query}`, {}, token),
  updateSuggestion: (token, id, status, reply = '') =>
    request(
      `/admin/suggestions/${id}`,
      { method: 'PATCH', body: JSON.stringify({ status, reply }) },
      token,
    ),
  updateReport: (token, id, status, reply = '') =>
    request(
      `/admin/reports/${id}`,
      { method: 'PATCH', body: JSON.stringify({ status, reply }) },
      token,
    ),
  resolveReport: (token, id, note = '') =>
    request(
      `/admin/reports/${id}/resolve`,
      { method: 'POST', body: JSON.stringify({ note }) },
      token,
    ),
  dismissReport: (token, id, reason = '') =>
    request(
      `/admin/reports/${id}/dismiss`,
      { method: 'POST', body: JSON.stringify({ reason }) },
      token,
    ),
}
