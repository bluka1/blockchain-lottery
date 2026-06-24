import { useEffect, useState } from "react";
import { useWeb3Context } from "../providers/Web3ContextProvider";
import { useLotteryContract } from "../hooks/useLotteryContract";
import { useLotteryEvents } from "../hooks/useLotteryEvents";

interface DrawResult {
  round: number;
  winning: number[];
  played: boolean;
  matched: number[];
}

export function DrawResultBanner() {
  const { wallet } = useWeb3Context();
  const { getUserEntry } = useLotteryContract();
  const { drawSet } = useLotteryEvents();
  const [result, setResult] = useState<DrawResult | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!drawSet) {
      return;
    }

    setDismissed(false);

    const resolve = async () => {
      let played = false;
      let matched: number[] = [];

      if (wallet) {
        const entry = await getUserEntry(drawSet.round, wallet);
        if (entry?.exists) {
          played = true;
          matched = entry.numbers.filter((n) => drawSet.winningNumbers.includes(n));
        }
      }

      setResult({
        round: drawSet.round,
        winning: drawSet.winningNumbers,
        played,
        matched,
      });
    };

    resolve();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawSet, wallet]);

  if (!result || dismissed) {
    return null;
  }

  const isJackpot = result.played && result.matched.length === 5;

  return (
    <section className="draw-result">
      <button
        className="draw-result-close"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
      >
        ×
      </button>

      <h2 className="draw-result-title">🎉 Round #{result.round} draw complete</h2>

      <div className="draw-result-numbers">
        {result.winning.map((n, i) => (
          <span key={i} className="draw-result-ball">
            {n}
          </span>
        ))}
      </div>

      {!result.played ? (
        <p className="draw-result-text">You didn't play this round. A new round is now open!</p>
      ) : isJackpot ? (
        <p className="draw-result-text">
          🏆 You matched all 5 numbers — you won the jackpot! Claim it in the Winnings box.
        </p>
      ) : result.matched.length > 0 ? (
        <p className="draw-result-text">
          You matched {result.matched.length} of 5 ({result.matched.join(", ")}). If you won a
          prize, claim it in the Winnings box below.
        </p>
      ) : (
        <p className="draw-result-text">
          No matches this time. Better luck in the new round!
        </p>
      )}
    </section>
  );
}
