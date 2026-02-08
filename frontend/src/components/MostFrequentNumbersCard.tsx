// TODO: hardcoded until we get information from the contract
const numbersData = [
  { number: 7, count: 14 },
  { number: 22, count: 11 },
  { number: 45, count: 9 },
  { number: 13, count: 8 },
]

export function MostFrequentNumbersCard() {
  return (
    <section className="stat-card">
      <h3 className="stat-title">📊 Most Frequent Numbers</h3>
      <div className="frequency-list">
        {numbersData.map((item) => (
          <div key={item.number} className="frequency-item">
            <div className="frequency-label">
              <span>Number {item.number}</span>
              <span className="frequency-count">{item.count} draws</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
