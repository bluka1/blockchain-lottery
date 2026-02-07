import { FeatureCard } from "../components/FeatureCard";
import { TimerToNextDraw } from "../components/TimerToNextDraw";
import "./home.css"

const featuresData = [
  {
    icon: "🛡️",
    title: "On-chain Randomness",
    description: "Powered by Chainlink VRF. Every winner is chosen through provably fair, verifiable on-chain entropy."
  },
  {
    icon: "⚡",
    title: "Instant Payouts",
    description: "Winners are paid directly to their wallet within minutes of the draw."
  },
  {
    icon: "💸",
    title: "Zero House Edge",
    description: "No house edge. Play with confidence."
  }
]

export function HomePage() {
  return (
    <article className="home-page">

      {/* TODO: hardcoded until we get information from the contract */}
      <div className="status-badge">
        <span className="status-indicator"></span>
        STATUS: ROUND #42 OPEN
      </div>

      <h1 className="hero-title">
        The Future of <span className="highlight">Fair Play</span>.
      </h1>

      <p className="hero-subtitle">
        A transparent, decentralized lottery built on the blockchain.
        <br />
        Verifiable randomness, instant payouts, zero house edge.
      </p>

      <button className="connect-button">
        <span className="">🚀</span>
        Connect Wallet to Play
      </button>

      <p className="connect-info">REQUIRES METAMASK</p>

      <TimerToNextDraw />

      <section className="features">
        {featuresData.map((feature) => (
          <FeatureCard
            key={feature.title}
            icon={feature.icon}
            title={feature.title}
            description={feature.description}
          />
        ))}
      </section>
    </article>
  )
}
