export default function Features() {
  const features = [
    {
      title: "Infractions",
      description: "Track moderation actions with permanent records for accountability."
    },
    {
      title: "Promotions",
      description: "Evaluate staff advancement based on performance metrics and contributions."
    },
    {
      title: "Configurable",
      description: "Adjust behavior settings per server without custom code."
    },
    {
      title: "Fast & Reliable",
      description: "Built for consistent response times and minimal downtime."
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

