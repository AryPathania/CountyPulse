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
      <div className="auth-form" data-testid="login-success">
        <h2>Check Your Email</h2>
        <p>We've sent a magic link to <strong>{email}</strong></p>
        <p>Click the link in your email to continue.</p>
        
        <button onClick={handleStartOver} className="secondary">
          Try Different Email
        </button>
        
        {message && <p className="success">{message}</p>}
      </div>
    )
  }

  return (
    <div className="auth-form" data-testid="login-form">
      <h2>Welcome to Odie</h2>
      <p>Enter your email to get started</p>

      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="email">Email Address</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
            placeholder="your@email.com"
            data-testid="login-email"
          />
        </div>

        <button type="submit" disabled={loading || !email} data-testid="login-submit">
          {loading ? 'Sending...' : 'Continue'}
        </button>
      </form>

      {error && <p className="error" data-testid="login-error">{error}</p>}
      {message && <p className="success">{message}</p>}
    </div>
  )
} 