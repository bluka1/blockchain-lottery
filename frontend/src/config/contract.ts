import lotteryAbi from "./lottery-abi.json";

export const CONTRACT_CONFIG = {
  address: import.meta.env.VITE_CONTRACT_ADDRESS ?? "0x6bb457c06d950aE273fBE89e32Dff89AaA2AfF0F",
  abi: lotteryAbi,
  chainId: Number(import.meta.env.VITE_CHAIN_ID ?? 11155111),
  chainName: import.meta.env.VITE_CHAIN_NAME ?? "Sepolia",
  rpcUrl: import.meta.env.VITE_RPC_URL ?? "http://127.0.0.1:8545",
} as const;

export const EXPECTED_CHAIN_ID_HEX = `0x${CONTRACT_CONFIG.chainId.toString(16)}`;

export const Phase = {
  Open: 0,
  Closed: 1,
  Drawn: 2,
  Paid: 3,
} as const;

export type PhaseType = typeof Phase[keyof typeof Phase];

export function getPhaseName(phase: PhaseType): string {
  switch (phase) {
    case Phase.Open:
      return "OPEN";
    case Phase.Closed:
      return "CLOSED";
    case Phase.Drawn:
      return "DRAWN";
    case Phase.Paid:
      return "PAID";
    default:
      return "UNKNOWN";
  }
}
