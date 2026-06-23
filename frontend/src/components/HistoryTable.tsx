import { useEffect, useState } from "react"
import { RoundTableRow } from "./RoundTableRow"

const tableHeadings = ["ROUND ID", "DATE", "WINNING COMBO", "PLAYERS", "TX"]

interface LotteryHistoryItem {
  roundId: string;
  date: string;
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
        const response = await fetch('http://localhost:4000/api/lotteries/history');

        if (!response.ok) {
          throw new Error('Failed to fetch lottery history');
        }

        const data = await response.json();

        const mappedData: LotteryHistoryItem[] = data.items.map((item: any) => ({
          roundId: `#${item.round || item.roundId}`,
          date: new Date(item.date).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          }),
          winningCombo: item.winningCombo || [],
          players: item.players || 0,
          tx: item.tx || '#'
        }));

        setHistoryData(mappedData);
        setLoading(false);
      } catch (err: any) {
        console.error('Error fetching lottery history:', err);
        setError(err.message || 'Failed to load history');
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
            roundId={round.roundId}
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
