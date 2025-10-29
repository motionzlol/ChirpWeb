import { useState, useEffect, useRef } from 'react'

export default function Navbar({ user }) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)
  const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
    }

    if (dropdownOpen) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [dropdownOpen])

  const handleLogout = () => {
    window.location.href = '/.netlify/functions/auth-logout'
  }

  const handleRefresh = () => {
    window.location.reload()
  }

  return (
    <header className="nav">
      <div className="container nav__inner">
        <a className="brand" href="/">
          <img src="/logo.png" alt="Chirp logo" className="brand__logo" />
          <span className="brand__name">Chirp</span>
        </a>
        <nav className="nav__links">
          <a href="/#features">Features</a>
          <a href="/#faq">FAQ</a>
          <a href="/#contact">Contact</a>
          <a href="/status">Status</a>
          
          {user ? (
            <div className="nav__auth" ref={dropdownRef}>
              <button 
                className="nav__user" 
                aria-expanded={dropdownOpen}
                onClick={() => setDropdownOpen(!dropdownOpen)}
              >
                <div className="nav__avatar-container">
                  <img 
                    className="nav__avatar" 
                    src={user.avatar_url || `https://cdn.discordapp.com/avatars/${user.sub}/${user.avatar}.png?size=80`} 
                    alt="Avatar" 
                    width="32" 
                    height="32" 
                  />
                </div>
                <span className="nav__username">{user.global_name || user.username}</span>
                <svg className={`nav__dropdown-arrow ${dropdownOpen ? 'rotate' : ''}`} width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              <div className={`nav__dropdown ${dropdownOpen ? 'show' : ''}`}>
                <div className="nav__dropdown-header">
                  <img 
                    className="nav__dropdown-avatar" 
                    src={user.avatar_url || `https://cdn.discordapp.com/avatars/${user.sub}/${user.avatar}.png?size=80`} 
                    alt="Avatar" 
                  />
                  <div className="nav__dropdown-user-info">
                    <span className="nav__dropdown-name">{user.global_name || user.username}</span>
                    <span className="nav__dropdown-tag">@{user.username}</span>
                  </div>
                </div>
                <div className="nav__dropdown-divider"></div>
                <a href="/dashboard" className="nav__dropdown-item">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M2 8.66667V13.3333C2 13.7015 2.29848 14 2.66667 14H13.3333C13.7015 14 14 13.7015 14 13.3333V8.66667" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    <path d="M11.3333 5.33333L8 2L4.66667 5.33333" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M8 2V10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  Dashboard
                </a>
                <a href="#" onClick={(e) => { e.preventDefault(); handleRefresh(); }} className="nav__dropdown-item">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M13.3333 3.33333V6.66667H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M2.66667 12.6667V9.33333H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M4.34001 6.33999C4.68001 5.53332 5.23334 4.83999 5.96001 4.33999C6.68668 3.83999 7.53334 3.58666 8.40001 3.61999C9.26668 3.65332 10.1 3.97332 10.7933 4.53332C11.4867 5.09332 12 5.85999 12.2667 6.73332" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M11.66 9.66001C11.32 10.4667 10.7667 11.16 10.04 11.66C9.31334 12.16 8.46667 12.4133 7.60001 12.38C6.73334 12.3467 5.90001 12.0267 5.20667 11.4667C4.51334 10.9067 4.00001 10.14 3.73334 9.26668" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Refresh
                </a>
                <a href="#" onClick={(e) => { e.preventDefault(); handleLogout(); }} className="nav__dropdown-item">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M6 14H3.33333C2.96514 14 2.66667 13.7015 2.66667 13.3333V2.66667C2.66667 2.29848 2.96514 2 3.33333 2H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M10.6667 11.3333L14 8L10.6667 4.66667" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M14 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Logout
                </a>
              </div>
            </div>
          ) : (
            <a className="btn btn--primary" href="/.netlify/functions/auth-login">Dashboard / Login</a>
          )}
        </nav>
      </div>
    </header>
  )
}

