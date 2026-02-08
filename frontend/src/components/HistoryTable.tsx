import { RoundTableRow } from "./RoundTableRow"

const tableHeadings = ["ROUND ID", "DATE", "WINNING COMBO", "PLAYERS", "TX"]

// TODO: hardcoded until we get data from the contract
const tableData = [
  {
    roundId: "#1025",
    date: "Jan 27, 2026",
    winningCombo: [4, 12, 19, 22, 45],
    players: 1,
    tx: "#"
  },
  {
    roundId: "#1024",
    date: "Jan 24, 2026",
    winningCombo: [4, 12, 19, 22, 45],
    players: 1,
    tx: "#"
  },
  {
    roundId: "#1023",
    date: "Jan 21, 2026",
    winningCombo: [1, 9, 14, 33, 41],
    players: 1,
    tx: "#"
  },
  {
    roundId: "#1022",
    date: "Jan 18, 2026",
    winningCombo: [1, 9, 14, 33, 41],
    players: 1,
    tx: "#"
  },
  {
    roundId: "#1021",
    date: "Jan 15, 2026",
    winningCombo: [1, 9, 14, 33, 41],
    players: 1,
    tx: "#"
  }
]

export function HistoryTable() {
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
        {tableData.map((round) => (
          <RoundTableRow key={round.roundId} roundId={round.roundId} date={round.date} winningCombo={round.winningCombo} players={round.players} tx={round.tx} />
        ))}
      </tbody>
    </table>
  )
}
