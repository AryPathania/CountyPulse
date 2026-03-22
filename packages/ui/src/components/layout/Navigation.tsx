import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import './Navigation.css'

export function Navigation() {
  const location = useLocation()
  const { user, signOut } = useAuth()

  const [lastEdited, setLastEdited] = useState<{ id: string; name: string } | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem('lastEditedResume')
    if (stored) {
      try {
        setLastEdited(JSON.parse(stored))
      } catch {
        // ignore malformed data
      }
    }
  }, [])

  const navItems = [
    { path: '/', label: 'Home', testId: 'nav-link-home' },
    { path: '/resumes', label: 'Resumes', testId: 'nav-link-resumes' },
    { path: '/profile', label: 'Profile', testId: 'nav-link-profile' },
    ...(lastEdited
      ? [{ path: `/resumes/${lastEdited.id}/edit`, label: 'Edit Resume', testId: 'nav-continue-editing' }]
      : []),
    { path: '/bullets', label: 'Experience Bullets', testId: 'nav-link-bullets' },
    { path: '/interview', label: 'Interview', testId: 'nav-link-interview' },
    { path: '/telemetry', label: 'Telemetry', testId: 'nav-link-telemetry' },
    { path: '/settings', label: 'Settings', testId: 'nav-link-settings' },
  ]

  const handleSignOut = async () => {
    try {
      await signOut()
    } catch (error) {
      console.error('Sign out failed:', error)
    }
  }

  return (
    <nav className="nav" data-testid="navigation">
      <div className="nav__brand">
        <Link to="/" className="nav__logo">
          Odie
        </Link>
      </div>

      <ul className="nav__links">
        {navItems.map((item) => (
          <li key={item.path}>
            <Link
              to={item.path}
              className={`nav__link ${location.pathname === item.path ? 'nav__link--active' : ''}`}
              data-testid={item.testId}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>

      <div className="nav__account">
        {user && (
          <>
            <span className="nav__email" data-testid="nav-email">
              {user.email}
            </span>
            <button
              onClick={handleSignOut}
              className="nav__signout"
              data-testid="nav-signout"
            >
              Sign out
            </button>
          </>
        )}
      </div>
    </nav>
  )
}
