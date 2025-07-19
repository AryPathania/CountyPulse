import { createContext, useContext, useEffect, useState } from 'react'
import { supabase, type User, type Session, getUserProfile, type UserProfile } from '@county-pulse/db'

interface AuthContextType {
  user: User | null
  session: Session | null
  userProfile: UserProfile | null
  loading: boolean
  signIn: (email: string) => Promise<void>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setSession(session)
      setUser(session?.user ?? null)
      
      // Load user profile for initial session
      if (session?.user) {
        try {
          const profile = await getUserProfile(session.user.id)
          setUserProfile(profile)
        } catch (error) {
          console.error('Failed to fetch user profile:', error)
          setUserProfile(null)
        }
      } else {
        setUserProfile(null)
      }
      
      setLoading(false)
    }
    
    getSession()

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
      
      // Load user profile when user changes
      if (session?.user) {
        try {
          const profile = await getUserProfile(session.user.id)
          setUserProfile(profile)
        } catch (error) {
          console.error('Failed to fetch user profile:', error)
          setUserProfile(null)
        }
      } else {
        setUserProfile(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) throw error
  }

  const signOut = async () => {
    try {
      // Clear local state immediately to prevent race conditions
      setUser(null)
      setSession(null)
      setUserProfile(null)
      setLoading(true)
      
      // Then sign out from Supabase
      const { error } = await supabase.auth.signOut({ 
        scope: 'global' // This ensures all sessions are cleared
      })
      
      if (error) {
        console.error('Sign out error:', error)
        // Re-fetch current session state if signOut failed
        const { data: { session } } = await supabase.auth.getSession()
        setSession(session)
        setUser(session?.user ?? null)
        if (session?.user) {
          try {
            const profile = await getUserProfile(session.user.id)
            setUserProfile(profile)
          } catch (e) {
            console.error('Failed to fetch user profile:', e)
            setUserProfile(null)
          }
        }
        throw error
      }
    } finally {
      setLoading(false)
    }
  }

  const refreshProfile = async () => {
    if (!user) {
      setUserProfile(null)
      return
    }

    try {
      const profile = await getUserProfile(user.id)
      setUserProfile(profile)
    } catch (error) {
      console.error('Failed to fetch user profile:', error)
      setUserProfile(null)
    }
  }

  return (
    <AuthContext.Provider value={{ user, session, userProfile, loading, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
} 