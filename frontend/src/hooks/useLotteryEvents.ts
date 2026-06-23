import { useEffect, useState } from "react";
import { useWeb3Context } from "../providers/Web3ContextProvider";

export interface ParticipatedEvent {
  user: string;
  round: number;
  numbers: number[];
  timestamp: number;
}

export interface DrawSetEvent {
  round: number;
  winningNumbers: number[];
  seed: bigint;
  timestamp: number;
}

export interface PaidOutEvent {
  round: number;
  jackpotPool: bigint;
  secondaryPool: bigint;
  ownerFee: bigint;
  jackpotWon: boolean;
  timestamp: number;
}

export interface NewRoundStartedEvent {
  round: number;
  accumulatedJackpot: bigint;
  nextDrawTime: number;
  timestamp: number;
}

export interface JackpotRolloverEvent {
  fromRound: number;
  toRound: number;
  amount: bigint;
  timestamp: number;
}

export function useLotteryEvents() {
  const { contract } = useWeb3Context();
  const [participated, setParticipated] = useState<ParticipatedEvent | null>(null);
  const [drawSet, setDrawSet] = useState<DrawSetEvent | null>(null);
  const [paidOut, setPaidOut] = useState<PaidOutEvent | null>(null);
  const [newRoundStarted, setNewRoundStarted] = useState<NewRoundStartedEvent | null>(null);
  const [jackpotRollover, setJackpotRollover] = useState<JackpotRolloverEvent | null>(null);

  useEffect(() => {
    if (!contract) return;

    const onParticipated = (
      user: string,
      round: bigint,
      numbers: bigint[]
    ) => {
      setParticipated({
        user,
        round: Number(round),
        numbers: numbers.map((n) => Number(n)),
        timestamp: Date.now(),
      });
    };

    const onDrawSet = (
      round: bigint,
      winningNumbers: bigint[],
      seed: bigint,
      timestamp: bigint
    ) => {
      setDrawSet({
        round: Number(round),
        winningNumbers: winningNumbers.map((n) => Number(n)),
        seed,
        timestamp: Number(timestamp),
      });
    };

    const onPaidOut = (
      round: bigint,
      jackpotPool: bigint,
      secondaryPool: bigint,
      ownerFee: bigint,
      jackpotWon: boolean
    ) => {
      setPaidOut({
        round: Number(round),
        jackpotPool,
        secondaryPool,
        ownerFee,
        jackpotWon,
        timestamp: Date.now(),
      });
    };

    const onNewRoundStarted = (
      round: bigint,
      accumulatedJackpot: bigint,
      nextDrawTime: bigint
    ) => {
      setNewRoundStarted({
        round: Number(round),
        accumulatedJackpot,
        nextDrawTime: Number(nextDrawTime),
        timestamp: Date.now(),
      });
    };

    const onJackpotRollover = (
      fromRound: bigint,
      toRound: bigint,
      amount: bigint
    ) => {
      setJackpotRollover({
        fromRound: Number(fromRound),
        toRound: Number(toRound),
        amount,
        timestamp: Date.now(),
      });
    };

    contract.on("Participated", onParticipated);
    contract.on("DrawSet", onDrawSet);
    contract.on("PaidOut", onPaidOut);
    contract.on("NewRoundStarted", onNewRoundStarted);
    contract.on("JackpotRollover", onJackpotRollover);

    return () => {
      contract.off("Participated", onParticipated);
      contract.off("DrawSet", onDrawSet);
      contract.off("PaidOut", onPaidOut);
      contract.off("NewRoundStarted", onNewRoundStarted);
      contract.off("JackpotRollover", onJackpotRollover);
    };
  }, [contract]);

  const resetParticipated = () => setParticipated(null);
  const resetDrawSet = () => setDrawSet(null);
  const resetPaidOut = () => setPaidOut(null);
  const resetNewRoundStarted = () => setNewRoundStarted(null);
  const resetJackpotRollover = () => setJackpotRollover(null);

  return {
    participated,
    drawSet,
    paidOut,
    newRoundStarted,
    jackpotRollover,
    resetParticipated,
    resetDrawSet,
    resetPaidOut,
    resetNewRoundStarted,
    resetJackpotRollover,
  };
}
