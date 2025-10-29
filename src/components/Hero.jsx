export default function Hero() {
  return (
    <section className="hero">
      <div className="container">
        <div className="glass hero__card reveal">
          <div className="hero__content">
            <h1>Staff management that works</h1>
            <p>Handle infractions, promotions, and operational tasks directly in Discord with clear records and efficient workflows.</p>
            <div className="hero__actions">
              <a className="btn btn--primary" href="/dashboard">Open Dashboard</a>
              <a className="btn btn--ghost" href="#docs">Read Docs</a>
            </div>
          </div>
          <div className="hero__art">
            <img src="/logo.png" alt="Chirp emblem" className="hero__logo" />
          </div>
        </div>
      </div>
    </section>
  )
}

