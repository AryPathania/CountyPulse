/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from 'react'
import { supabase, type User } from '@odie/db'
import { queryClient } from '../../lib/queryClient'
import { accessKeys } from '../../hooks/useAccess'

interface AuthContextType {
  user: User | null
  loading: boolean
  signIn: (email: string) => Promise<void>
  signOut: () => Promise<void>
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
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth changes - trust Supabase to handle everything
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
      // Invalidate cached access check only when the token actually changed.
      // TOKEN_REFRESHED: new JWT obtained after expiry — re-check with fresh token.
      // SIGNED_IN: magic link login — re-check in case it's a different email.
      // INITIAL_SESSION: skip — useAccess fires its own query on mount.
      // SIGNED_OUT: skip — enabled:!!user prevents refetch when user is null.
      if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
        void queryClient.invalidateQueries({ queryKey: accessKeys.all })
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string) => {
    const redirectUrl = import.meta.env.VITE_APP_URL || window.location.origin
    console.log('Auth redirect URL:', `${redirectUrl}/`)
    
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${redirectUrl}/`,
      },
    })
    if (error) throw error
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
} 