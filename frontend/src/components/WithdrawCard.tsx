import { useCallback, useEffect, useState } from "react";
import { useWeb3Context } from "../providers/Web3ContextProvider";
import { useLotteryContract } from "../hooks/useLotteryContract";
import { useLotteryEvents } from "../hooks/useLotteryEvents";

export function WithdrawCard() {
  const { wallet, contract } = useWeb3Context();
  const { withdraw, getPendingWithdrawal, txState, resetTxState } = useLotteryContract();
  const { paidOut } = useLotteryEvents();
  const [pending, setPending] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!wallet) {
      setPending(null);
      return;
    }
    const amount = await getPendingWithdrawal(wallet);
    setPending(amount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet, contract]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (paidOut) {
      refresh();
    }
  }, [paidOut, refresh]);

  const handleWithdraw = async () => {
    const receipt = await withdraw();
    if (receipt) {
      await refresh();
      setTimeout(resetTxState, 5000);
    }
  };

  const amount = pending ? parseFloat(pending) : 0;

  if (!wallet || amount <= 0) {
    return null;
  }

  const showSuccess = !txState.loading && !txState.error && txState.txHash;

  return (
    <div className="participate-section withdraw-card">
      <h2>Your Winnings</h2>

      <div className="jackpot-display">
        <span className="jackpot-label">Available to claim</span>
        <span className="jackpot-amount">{amount.toFixed(4)} ETH</span>
      </div>

      <button
        className="participate-button"
        onClick={handleWithdraw}
        disabled={txState.loading}
      >
        {txState.loading ? "Processing..." : "Claim Winnings"}
      </button>

      {txState.error && <div className="error-message">❌ {txState.error}</div>}

      {showSuccess && (
        <div className="success-message">
          ✅ Claimed! TX: {txState.txHash?.substring(0, 10)}...
        </div>
      )}
    </div>
  );
}
