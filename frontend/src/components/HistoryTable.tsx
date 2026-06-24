import { useEffect, useState } from "react"
import { RoundTableRow } from "./RoundTableRow"
import { API_BASE_URL } from "../config/api"

const tableHeadings = ["ROUND", "SESSION", "DATE & TIME", "WINNING COMBO", "PLAYERS", "TX"]

interface LotteryHistoryItem {
  roundId: string;
  roundNumber: number | null;
  sessionId: string | null;
  date: string | null;
  winningCombo: number[];
  players: number;
  tx: string;
}

export function HistoryTable() {
  const [historyData, setHistoryData] = useState<LotteryHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/lotteries/history`);

        if (!response.ok) {
          throw new Error('Failed to fetch lottery history');
        }

        const data = await response.json();
        setHistoryData(data.items ?? []);
      } catch (err: any) {
        console.error('Error fetching lottery history:', err);
        setError(err.message || 'Failed to load history');
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, []);

  if (loading) {
    return <div className="loading-message">Loading history...</div>;
  }

  if (error) {
    return <div className="error-message">Error: {error}</div>;
  }

  if (historyData.length === 0) {
    return <div className="empty-message">No lottery history available yet.</div>;
  }

  return (
    <table className="rounds-table">
      <thead>
        <tr>
          {tableHeadings.map((heading, index) => (
            <th key={index}>{heading}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {historyData.map((round) => (
          <RoundTableRow
            key={round.roundId}
            roundLabel={round.roundNumber ? `#${round.roundNumber}` : round.roundId}
            sessionId={round.sessionId}
            date={round.date}
            winningCombo={round.winningCombo}
            players={round.players}
            tx={round.tx}
          />
        ))}
      </tbody>
    </table>
  )
}
