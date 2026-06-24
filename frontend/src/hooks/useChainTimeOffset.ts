import { useEffect, useState } from "react";
import { useWeb3Context } from "../providers/Web3ContextProvider";

const SYNC_INTERVAL_MS = 15000;

export function useChainTimeOffset(): number {
  const { provider } = useWeb3Context();
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    if (!provider) {
      return;
    }

    let active = true;

    const sync = async () => {
      try {
        const block = await provider.getBlock("latest");
        if (block && active) {
          setOffset(block.timestamp - Math.floor(Date.now() / 1000));
        }
      } catch {
        // keep previous offset on transient errors
      }
    };

    sync();
    const interval = setInterval(sync, SYNC_INTERVAL_MS);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [provider]);

  return offset;
}
