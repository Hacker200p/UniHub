import { useEffect, useState } from 'react'
import { api } from '../services/api.js'

export default function VerifyEmailPage({ onNavigate }) {
  const [status, setStatus] = useState('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token')
    if (!token) {
      setStatus('error')
      setMessage('This verification link is missing its token.')
      return
    }

    api.verifyEmail(token)
      .then(() => {
        setStatus('success')
        setMessage('Your email has been verified. You can now sign in.')
      })
      .catch((error) => {
        setStatus('error')
        setMessage(error.message)
      })
  }, [])

  return (
    <main className="auth-page">
      <section className="auth-card">
        <p className="eyebrow">ACCOUNT VERIFICATION</p>
        <h1>{status === 'loading' ? 'Verifying your email...' : status === 'success' ? 'Email verified' : 'Verification failed'}</h1>
        <p className={status === 'error' ? 'error-message' : 'muted'}>{status === 'loading' ? 'Please wait while we confirm your verification link.' : message}</p>
        {status !== 'loading' && (
          <button className="primary-button" onClick={() => onNavigate('/login')}>
            Continue to sign in →
          </button>
        )}
      </section>
    </main>
  )
}
