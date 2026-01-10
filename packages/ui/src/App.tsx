import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { AuthProvider, useAuth } from './components/auth/AuthProvider'
import { LoginForm } from './components/auth/LoginForm'
import { AuthGuard } from './components/auth/AuthGuard'
import { LogoutButton } from './components/auth/LogoutButton'
import { CompleteProfile } from './pages/CompleteProfile'
import { getUserProfileWithCompletion, type UserProfile } from '@county-pulse/db'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'

function Dashboard() {
  const [count, setCount] = useState(0)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const { user } = useAuth()

  useEffect(() => {
    const loadProfile = async () => {
      if (user?.id) {
        try {
          const { profile, isComplete, needsUpdate } = await getUserProfileWithCompletion(user.id)
          setUserProfile(profile)
          
          // If profile is incomplete or needs update, redirect to complete profile
          if (!isComplete || needsUpdate) {
            window.location.href = '/complete-profile'
            return
          }
        } catch (error) {
          console.error('Failed to load profile:', error)
        }
      }
      setProfileLoading(false)
    }
    
    loadProfile()
  }, [user?.id])

  if (profileLoading) {
    return <div>Loading your profile...</div>
  }

  const displayName = userProfile?.display_name || user?.email

  return (
    <>
      <div>
        <a href="https://vitejs.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>County Pulse</h1>
      <div className="user-info">
        <p>Welcome, {displayName}!</p>
        <LogoutButton />
      </div>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  )
}

function AuthenticatedApp() {
  return (
    <Router>
      <Routes>
        {/* Profile completion - accessible to authenticated users */}
        <Route path="/complete-profile" element={
          <AuthGuard fallback={<LoginForm />}>
            <CompleteProfile />
          </AuthGuard>
        } />
        
        {/* Main app - requires authentication */}
        <Route path="/" element={
          <AuthGuard fallback={<LoginForm />}>
            <Dashboard />
          </AuthGuard>
        } />
      </Routes>
    </Router>
  )
}

function App() {
  return (
    <AuthProvider>
      <AuthenticatedApp />
    </AuthProvider>
  )
}

export default App
