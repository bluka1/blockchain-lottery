import lotteryAbi from './lottery-abi.json';

export const CONTRACT_CONFIG = {
	address:
		import.meta.env.VITE_CONTRACT_ADDRESS ??
		'0x9EB6814E7DEb40B808edeDcC7554D28A7dE952D2',
	abi: lotteryAbi,
	chainId: Number(import.meta.env.VITE_CHAIN_ID ?? 11155111),
	chainName: import.meta.env.VITE_CHAIN_NAME ?? 'Sepolia',
	rpcUrl:
		import.meta.env.VITE_RPC_URL ??
		'https://ethereum-sepolia-rpc.publicnode.com',
} as const;

export const EXPECTED_CHAIN_ID_HEX = `0x${CONTRACT_CONFIG.chainId.toString(16)}`;

const EXPLORER_BASE_URLS: Record<number, string> = {
	1: 'https://etherscan.io',
	11155111: 'https://sepolia.etherscan.io',
	17000: 'https://holesky.etherscan.io',
};

export function getExplorerTxUrl(txHash: string): string | null {
	const base = EXPLORER_BASE_URLS[CONTRACT_CONFIG.chainId];
	if (!base || !txHash || !txHash.startsWith('0x')) {
		return null;
	}
	return `${base}/tx/${txHash}`;
}

export const Phase = {
	Open: 0,
	Closed: 1,
	Drawn: 2,
	Paid: 3,
} as const;

export type PhaseType = (typeof Phase)[keyof typeof Phase];

export function getPhaseName(phase: PhaseType): string {
	switch (phase) {
		case Phase.Open:
			return 'OPEN';
		case Phase.Closed:
			return 'CLOSED';
		case Phase.Drawn:
			return 'DRAWN';
		case Phase.Paid:
			return 'PAID';
		default:
			return 'UNKNOWN';
	}
}
