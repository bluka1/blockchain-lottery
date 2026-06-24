import { getExplorerTxUrl } from "../config/contract"

export interface RoundWinner {
  address: string
  amount: string
  matched: number
  type: "jackpot" | "lucky"
}

interface RoundTableRowProps {
  roundLabel: string
  sessionId: string | null
  date: string | null
  winningCombo: number[]
  players: number
  tx: string
  winners: RoundWinner[]
  isExpanded: boolean
  onToggle: () => void
}

function shortHash(hash: string): string {
  if (!hash || !hash.startsWith("0x") || hash.length < 12) return hash
  return `${hash.slice(0, 6)}…${hash.slice(-4)}`
}

function formatDateTime(value: string | null): string {
  if (!value) return "—"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return "—"
  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function TxCell({ tx }: { tx: string }) {
  const url = getExplorerTxUrl(tx)

  if (url) {
    return <a href={url} target="_blank" rel="noreferrer" className="tx-link">↗</a>
  }

  if (!tx || !tx.startsWith("0x")) {
    return <span className="tx-empty">—</span>
  }

  return (
    <button
      type="button"
      className="tx-copy"
      title="No block explorer on local chain — click to copy tx hash"
      onClick={(e) => {
        e.stopPropagation()
        navigator.clipboard?.writeText(tx)
      }}
    >
      {shortHash(tx)}
    </button>
  )
}

export function RoundTableRow({
  roundLabel,
  sessionId,
  date,
  winningCombo,
  players,
  tx,
  winners,
  isExpanded,
  onToggle,
}: RoundTableRowProps) {
  const hasWinners = winners.length > 0

  return (
    <>
      <tr className={hasWinners ? "round-row-expandable" : ""} onClick={hasWinners ? onToggle : undefined}>
        <td className="round-id">
          {hasWinners && <span className="round-caret">{isExpanded ? "▾" : "▸"}</span>}
          {roundLabel}
        </td>
        <td>{sessionId ? <span className="session-badge">{sessionId}</span> : "—"}</td>
        <td>{formatDateTime(date)}</td>
        <td>
          <div className="winning-combo">
            {winningCombo.map((number, index) => (
              <span key={index} className="number-badge">{number}</span>
            ))}
          </div>
        </td>
        <td>{players}</td>
        <td>
          <TxCell tx={tx} />
        </td>
      </tr>
      {hasWinners && isExpanded && (
        <tr className="winners-detail-row">
          <td colSpan={6}>
            <div className="winners-list">
              <span className="winners-title">Winners</span>
              {winners.map((winner) => (
                <div key={winner.address} className="winner-item">
                  <span className={`winner-type ${winner.type === "jackpot" ? "winner-jackpot" : "winner-lucky"}`}>
                    {winner.type === "jackpot" ? "🏆 Jackpot" : "🎟️ Lucky draw"}
                  </span>
                  <span className="winner-address">{shortHash(winner.address)}</span>
                  <span className="winner-matched">{winner.matched}/5 matched</span>
                  <span className="winner-amount">{Number(winner.amount).toFixed(4)} ETH</span>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
