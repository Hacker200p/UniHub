import { useState } from 'react'
import { api } from '../services/api.js'

export default function ForgotPasswordPage({ onNavigate }) {
  const [step, setStep] = useState('email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [grant, setGrant] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [resendAt, setResendAt] = useState(0)

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    try {
      if (step === 'email') {
        await api.forgotPassword(email)
        setStep('otp')
        setResendAt(Date.now() + 60 * 1000)
        setMessage('If an account exists for that email address, a reset code will be sent.')
      } else if (step === 'otp') {
        const data = await api.verifyResetOtp(email, otp)
        setGrant(data.grant)
        setStep('password')
      } else {
        if (password !== confirmPassword) throw new Error('Passwords do not match.')
        await api.resetPassword(grant, password)
        setStep('done')
        setMessage('Your password has been reset. You can now sign in.')
      }
    } catch (submissionError) {
      setError(submissionError.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-panel">
        <p className="eyebrow">UNIHUB</p>
        <h1>{step === 'done' ? 'Password updated.' : 'Reset your password.'}</h1>
        <p className="auth-intro">
          {step === 'email' && 'Enter your account email and we will send a one-time reset code.'}
          {step === 'otp' && 'Enter the six-digit code from your email. It expires after 10 minutes.'}
          {step === 'password' && 'Choose a new password for your UniHub account.'}
          {step === 'done' && message}
        </p>
        {step !== 'done' ? (
          <form onSubmit={submit}>
            {step === 'email' && (
              <label>Email Address<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
            )}
            {step === 'otp' && (
              <>
                <label>Reset Code<input required inputMode="numeric" pattern="\d{6}" maxLength="6" value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, ''))} /></label>
                <button
                  type="button"
                  className="text-link"
                  disabled={busy || Date.now() < resendAt}
                  onClick={async () => {
                    setBusy(true)
                    setError('')
                    try {
                      await api.forgotPassword(email)
                      setResendAt(Date.now() + 60 * 1000)
                      setMessage('If an account exists for that email address, a reset code will be sent.')
                    } catch (resendError) {
                      setError(resendError.message)
                    } finally {
                      setBusy(false)
                    }
                  }}
                >
                  Resend code
                </button>
              </>
            )}
            {step === 'password' && (
              <>
                <label>New Password<input required minLength="12" type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
                <label>Confirm New Password<input required minLength="12" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>
              </>
            )}
            {error && <p className="form-error" role="alert">{error}</p>}
            {message && step !== 'done' && <p className="success-message">{message}</p>}
            <button className="primary-button" disabled={busy} type="submit">{busy ? 'Working...' : step === 'email' ? 'Send Reset Code' : step === 'otp' ? 'Verify Code' : 'Reset Password'} ↗</button>
          </form>
        ) : null}
        <button className="back-link" type="button" onClick={() => onNavigate('/login')}>Back to sign in</button>
      </div>
    </main>
  )
}
