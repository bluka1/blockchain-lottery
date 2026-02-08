import { HistoryTable } from '../components/HistoryTable'
import { MostFrequentNumbersCard } from '../components/MostFrequentNumbersCard'
import './history.css'

export function HistoryPage() {
  return (
    <div className="history-page">
      <header className="history-header">
        <div>
          <h1 className="history-title">History</h1>
          <p className="history-subtitle">
            Every draw is cryptographically verified on-chain. Real-time statistics for strategic play.
          </p>
        </div>
      </header>

      <div className="history-content">
        <section className="history-main">
          <div className="section-header">
            <h2 className="section-title">Recent Rounds</h2>
          </div>
          <HistoryTable />
        </section>

        <aside className="history-sidebar">
          <MostFrequentNumbersCard />

          <section className="verified-card">
            <h3 className="verified-title">🛡️ Blockchain Verified</h3>
            <p className="verified-text">
              All lottery data is pulled from the Ethereum Testnet smart contract.
              Random numbers are generated via Chainlink VRF for provable fairness.
            </p>
          </section>
        </aside>
      </div>
    </div>
  )
}
