import { RoundTableRow } from "./RoundTableRow"

const tableHeadings = ["ROUND ID", "DATE", "WINNING COMBO", "PLAYERS", "TX"]

// TODO: hardcoded until we get data from the contract
const tableData = [
  {
    roundId: "#1025",
    date: "Oct 27, 2023",
    winningCombo: [4, 12, 19, 22, 45],
    players: 1,
    tx: "#"
  },
  {
    roundId: "#1024",
    date: "Oct 24, 2023",
    winningCombo: [4, 12, 19, 22, 45],
    players: 1,
    tx: "#"
  },
  {
    roundId: "#1023",
    date: "Oct 21, 2023",
    winningCombo: [1, 9, 14, 33, 41],
    players: 1,
    tx: "#"
  },
  {
    roundId: "#1022",
    date: "Oct 18, 2023",
    winningCombo: [1, 9, 14, 33, 41],
    players: 1,
    tx: "#"
  },
  {
    roundId: "#1021",
    date: "Oct 15, 2023",
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
