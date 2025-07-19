import { useState } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { AuthProvider, useAuth } from './components/auth/AuthProvider'
import { LoginForm } from './components/auth/LoginForm'
import { AuthGuard } from './components/auth/AuthGuard'
import { LogoutButton } from './components/auth/LogoutButton'
import { AuthCallback } from './pages/AuthCallback'
import { CompleteProfile } from './pages/CompleteProfile'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'

function Dashboard() {
  const [count, setCount] = useState(0)
  const { user, userProfile } = useAuth()

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
        <p>Welcome, {userProfile?.display_name || user?.email}!</p>
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
        {/* Auth routes - accessible without authentication */}
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/auth/complete-profile" element={
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
