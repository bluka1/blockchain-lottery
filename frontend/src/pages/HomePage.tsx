import { useEffect, useState } from "react";
import { FeatureCard } from "../components/FeatureCard";
import { TimerToNextDraw } from "../components/TimerToNextDraw";
import { WithdrawCard } from "../components/WithdrawCard";
import { DrawResultBanner } from "../components/DrawResultBanner";
import { PrizeRulesNote } from "../components/PrizeRulesNote";
import { useWeb3Context } from "../providers/Web3ContextProvider";
import { useLotteryData } from "../hooks/useLotteryData";
import { useLotteryContract } from "../hooks/useLotteryContract";
import { useChainTimeOffset } from "../hooks/useChainTimeOffset";
import { getPhaseName, Phase, CONTRACT_CONFIG } from "../config/contract";
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
  const { wallet, connectWallet, isCorrectChain, switchToExpectedChain } = useWeb3Context();
  const lotteryData = useLotteryData(wallet);
  const { participate, txState } = useLotteryContract();
  const chainTimeOffset = useChainTimeOffset();

  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    setShowSuccess(false);
    setSelectedNumbers([]);
  }, [wallet, lotteryData.currentRound]);

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

    const receipt = await participate(selectedNumbers);

    if (receipt) {
      setShowSuccess(true);
      setSelectedNumbers([]);
    }
  };

  const phaseText = wallet && !isCorrectChain
    ? "WRONG NETWORK"
    : lotteryData.phase !== null
      ? getPhaseName(lotteryData.phase)
      : "loading...";
  const roundText = lotteryData.currentRound !== null ? `#${lotteryData.currentRound}` : "#--";

  return (
    <article className="home-page">
      <div className="status-badge">
        <span className="status-indicator"></span>
        STATUS: ROUND {roundText} {phaseText}
      </div>

      {wallet && isCorrectChain && <DrawResultBanner />}

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
      ) : !isCorrectChain ? (
        <div className="network-warning">
          <p>⚠️ Wrong network. Switch MetaMask to <strong>{CONTRACT_CONFIG.chainName}</strong> to play.</p>
          <button className="connect-button" onClick={switchToExpectedChain}>
            Switch to {CONTRACT_CONFIG.chainName}
          </button>
        </div>
      ) : (
        <div className="participate-section">
          <h2>Select Your Numbers (1-50)</h2>

          <PrizeRulesNote />

          {lotteryData.userEntry?.exists ? (
            <div className="already-participated">
              <p>✅ You've already participated in this round!</p>
              <p>Your numbers: {lotteryData.userEntry.numbers.join(", ")}</p>
            </div>
          ) : lotteryData.phase !== null && lotteryData.phase !== Phase.Open ? (
            <div className="info-message">
              🎲 This round is closed and the draw is in progress. A new round will open
              shortly — come back in a moment to pick your numbers.
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

              {txState.loading && (
                <div className="info-message">
                  ⏳ {txState.txHash
                    ? "Transaction sent, waiting for confirmation…"
                    : "Confirm the transaction in your wallet…"}
                  {txState.txHash && (
                    <span className="tx-hash"> ({txState.txHash.substring(0, 10)}…)</span>
                  )}
                </div>
              )}

              {txState.error && (
                <div className="error-message">
                  ❌ {txState.error}
                </div>
              )}

              {showSuccess && !txState.loading && (
                <div className="success-message">
                  ✅ You're in! Your numbers are recorded on-chain.
                  {txState.txHash && (
                    <span className="tx-hash"> TX: {txState.txHash.substring(0, 10)}…</span>
                  )}
                  <br />
                  The draw runs automatically when the countdown below hits zero.
                </div>
              )}
            </>
          )}
        </div>
      )}

      {wallet && isCorrectChain && <WithdrawCard />}

      {wallet && isCorrectChain && (
        <section className="draw-status">
          {lotteryData.phase === Phase.Open && lotteryData.nextDrawTime ? (
            <>
              <TimerToNextDraw targetTimestamp={lotteryData.nextDrawTime} offsetSeconds={chainTimeOffset} />
              <p className="draw-hint">
                When the countdown reaches zero, the draw is triggered automatically
                (Chainlink Automation + VRF) — you don't need to do anything. If you win,
                claim your prize from the Withdraw box above.
              </p>
            </>
          ) : lotteryData.phase === null ? (
            <p className="draw-hint">Loading round status…</p>
          ) : (
            <p className="draw-hint">
              🎲 Draw in progress — results are being finalized on-chain. Hang tight, this only takes a moment.
            </p>
          )}
        </section>
      )}

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
