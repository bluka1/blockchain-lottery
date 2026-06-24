import { getExplorerTxUrl } from "../config/contract"

interface RoundTableRowProps {
  roundLabel: string
  sessionId: string | null
  date: string | null
  winningCombo: number[]
  players: number
  tx: string
}

function shortHash(hash: string): string {
  if (!hash || !hash.startsWith("0x") || hash.length < 12) return hash
  return `${hash.slice(0, 6)}…${hash.slice(-4)}`
}

function TxCell({ tx }: { tx: string }) {
  const url = getExplorerTxUrl(tx)

  if (url) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="tx-link">↗</a>
    )
  }

  if (!tx || !tx.startsWith("0x")) {
    return <span className="tx-empty">—</span>
  }

  return (
    <button
      type="button"
      className="tx-copy"
      title="No block explorer on local chain — click to copy tx hash"
      onClick={() => navigator.clipboard?.writeText(tx)}
    >
      {shortHash(tx)}
    </button>
  )
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

export function RoundTableRow({ roundLabel, sessionId, date, winningCombo, players, tx }: RoundTableRowProps) {
  return (
    <tr>
      <td className="round-id">{roundLabel}</td>
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
  )
}
