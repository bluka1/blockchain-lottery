import { useEffect, useState } from "react"
import { API_BASE_URL } from "../config/api"
import { useWeb3Context } from "../providers/Web3ContextProvider"
import { PrizeRulesNote } from "./PrizeRulesNote"

const tableHeadings = ["ROUND", "SESSION", "DATE & TIME", "YOUR NUMBERS", "WINNING COMBO", "MATCHED", "RESULT"]

interface MyGameItem {
  roundId: string;
  roundNumber: number | null;
  sessionId: string | null;
  date: string | null;
  yourNumbers: number[];
  winningCombo: number[];
  matchedNumbers: number[];
  matchedCount: number;
  won: boolean;
  amount: string;
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

export function MyGamesTable() {
  const { wallet } = useWeb3Context()
  const [games, setGames] = useState<MyGameItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!wallet) {
      setGames([])
      return
    }

    const fetchGames = async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(`${API_BASE_URL}/api/lotteries/my-games?address=${wallet}`)
        if (!response.ok) {
          throw new Error('Failed to fetch your games')
        }
        const data = await response.json()
        setGames(data.items ?? [])
      } catch (err: any) {
        console.error('Error fetching my games:', err)
        setError(err.message || 'Failed to load your games')
      } finally {
        setLoading(false)
      }
    }

    fetchGames()
  }, [wallet])

  if (!wallet) {
    return <div className="empty-message">Connect your wallet to see the rounds you played.</div>
  }

  if (loading) {
    return <div className="loading-message">Loading your games...</div>
  }

  if (error) {
    return <div className="error-message">Error: {error}</div>
  }

  if (games.length === 0) {
    return <div className="empty-message">You haven't played any rounds yet.</div>
  }

  return (
    <>
      <PrizeRulesNote />
      <table className="rounds-table">
      <thead>
        <tr>
          {tableHeadings.map((heading, index) => (
            <th key={index}>{heading}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {games.map((game) => {
          const matched = new Set(game.matchedNumbers)
          return (
            <tr key={game.roundId}>
              <td className="round-id">{game.roundNumber ? `#${game.roundNumber}` : game.roundId}</td>
              <td>{game.sessionId ? <span className="session-badge">{game.sessionId}</span> : "—"}</td>
              <td>{formatDateTime(game.date)}</td>
              <td className="winning-combo">
                {game.yourNumbers.map((number, index) => (
                  <span
                    key={index}
                    className={`number-badge ${matched.has(number) ? "number-badge-hit" : "number-badge-muted"}`}
                  >
                    {number}
                  </span>
                ))}
              </td>
              <td className="winning-combo">
                {game.winningCombo.length > 0
                  ? game.winningCombo.map((number, index) => (
                      <span key={index} className="number-badge">{number}</span>
                    ))
                  : "—"}
              </td>
              <td className="matched-count">{game.matchedCount}/5</td>
              <td>
                {game.won ? (
                  <span className="result-won">
                    {game.matchedCount === 5 ? "🏆 Jackpot " : "🎟️ Lucky draw "}
                    {Number(game.amount).toFixed(4)} ETH
                  </span>
                ) : (
                  <span className="result-lost">No win</span>
                )}
              </td>
            </tr>
          )
        })}
      </tbody>
      </table>
    </>
  )
}
