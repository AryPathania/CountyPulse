import { useState } from 'react'
import { useAuth } from './AuthProvider'

export const LogoutButton: React.FC = () => {
  const { signOut, user, userProfile } = useAuth()
  const [loading, setLoading] = useState(false)

  if (!user) return null

  const displayName = userProfile?.display_name || user.email

  const handleSignOut = async () => {
    try {
      setLoading(true)
      await signOut()
    } catch (error) {
      console.error('Sign out error:', error)
      // Reset loading state on error
      setLoading(false)
    }
    // Note: don't reset loading on success, as the component will unmount
  }

  return (
    <button onClick={handleSignOut} disabled={loading}>
      {loading ? 'Signing out...' : `Sign Out (${displayName})`}
    </button>
  )
} 