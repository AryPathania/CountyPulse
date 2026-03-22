import { useState } from 'react'
import { useAuth } from './AuthProvider'

export function SignOutButton({ className }: { className?: string }) {
  const { signOut } = useAuth()
  const [loading, setLoading] = useState(false)

  const handleSignOut = async () => {
    try {
      setLoading(true)
      await signOut()
    } catch (error) {
      console.error('Sign out error:', error)
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleSignOut}
      disabled={loading}
      className={className}
      data-testid="signout-button"
    >
      {loading ? 'Signing out...' : 'Sign out'}
    </button>
  )
}
