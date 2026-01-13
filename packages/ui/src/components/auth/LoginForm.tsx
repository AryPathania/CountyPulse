import { useState } from 'react'
import { useAuth } from './AuthProvider'

export const LoginForm: React.FC = () => {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    try {
      await signIn(email)
      setSent(true)
      setMessage('Check your email for the magic link!')
    } catch (error) {
      console.error('Auth error:', error)
      setError(error instanceof Error ? error.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleStartOver = () => {
    setSent(false)
    setEmail('')
    setError('')
    setMessage('')
  }

  if (sent) {
    return (
      <div className="login-page" data-testid="login-success">
        <div className="login-form">
          <h1 className="login-form__title">Check Your Email</h1>
          <p className="login-form__subtitle">
            We have sent a magic link to <strong>{email}</strong>
          </p>
          <p className="login-form__subtitle">Click the link in your email to continue.</p>

          <button onClick={handleStartOver} className="login-form__button login-form__button--secondary">
            Try Different Email
          </button>

          {message && <p className="login-form__success">{message}</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="login-page" data-testid="login-form">
      <div className="login-form">
        <h1 className="login-form__title">Welcome to Odie AI</h1>
        <p className="login-form__subtitle">Enter your email to get started</p>

        <form onSubmit={handleSubmit} className="login-form__form">
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
            placeholder="your@email.com"
            className="login-form__input"
            data-testid="login-email"
          />

          <button
            type="submit"
            disabled={loading || !email}
            className="login-form__button"
            data-testid="login-submit"
          >
            {loading ? 'Sending...' : 'Continue'}
          </button>
        </form>

        {error && <p className="login-form__error" data-testid="login-error">{error}</p>}
        {message && <p className="login-form__success">{message}</p>}
      </div>
    </div>
  )
} 