interface RoundTableRowProps {
  roundId: string
  date: string
  winningCombo: string[] | number[]
  players: number
  tx: string
}

export function RoundTableRow({roundId, date, winningCombo, players, tx}: RoundTableRowProps) {
  return (
    <tr>
      <td className="round-id">{roundId}</td>
      <td>{new Date(date).toLocaleDateString()}</td>
      <td className="winning-combo">
        {winningCombo.map((number, index) => (
          <span key={index} className="number-badge">{number}</span>
        ))}
      </td>
      <td>{players}</td>
      <td>
        <a href={tx} target="_blank" className="tx-link">↗</a>
      </td>
    </tr>
  )
}
