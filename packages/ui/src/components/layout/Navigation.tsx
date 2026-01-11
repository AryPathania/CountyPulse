import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import './Navigation.css'

const NAV_ITEMS = [
  { path: '/', label: 'Home' },
  { path: '/resumes', label: 'Resumes' },
  { path: '/bullets', label: 'Bullets' },
  { path: '/interview', label: 'Interview' },
]

export function Navigation() {
  const location = useLocation()
  const { user, signOut } = useAuth()

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
        {NAV_ITEMS.map((item) => (
          <li key={item.path}>
            <Link
              to={item.path}
              className={`nav__link ${location.pathname === item.path ? 'nav__link--active' : ''}`}
              data-testid={`nav-link-${item.label.toLowerCase()}`}
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
