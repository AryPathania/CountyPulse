import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import './Navigation.css'

export function Navigation() {
  const location = useLocation()
  const { user } = useAuth()

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
    { path: '/interview', label: 'Interview', testId: 'nav-link-interview' },
    { path: '/resumes', label: 'Resumes', testId: 'nav-link-resumes' },
    ...(lastEdited
      ? [{ path: `/resumes/${lastEdited.id}/edit`, label: 'Edit Resume', testId: 'nav-continue-editing' }]
      : []),
    { path: '/bullets', label: 'Experience Bullets', testId: 'nav-link-bullets' },
    { path: '/profile', label: 'Profile Info', testId: 'nav-link-profile' },
    { path: '/telemetry', label: 'Telemetry', testId: 'nav-link-telemetry' },
  ]

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
            <Link
              to="/settings"
              className="btn-secondary btn-sm"
              data-testid="nav-settings"
            >
              Settings
            </Link>
          </>
        )}
      </div>
    </nav>
  )
}
