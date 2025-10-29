import { useState, useEffect, useRef } from 'react'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import Features from './components/Features'
import FAQ from './components/FAQ'
import Status from './components/Status'
import Dashboard from './components/Dashboard'
import GuildDashboard from './components/GuildDashboard'
import Footer from './components/Footer'

function App() {
  const [user, setUser] = useState(null)
  const scrollPosRef = useRef(0)

  useEffect(() => {
    fetch('/.netlify/functions/auth-me', { credentials: 'include', cache: 'no-store' })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.ok && data?.user) {
          setUser(data.user)
        }
      })
      .catch(() => {})

    const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const NAV_OFFSET = 72

    const handleAnchorClick = (e) => {
      const target = e.target.closest('a[href^="#"]')
      if (!target) return
      
      const href = target.getAttribute('href')
      if (!href || href === '#' || href.length < 2) return
      
      const id = href.slice(1)
      const element = document.getElementById(id)
      if (!element) return
      
      e.preventDefault()
      const y = element.getBoundingClientRect().top + window.scrollY - NAV_OFFSET
      window.scrollTo({ top: Math.max(y, 0), behavior: prefersReduced ? 'auto' : 'smooth' })
      history.pushState(null, '', `#${id}`)
    }

    document.addEventListener('click', handleAnchorClick)

    const handleScroll = () => {
      const nav = document.querySelector('.nav')
      const y = window.scrollY || window.pageYOffset
      
      if (!nav) return
      
      if (y > 6 && scrollPosRef.current <= 6) {
        nav.style.boxShadow = "0 1px 0 rgba(255,255,255,0.06) inset, 0 8px 24px rgba(0,0,0,0.35)"
      }
      if (y <= 6 && scrollPosRef.current > 6) {
        nav.style.boxShadow = "none"
      }
      scrollPosRef.current = y
    }

    window.addEventListener('scroll', handleScroll)

    const targets = Array.from(document.querySelectorAll('.hero__card, .features__grid, .feature, .faq__card, .footer__inner'))
    if (targets.length) {
      targets.forEach((el) => el.classList.add('reveal'))
      if (prefersReduced) {
        targets.forEach((el) => el.classList.add('is-visible'))
      } else {
        const inViewport = (el) => {
          const r = el.getBoundingClientRect()
          return r.bottom > 0 && r.top < (window.innerHeight || document.documentElement.clientHeight)
        }
        targets.forEach((el) => { if (inViewport(el)) el.classList.add('is-visible') })
        const io = new IntersectionObserver((entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) {
              e.target.classList.add('is-visible')
              io.unobserve(e.target)
            }
          })
        }, { root: null, rootMargin: '0px', threshold: 0 })
        targets.forEach((el) => io.observe(el))
      }
    }

    return () => {
      document.removeEventListener('click', handleAnchorClick)
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  const path = typeof window !== 'undefined' ? window.location.pathname : '/'
  const guildMatch = path.startsWith('/dashboard/') ? path.split('/')[2] : null

  return (
    <>
      <div className="bg fx-subtle" aria-hidden="true"></div>
      <div className="bg fx-noise" aria-hidden="true"></div>
      
      <Navbar user={user} setUser={setUser} />
      <main>
        {path === '/status' && <Status />}
        {path === '/dashboard' && <Dashboard />}
        {guildMatch && <GuildDashboard guildId={guildMatch} />}
        {path !== '/status' && path !== '/dashboard' && !guildMatch && (
          <>
            <Hero />
            <Features />
            <FAQ />
          </>
        )}
      </main>
      <Footer />
    </>
  )
}

export default App
