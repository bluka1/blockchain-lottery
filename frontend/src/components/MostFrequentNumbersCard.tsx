import { useEffect, useState } from 'react';
import {
	Bar,
	BarChart,
	Cell,
	Label,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from 'recharts';
import { API_BASE_URL } from '../config/api';

interface NumberFrequency {
	number: number;
	count: number;
}

const TOP_COUNT = 10;
const BAR_COLOR = '#7c5cff';

export function MostFrequentNumbersCard() {
	const [data, setData] = useState<NumberFrequency[]>([]);
	const [totalDraws, setTotalDraws] = useState(0);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const fetchFrequency = async () => {
			try {
				const response = await fetch(
					`${API_BASE_URL}/api/lotteries/stats/number-frequency`,
				);

				if (!response.ok) {
					throw new Error('Failed to fetch number frequency');
				}

				const payload = await response.json();
				const items: NumberFrequency[] = (payload.items ?? [])
					.filter((item: NumberFrequency) => item.count > 0)
					.sort((a: NumberFrequency, b: NumberFrequency) => b.count - a.count)
					.slice(0, TOP_COUNT);

				setData(items);
				setTotalDraws(payload.totalDraws ?? 0);
			} catch (err) {
				setError(
					err instanceof Error
						? err.message
						: 'Failed to load number frequency',
				);
			} finally {
				setLoading(false);
			}
		};

		fetchFrequency();
	}, []);

	return (
		<section className='stat-card'>
			<h3 className='stat-title'>📊 Top 10 Most Frequent Numbers</h3>

			{loading && <p className='stat-empty'>Loading…</p>}
			{!loading && error && <p className='stat-empty'>Error: {error}</p>}
			{!loading && !error && data.length === 0 && (
				<p className='stat-empty'>No draws recorded yet.</p>
			)}

			{!loading && !error && data.length > 0 && (
				<>
					<p className='stat-subtitle'>Across {totalDraws} verified draws</p>
					<ResponsiveContainer width='100%' height={data.length * 34 + 56}>
						<BarChart
							data={data}
							layout='vertical'
							margin={{ top: 0, right: 24, bottom: 24, left: 12 }}
						>
							<XAxis
								type='number'
								allowDecimals={false}
								tickLine={false}
								axisLine={{ stroke: '#3b3b52' }}
								tick={{ fill: '#9aa3c4', fontSize: 11 }}
							>
								<Label
									value='Times drawn'
									position='insideBottom'
									offset={-12}
									fill='#9aa3c4'
									fontSize={12}
								/>
							</XAxis>
							<YAxis
								type='category'
								dataKey='number'
								width={48}
								tickLine={false}
								axisLine={{ stroke: '#3b3b52' }}
								tick={{ fill: '#cbd5f5', fontSize: 13 }}
							>
								<Label
									value='Number'
									angle={-90}
									position='insideLeft'
									offset={0}
									style={{ textAnchor: 'middle' }}
									fill='#9aa3c4'
									fontSize={12}
								/>
							</YAxis>
							<Tooltip
								cursor={{ fill: 'rgba(124, 92, 255, 0.12)' }}
								formatter={(value) => [`${value} draws`, 'Drawn']}
								labelFormatter={(label) => `Number ${label}`}
							/>
							<Bar dataKey='count' radius={[0, 6, 6, 0]}>
								{data.map((entry) => (
									<Cell key={entry.number} fill={BAR_COLOR} />
								))}
							</Bar>
						</BarChart>
					</ResponsiveContainer>
				</>
			)}
		</section>
	);
}
