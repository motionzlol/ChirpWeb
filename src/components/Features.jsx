export default function Features() {
  const features = [
    {
      title: "Infractions",
      description: "Record and manage moderation actions with clear, permanent logs."
    },
    {
      title: "Promotions",
      description: "Streamline staff advancement using performance metrics and contributions."
    },
    {
      title: "Configurable",
      description: "Customize bot behavior for each server without writing any code."
    },
    {
      title: "Fast & Reliable",
      description: "Experience consistent, rapid responses and near-zero downtime."
    }
  ]

  return (
    <section id="features" className="features">
      <div className="container features__grid">
        {features.map((feature, index) => (
          <article key={index} className="glass feature reveal">
            <h3>{feature.title}</h3>
            <p>{feature.description}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

