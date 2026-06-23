import { useState } from "react";
import { useWeb3Context } from "../providers/Web3ContextProvider";
import { ethers } from "ethers";

export interface TransactionState {
  loading: boolean;
  error: string | null;
  txHash: string | null;
}

export function useLotteryContract() {
  const { contract, wallet } = useWeb3Context();
  const [txState, setTxState] = useState<TransactionState>({
    loading: false,
    error: null,
    txHash: null,
  });

  const resetTxState = () => {
    setTxState({ loading: false, error: null, txHash: null });
  };

  const participate = async (numbers: number[]) => {
    if (!contract || !wallet) {
      setTxState({
        loading: false,
        error: "Wallet not connected or contract not initialized",
        txHash: null,
      });
      return;
    }

    if (numbers.length !== 5) {
      setTxState({
        loading: false,
        error: "Must select exactly 5 numbers",
        txHash: null,
      });
      return;
    }

    for (const num of numbers) {
      if (num < 1 || num > 50) {
        setTxState({
          loading: false,
          error: "Numbers must be between 1 and 50",
          txHash: null,
        });
        return;
      }
    }

    const uniqueNumbers = new Set(numbers);
    if (uniqueNumbers.size !== 5) {
      setTxState({
        loading: false,
        error: "Numbers must be unique",
        txHash: null,
      });
      return;
    }

    setTxState({ loading: true, error: null, txHash: null });

    try {
      const ticketPrice = ethers.parseEther("0.005");
      const tx = await contract.participate(numbers, { value: ticketPrice });
      
      setTxState({ loading: true, error: null, txHash: tx.hash });

      const receipt = await tx.wait();
      
      setTxState({
        loading: false,
        error: null,
        txHash: receipt.hash,
      });

      return receipt;
    } catch (error: any) {
      console.error("Participate error:", error);
      let errorMessage = "Transaction failed";
      
      if (error.message) {
        if (error.message.includes("user rejected")) {
          errorMessage = "Transaction rejected by user";
        } else if (error.message.includes("Already participated")) {
          errorMessage = "You have already participated in this round";
        } else if (error.message.includes("Wrong ticket price")) {
          errorMessage = "Incorrect ticket price sent";
        } else if (error.message.includes("Not open")) {
          errorMessage = "Lottery is not open for participation";
        } else {
          errorMessage = error.message;
        }
      }

      setTxState({
        loading: false,
        error: errorMessage,
        txHash: null,
      });
    }
  };

  const withdraw = async () => {
    if (!contract || !wallet) {
      setTxState({
        loading: false,
        error: "Wallet not connected or contract not initialized",
        txHash: null,
      });
      return;
    }

    setTxState({ loading: true, error: null, txHash: null });

    try {
      const tx = await contract.withdraw();
      setTxState({ loading: true, error: null, txHash: tx.hash });

      const receipt = await tx.wait();

      setTxState({ loading: false, error: null, txHash: receipt.hash });
      return receipt;
    } catch (error: any) {
      console.error("Withdraw error:", error);
      let errorMessage = "Transaction failed";

      if (error.message) {
        if (error.message.includes("user rejected")) {
          errorMessage = "Transaction rejected by user";
        } else if (error.message.includes("Nothing to withdraw")) {
          errorMessage = "You have no winnings to withdraw";
        } else {
          errorMessage = error.message;
        }
      }

      setTxState({ loading: false, error: errorMessage, txHash: null });
    }
  };

  const getPendingWithdrawal = async (
    address: string
  ): Promise<string | null> => {
    if (!contract) return null;
    try {
      const amount = await contract.pendingWithdrawals(address);
      return ethers.formatEther(amount);
    } catch (error) {
      console.error("Error getting pending withdrawal:", error);
      return null;
    }
  };

  const getCurrentRound = async (): Promise<number | null> => {
    if (!contract) return null;
    try {
      const round = await contract.currentRound();
      return Number(round);
    } catch (error) {
      console.error("Error getting current round:", error);
      return null;
    }
  };

  const getPhase = async (): Promise<number | null> => {
    if (!contract) return null;
    try {
      const phase = await contract.phase();
      return Number(phase);
    } catch (error) {
      console.error("Error getting phase:", error);
      return null;
    }
  };

  const getNextDrawTime = async (): Promise<number | null> => {
    if (!contract) return null;
    try {
      const timestamp = await contract.nextDrawTime();
      return Number(timestamp);
    } catch (error) {
      console.error("Error getting next draw time:", error);
      return null;
    }
  };

  const getCurrentJackpot = async (): Promise<string | null> => {
    if (!contract) return null;
    try {
      const jackpot = await contract.getCurrentJackpot();
      return ethers.formatEther(jackpot);
    } catch (error) {
      console.error("Error getting jackpot:", error);
      return null;
    }
  };

  const getParticipantsCount = async (): Promise<number | null> => {
    if (!contract) return null;
    try {
      const count = await contract.participantsCount();
      return Number(count);
    } catch (error) {
      console.error("Error getting participants count:", error);
      return null;
    }
  };

  const getUserEntry = async (
    round: number,
    address: string
  ): Promise<{ exists: boolean; numbers: number[] } | null> => {
    if (!contract) return null;
    try {
      const [exists, numbers] = await contract.getUserEntry(round, address);
      return {
        exists,
        numbers: numbers.map((n: bigint) => Number(n)),
      };
    } catch (error) {
      console.error("Error getting user entry:", error);
      return null;
    }
  };

  return {
    contract,
    participate,
    withdraw,
    getPendingWithdrawal,
    txState,
    resetTxState,
    getCurrentRound,
    getPhase,
    getNextDrawTime,
    getCurrentJackpot,
    getParticipantsCount,
    getUserEntry,
  };
}
