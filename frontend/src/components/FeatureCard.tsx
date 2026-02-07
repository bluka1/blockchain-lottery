interface FeatureCardProps {
  icon: string
  title: string
  description: string | React.ReactNode
}

export function FeatureCard({icon, title, description}: FeatureCardProps) {
  return (
    <article className="feature-card">
      <div className="feature-icon">{icon}</div>
      <h3 className="feature-title">{title}</h3>
      <p className="feature-description">
        {description}
      </p>
    </article>
  )
}
