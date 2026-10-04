import { useEffect, useState } from 'react'
import { useAuth } from '../context/useAuth.js'
import { api } from '../services/api.js'

export default function OAuthCallbackPage({ onNavigate }) {
  const { setAuthSession, isAuthenticated } = useAuth()
  const [status, setStatus] = useState('processing')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const errorParam = params.get('error')
    const codeParam = params.get('code')
    const messageParam = params.get('message')
    const emailParam = params.get('email')

    if (errorParam) {
      setStatus('error')
      if (errorParam === 'domain_not_allowed') {
        setErrorMessage(
          messageParam || 'Registration is restricted to authorized university email domains.'
        )
      } else if (errorParam === 'account_exists_link_required') {
        setErrorMessage(
          `An account associated with ${emailParam || 'this email'} already exists. Please log in with your university password first, then connect this provider under Settings > Security.`
        )
      } else if (errorParam === 'provider_account_already_linked') {
        setErrorMessage(
          'This social account is already linked to another UNIHUB user.'
        )
      } else if (errorParam === 'no_verified_email') {
        setErrorMessage(
          'Your social account does not have a verified email address attached. Please verify your email with the provider.'
        )
      } else {
        setErrorMessage(messageParam || 'Social authentication failed. Please try again.')
      }
      return
    }

    if (!codeParam) {
      setStatus('error')
      setErrorMessage('Missing authorization response code. Please try signing in again.')
      return
    }

    let isMounted = true

    api
      .exchangeOAuthCode(codeParam)
      .then((data) => {
        if (!isMounted) return
        if (data?.user && data?.accessToken) {
          setAuthSession(data)
          setStatus('success')
          if (data.user.role === 'ADMIN' || data.user.role === 'MODERATOR') {
            onNavigate('/admin')
          } else {
            onNavigate('/dashboard')
          }
        } else {
          throw new Error('Incomplete session payload returned by server.')
        }
      })
      .catch((err) => {
        if (!isMounted) return
        setStatus('error')
        setErrorMessage(err.message || 'Failed to finalize social sign-in session.')
      })

    return () => {
      isMounted = false
    }
  }, [setAuthSession, onNavigate])

  return (
    <main className="auth-page">
      <div className="auth-panel callback-panel">
        <p className="eyebrow">UNIHUB</p>
        {status === 'processing' && (
          <div>
            <h1>Signing you in...</h1>
            <p className="auth-intro">
              Securely verifying your university credentials and establishing your session.
            </p>
            <div className="loading-spinner" role="progressbar" aria-label="Authenticating session"></div>
          </div>
        )}

        {status === 'error' && (
          <div>
            <h1 className="error-heading">Authentication Notice</h1>
            <div className="form-error auth-banner" role="alert">
              {errorMessage}
            </div>
            <div className="callback-actions">
              <button className="primary-button" onClick={() => onNavigate('/login')}>
                Back to Sign in <span>→</span>
              </button>
              {isAuthenticated && (
                <button className="secondary-button" onClick={() => onNavigate('/settings/security')}>
                  Go to Security Settings <span>→</span>
                </button>
              )}
            </div>
          </div>
        )}

        {status === 'success' && (
          <div>
            <h1>Session Verified!</h1>
            <p className="auth-intro">Redirecting to your workspace...</p>
          </div>
        )}
      </div>
    </main>
  )
}
