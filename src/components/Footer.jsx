export default function Footer() {
  return (
    <footer id="contact" className="footer">
      <div className="container footer__inner glass">
        <p>© {new Date().getFullYear()} Chirp. All rights reserved.</p>
        <div className="footer__links">
          <a href="/#privacy">Privacy</a>
          <a href="/#terms">Terms</a>
          <a href="/status">Status</a>
        </div>
      </div>
    </footer>
  )
}

