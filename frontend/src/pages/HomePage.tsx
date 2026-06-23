import { useState } from "react";
import { FeatureCard } from "../components/FeatureCard";
import { TimerToNextDraw } from "../components/TimerToNextDraw";
import { WithdrawCard } from "../components/WithdrawCard";
import { useWeb3Context } from "../providers/Web3ContextProvider";
import { useLotteryData } from "../hooks/useLotteryData";
import { useLotteryContract } from "../hooks/useLotteryContract";
import { getPhaseName } from "../config/contract";
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
  const { wallet, connectWallet } = useWeb3Context();
  const lotteryData = useLotteryData(wallet);
  const { participate, txState, resetTxState } = useLotteryContract();

  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleNumberClick = (num: number) => {
    if (selectedNumbers.includes(num)) {
      setSelectedNumbers(selectedNumbers.filter(n => n !== num));
    } else if (selectedNumbers.length < 5) {
      setSelectedNumbers([...selectedNumbers, num]);
    }
  };

  const handleParticipate = async () => {
    if (selectedNumbers.length !== 5) {
      alert("Please select exactly 5 numbers");
      return;
    }

    await participate(selectedNumbers);

    if (!txState.error) {
      setShowSuccess(true);
      setSelectedNumbers([]);
      setTimeout(() => {
        setShowSuccess(false);
        resetTxState();
      }, 5000);
    }
  };

  const phaseText = lotteryData.phase !== null ? getPhaseName(lotteryData.phase) : "loading...";
  const roundText = lotteryData.currentRound !== null ? `#${lotteryData.currentRound}` : "#--";

  return (
    <article className="home-page">
      <div className="status-badge">
        <span className="status-indicator"></span>
        STATUS: ROUND {roundText} {phaseText}
      </div>

      <h1 className="hero-title">
        The Future of <span className="highlight">Fair Play</span>.
      </h1>

      <p className="hero-subtitle">
        A transparent, decentralized lottery built on the blockchain.
        <br />
        Verifiable randomness, instant payouts, zero house edge.
      </p>

      {lotteryData.jackpot && (
        <div className="jackpot-display">
          <span className="jackpot-label">Current Jackpot:</span>
          <span className="jackpot-amount">{parseFloat(lotteryData.jackpot).toFixed(4)} ETH</span>
        </div>
      )}

      {!wallet ? (
        <>
          <button className="connect-button" onClick={connectWallet}>
            <span>🚀</span>
            Connect Wallet to Play
          </button>
          <p className="connect-info">REQUIRES METAMASK</p>
        </>
      ) : (
        <div className="participate-section">
          <h2>Select Your Numbers (1-50)</h2>

          {lotteryData.userEntry?.exists ? (
            <div className="already-participated">
              <p>✅ You've already participated in this round!</p>
              <p>Your numbers: {lotteryData.userEntry.numbers.join(", ")}</p>
            </div>
          ) : (
            <>
              <div className="number-grid">
                {Array.from({ length: 50 }, (_, i) => i + 1).map(num => (
                  <button
                    key={num}
                    className={`number-button ${selectedNumbers.includes(num) ? 'selected' : ''}`}
                    onClick={() => handleNumberClick(num)}
                    disabled={txState.loading}
                  >
                    {num}
                  </button>
                ))}
              </div>

              <div className="selected-numbers">
                <p>Selected: {selectedNumbers.join(", ") || "None"} ({selectedNumbers.length}/5)</p>
              </div>

              <button
                className="participate-button"
                onClick={handleParticipate}
                disabled={selectedNumbers.length !== 5 || txState.loading}
              >
                {txState.loading ? "Processing..." : "Participate (0.005 ETH)"}
              </button>

              {txState.error && (
                <div className="error-message">
                  ❌ {txState.error}
                </div>
              )}

              {showSuccess && (
                <div className="success-message">
                  ✅ Successfully participated! TX: {txState.txHash?.substring(0, 10)}...
                </div>
              )}
            </>
          )}
        </div>
      )}

      {wallet && <WithdrawCard />}

      {lotteryData.nextDrawTime && <TimerToNextDraw targetTimestamp={lotteryData.nextDrawTime} />}

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
