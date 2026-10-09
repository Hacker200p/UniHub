import { useEffect, useState } from 'react'
import { useAuth } from '../context/useAuth.js'
import { api } from '../services/api.js'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api'

function GoogleIcon() {
  return (
    <svg className="provider-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.27A7.17 7.17 0 0 1 4.9 12c0-.79.14-1.57.38-2.27V6.58H1.25A11.97 11.97 0 0 0 0 12c0 1.92.45 3.74 1.25 5.42l4.03-3.15z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
      />
    </svg>
  )
}

function GithubIcon() {
  return (
    <svg className="provider-icon" viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  )
}

function MicrosoftIcon() {
  return (
    <svg className="provider-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path fill="#F25022" d="M1 1h10v10H1z" />
      <path fill="#7FBA00" d="M13 1h10v10H13z" />
      <path fill="#00A4EF" d="M1 13h10v10H1z" />
      <path fill="#FFB900" d="M13 13h10v10H13z" />
    </svg>
  )
}

export default function AuthPage({ mode = 'login', onNavigate }) {
  const isRegister = mode === 'register'
  const { login, register } = useAuth()
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    programId: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [providers, setProviders] = useState({ google: false, github: false, microsoft: false })

  useEffect(() => {
    // Check URL search parameters for errors (e.g. from OAuth redirect)
    const params = new URLSearchParams(window.location.search)
    const errorParam = params.get('error')
    const emailParam = params.get('email')
    const messageParam = params.get('message')

    if (errorParam === 'account_exists_link_required') {
      const providerParam = params.get('provider')
      const providerName = providerParam ? (providerParam.charAt(0).toUpperCase() + providerParam.slice(1)) : 'this provider'
      setError(
        messageParam || `An account with ${emailParam || 'this email'} already exists. Please sign in below to connect ${providerName} under Settings › Connected Accounts.`
      )
      if (emailParam) {
        setForm((prev) => ({ ...prev, email: emailParam }))
      }
    } else if (errorParam === 'domain_not_allowed') {
      setError(messageParam || 'Registration requires an authorized university email domain.')
    } else if (errorParam === 'oauth_cancelled' || errorParam === 'access_denied') {
      setError('Social sign-in was cancelled. Please try again.')
    } else if (errorParam === 'too_many_requests') {
      setError(messageParam || 'Too many sign-in attempts. Please wait a few minutes before trying again.')
    } else if (errorParam) {
      setError(messageParam || (errorParam !== 'true' ? errorParam : 'Authentication failed. Please try again.'))
    }

    // Fetch enabled OAuth providers
    api
      .getAuthProviders()
      .then((data) => {
        if (data) setProviders(data)
      })
      .catch(() => {
        // Fallback: omit social buttons gracefully
      })
  }, [])

  const handleOAuthLogin = (provider) => {
    window.location.href = `${API_URL}/auth/${provider}?intent=login`
  }

  const submit = async (event) => {
    event.preventDefault()
    setStatus('loading')
    setError('')

    if (isRegister && form.confirmPassword && form.password !== form.confirmPassword) {
      setError('Passwords do not match.')
      setStatus('idle')
      return
    }

    try {
      const session = isRegister
        ? await register({
            name: form.name,
            email: form.email,
            password: form.password,
            programId: form.programId,
          })
        : await login({ email: form.email, password: form.password })

      if (session?.user?.role === 'ADMIN' || session?.user?.role === 'MODERATOR') {
        onNavigate('/admin')
      } else {
        onNavigate('/dashboard')
      }
    } catch (submissionError) {
      setError(submissionError.message)
      setStatus('idle')
    }
  }

  const hasAnySocialProvider = Boolean(
    providers.google || providers.github || providers.microsoft
  )

  return (
    <main className="auth-page">
      <div className="auth-panel">
        <p className="eyebrow">UNIHUB</p>
        <h1>{isRegister ? 'Make the next note easier to find.' : 'Welcome back to the library.'}</h1>
        <p className="auth-intro">
          {isRegister
            ? 'Create a free student account to contribute resources and track your uploads.'
            : 'Sign in to upload notes, save resources and follow your contribution history.'}
        </p>

        {/* Social Login buttons */}
        {hasAnySocialProvider && !isRegister && (
          <div className="social-auth-section">
            {providers.google && (
              <button
                type="button"
                className="social-button google-btn"
                onClick={() => handleOAuthLogin('google')}
              >
                <GoogleIcon />
                <span>Continue with Google</span>
              </button>
            )}
            {providers.github && (
              <button
                type="button"
                className="social-button github-btn"
                onClick={() => handleOAuthLogin('github')}
              >
                <GithubIcon />
                <span>Continue with GitHub</span>
              </button>
            )}
            {providers.microsoft && (
              <button
                type="button"
                className="social-button microsoft-btn"
                onClick={() => handleOAuthLogin('microsoft')}
              >
                <MicrosoftIcon />
                <span>Continue with Microsoft</span>
              </button>
            )}

            <div className="auth-divider" role="separator" aria-label="Or sign in with email">
              <span>OR</span>
            </div>
          </div>
        )}

        <form onSubmit={submit}>
          {isRegister && (
            <label>
              Name
              <input
                required
                name="name"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </label>
          )}

          <label>
            University email
            <input
              required
              name="email"
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
            />
          </label>

          {isRegister && (
            <label>
              Program ID
              <input
                required
                name="programId"
                placeholder="Paste the program ID from the admin structure"
                value={form.programId}
                onChange={(event) => setForm({ ...form, programId: event.target.value })}
              />
            </label>
          )}

          <label>
            Password
            <div className="password-input-wrap">
              <input
                required
                name="password"
                minLength="12"
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </label>

          {isRegister && (
            <label>
              Confirm Password
              <div className="password-input-wrap">
                <input
                  name="confirmPassword"
                  minLength="12"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Repeat your password"
                  value={form.confirmPassword}
                  onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })}
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                >
                  {showConfirmPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </label>
          )}

          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}

          <button className="primary-button" disabled={status === 'loading'} type="submit">
            {status === 'loading' ? 'Working...' : isRegister ? 'Create account' : 'Sign in'}{' '}
            <span>↗</span>
          </button>
        </form>

        {/* Social Register options */}
        {hasAnySocialProvider && isRegister && (
          <div className="social-auth-section social-auth-footer">
            <div className="auth-divider" role="separator" aria-label="Or register with social provider">
              <span>OR</span>
            </div>
            {providers.google && (
              <button
                type="button"
                className="social-button google-btn"
                onClick={() => handleOAuthLogin('google')}
              >
                <GoogleIcon />
                <span>Continue with Google</span>
              </button>
            )}
            {providers.github && (
              <button
                type="button"
                className="social-button github-btn"
                onClick={() => handleOAuthLogin('github')}
              >
                <GithubIcon />
                <span>Continue with GitHub</span>
              </button>
            )}
            {providers.microsoft && (
              <button
                type="button"
                className="social-button microsoft-btn"
                onClick={() => handleOAuthLogin('microsoft')}
              >
                <MicrosoftIcon />
                <span>Continue with Microsoft</span>
              </button>
            )}
          </div>
        )}

        <button
          className="back-link"
          type="button"
          onClick={() => onNavigate(isRegister ? '/login' : '/register')}
        >
          {isRegister ? 'Already have an account? Sign in' : 'New here? Create an account'}
        </button>
      </div>
    </main>
  )
}
