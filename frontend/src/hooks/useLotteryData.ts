import { useEffect, useState, useCallback } from "react";
import { useLotteryContract } from "./useLotteryContract";
import { useLotteryEvents } from "./useLotteryEvents";
import type { PhaseType } from "../config/contract";

export interface LotteryData {
  currentRound: number | null;
  phase: PhaseType | null;
  nextDrawTime: number | null;
  jackpot: string | null;
  participantsCount: number | null;
  userEntry: { exists: boolean; numbers: number[] } | null;
  loading: boolean;
  error: string | null;
}

export function useLotteryData(userAddress: string | null, autoRefresh = true) {
  const {
    contract,
    getCurrentRound,
    getPhase,
    getNextDrawTime,
    getCurrentJackpot,
    getParticipantsCount,
    getUserEntry,
  } = useLotteryContract();

  const { participated, newRoundStarted, paidOut } = useLotteryEvents();

  const [data, setData] = useState<LotteryData>({
    currentRound: null,
    phase: null,
    nextDrawTime: null,
    jackpot: null,
    participantsCount: null,
    userEntry: null,
    loading: true,
    error: null,
  });

  const fetchData = useCallback(async () => {
    if (!contract) {
      return;
    }

    setData((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const round = await getCurrentRound();
      const phase = await getPhase();
      const nextDraw = await getNextDrawTime();
      const jackpot = await getCurrentJackpot();
      const participants = await getParticipantsCount();

      let userEntry = null;
      if (userAddress && round !== null) {
        userEntry = await getUserEntry(round, userAddress);
      }

      setData({
        currentRound: round,
        phase: phase as PhaseType,
        nextDrawTime: nextDraw,
        jackpot,
        participantsCount: participants,
        userEntry,
        loading: false,
        error: null,
      });
    } catch (error: any) {
      console.error("Error fetching lottery data:", error);
      setData((prev) => ({
        ...prev,
        loading: false,
        error: error.message || "Failed to fetch lottery data",
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contract, userAddress]);

  useEffect(() => {
    if (contract) {
      fetchData();
    }
  }, [contract, fetchData]);

  useEffect(() => {
    if (participated || newRoundStarted || paidOut) {
      fetchData();
    }
  }, [participated, newRoundStarted, paidOut, fetchData]);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchData();
    }, 30000);

    return () => clearInterval(interval);
  }, [autoRefresh, fetchData]);

  return {
    ...data,
    refetch: fetchData,
  };
}
