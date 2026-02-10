import lotteryAbi from "./lottery-abi.json";

export const CONTRACT_CONFIG = {
  address: "0x0bb81fFBf48D83D653b76FcAb798c8403265C42b",
  abi: lotteryAbi,
  chainId: 11155111, // Sepolia testnet
  chainName: "Sepolia"
} as const;

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
