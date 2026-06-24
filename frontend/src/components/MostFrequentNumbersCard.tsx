import { useEffect, useState } from 'react'
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { API_BASE_URL } from '../config/api'

interface NumberFrequency {
  number: number
  count: number
}

const TOP_COUNT = 10
const BAR_COLOR = '#7c5cff'

export function MostFrequentNumbersCard() {
  const [data, setData] = useState<NumberFrequency[]>([])
  const [totalDraws, setTotalDraws] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchFrequency = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/lotteries/stats/number-frequency`)

        if (!response.ok) {
          throw new Error('Failed to fetch number frequency')
        }

        const payload = await response.json()
        const items: NumberFrequency[] = (payload.items ?? [])
          .filter((item: NumberFrequency) => item.count > 0)
          .sort((a: NumberFrequency, b: NumberFrequency) => b.count - a.count)
          .slice(0, TOP_COUNT)

        setData(items)
        setTotalDraws(payload.totalDraws ?? 0)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load number frequency')
      } finally {
        setLoading(false)
      }
    }

    fetchFrequency()
  }, [])

  return (
    <section className="stat-card">
      <h3 className="stat-title">📊 Most Frequent Numbers</h3>

      {loading && <p className="stat-empty">Loading…</p>}
      {!loading && error && <p className="stat-empty">Error: {error}</p>}
      {!loading && !error && data.length === 0 && (
        <p className="stat-empty">No draws recorded yet.</p>
      )}

      {!loading && !error && data.length > 0 && (
        <>
          <p className="stat-subtitle">Across {totalDraws} verified draws</p>
          <ResponsiveContainer width="100%" height={data.length * 34}>
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 0, right: 24, bottom: 0, left: 0 }}
            >
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="number"
                width={36}
                tickLine={false}
                axisLine={false}
                tick={{ fill: '#cbd5f5', fontSize: 13 }}
              />
              <Tooltip
                cursor={{ fill: 'rgba(124, 92, 255, 0.12)' }}
                formatter={(value) => [`${value} draws`, 'Drawn']}
                labelFormatter={(label) => `Number ${label}`}
              />
              <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                {data.map((entry) => (
                  <Cell key={entry.number} fill={BAR_COLOR} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </>
      )}
    </section>
  )
}
