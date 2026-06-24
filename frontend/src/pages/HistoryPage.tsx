import { useState } from 'react'
import { HistoryTable } from '../components/HistoryTable'
import { MyGamesTable } from '../components/MyGamesTable'
import { MostFrequentNumbersCard } from '../components/MostFrequentNumbersCard'
import './history.css'

type HistoryTab = 'history' | 'my-games'

export function HistoryPage() {
  const [activeTab, setActiveTab] = useState<HistoryTab>('history')

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
          <div className="history-tabs">
            <button
              className={`history-tab ${activeTab === 'history' ? 'history-tab-active' : ''}`}
              onClick={() => setActiveTab('history')}
            >
              All Rounds
            </button>
            <button
              className={`history-tab ${activeTab === 'my-games' ? 'history-tab-active' : ''}`}
              onClick={() => setActiveTab('my-games')}
            >
              My Games
            </button>
          </div>

          {activeTab === 'history' ? <HistoryTable /> : <MyGamesTable />}
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
