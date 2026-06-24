import { useEffect, useState } from 'react';
import {
	Bar,
	BarChart,
	CartesianGrid,
	Label,
	Legend,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from 'recharts';
import { API_BASE_URL } from '../config/api';

interface PayoutPoint {
	roundId: string;
	roundNumber: number | null;
	label: string;
	jackpot: number;
	secondary: number;
	owner: number;
}

const COLORS = {
	jackpot: '#f5b50a',
	secondary: '#7c5cff',
	owner: '#64748b',
};

export function PayoutsChart() {
	const [data, setData] = useState<PayoutPoint[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const fetchData = async () => {
			try {
				const response = await fetch(
					`${API_BASE_URL}/api/lotteries/stats/payouts`,
				);
				if (!response.ok) {
					throw new Error('Failed to fetch payout stats');
				}
				const payload = await response.json();
				const items: PayoutPoint[] = (payload.items ?? []).map((item: any) => ({
					roundId: item.roundId,
					roundNumber: item.roundNumber,
					label: item.roundNumber ? `#${item.roundNumber}` : item.roundId,
					jackpot: item.jackpot ?? 0,
					secondary: item.secondary ?? 0,
					owner: item.owner ?? 0,
				}));
				setData(items);
			} catch (err) {
				setError(
					err instanceof Error ? err.message : 'Failed to load payout stats',
				);
			} finally {
				setLoading(false);
			}
		};

		fetchData();
	}, []);

	return (
		<section className='stat-card'>
			<h3 className='stat-title'>💰 Payout Distribution per Round</h3>

			{loading && <p className='stat-empty'>Loading…</p>}
			{!loading && error && <p className='stat-empty'>Error: {error}</p>}
			{!loading && !error && data.length === 0 && (
				<p className='stat-empty'>No payouts recorded yet.</p>
			)}

			{!loading && !error && data.length > 0 && (
				<ResponsiveContainer width='100%' height={300}>
					<BarChart
						data={data}
						margin={{ top: 8, right: 16, bottom: 24, left: 12 }}
					>
						<CartesianGrid
							strokeDasharray='3 3'
							stroke='rgba(255,255,255,0.06)'
							vertical={false}
						/>
						<XAxis
							dataKey='label'
							tickLine={false}
							axisLine={{ stroke: '#3b3b52' }}
							tick={{ fill: '#9aa3c4', fontSize: 11 }}
						>
							<Label
								value='Round'
								position='insideBottom'
								offset={-12}
								fill='#9aa3c4'
								fontSize={12}
							/>
						</XAxis>
						<YAxis
							tickLine={false}
							axisLine={{ stroke: '#3b3b52' }}
							tick={{ fill: '#9aa3c4', fontSize: 11 }}
						>
							<Label
								value='ETH'
								angle={-90}
								position='insideLeft'
								style={{ textAnchor: 'middle' }}
								fill='#9aa3c4'
								fontSize={12}
							/>
						</YAxis>
						<Tooltip
							cursor={{ fill: 'rgba(124, 92, 255, 0.12)' }}
							formatter={(value, name) => [
								`${Number(value).toFixed(4)} ETH`,
								name,
							]}
							labelFormatter={(label) => `Round ${label}`}
						/>
						<Legend
							verticalAlign='top'
							height={28}
							wrapperStyle={{ fontSize: 12 }}
						/>
						<Bar
							dataKey='jackpot'
							name='Jackpot'
							stackId='p'
							fill={COLORS.jackpot}
						/>
						<Bar
							dataKey='secondary'
							name='Lucky draw'
							stackId='p'
							fill={COLORS.secondary}
						/>
						<Bar
							dataKey='owner'
							name='Costs'
							stackId='p'
							fill={COLORS.owner}
							radius={[6, 6, 0, 0]}
						/>
					</BarChart>
				</ResponsiveContainer>
			)}
		</section>
	);
}
