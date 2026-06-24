import { useEffect, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Label,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { API_BASE_URL } from '../config/api'

interface ParticipantsPoint {
  roundId: string
  roundNumber: number | null
  label: string
  players: number
}

const BAR_COLOR = '#7c5cff'

export function ParticipantsChart() {
  const [data, setData] = useState<ParticipantsPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/lotteries/stats/participants`)
        if (!response.ok) {
          throw new Error('Failed to fetch participants stats')
        }
        const payload = await response.json()
        const items: ParticipantsPoint[] = (payload.items ?? []).map((item: any) => ({
          roundId: item.roundId,
          roundNumber: item.roundNumber,
          label: item.roundNumber ? `#${item.roundNumber}` : item.roundId,
          players: item.players ?? 0,
        }))
        setData(items)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load participants stats')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  return (
    <section className="stat-card">
      <h3 className="stat-title">👥 Participants per Round</h3>

      {loading && <p className="stat-empty">Loading…</p>}
      {!loading && error && <p className="stat-empty">Error: {error}</p>}
      {!loading && !error && data.length === 0 && (
        <p className="stat-empty">No rounds recorded yet.</p>
      )}

      {!loading && !error && data.length > 0 && (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data} margin={{ top: 8, right: 16, bottom: 24, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={{ stroke: '#3b3b52' }}
              tick={{ fill: '#9aa3c4', fontSize: 11 }}
            >
              <Label value="Round" position="insideBottom" offset={-12} fill="#9aa3c4" fontSize={12} />
            </XAxis>
            <YAxis
              allowDecimals={false}
              tickLine={false}
              axisLine={{ stroke: '#3b3b52' }}
              tick={{ fill: '#9aa3c4', fontSize: 11 }}
            >
              <Label
                value="Players"
                angle={-90}
                position="insideLeft"
                style={{ textAnchor: 'middle' }}
                fill="#9aa3c4"
                fontSize={12}
              />
            </YAxis>
            <Tooltip
              cursor={{ fill: 'rgba(124, 92, 255, 0.12)' }}
              formatter={(value) => [`${value} players`, 'Players']}
              labelFormatter={(label) => `Round ${label}`}
            />
            <Bar dataKey="players" fill={BAR_COLOR} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </section>
  )
}
