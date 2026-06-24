require("dotenv").config();

const { ethers } = require("ethers");
const { admin, db } = require("../config/firebase");

const CONTRACT_ADDRESS =
  process.env.LOTTERY_CONTRACT_ADDRESS ||
  "0x6bb457c06d950aE273fBE89e32Dff89AaA2AfF0F";
const RPC_URL = process.env.RPC_URL || process.env.SEPOLIA_RPC_URL || "";
const SESSION_ID = process.env.LOTTERY_SESSION_ID || "default";

const CONTRACT_ABI = [
  "event Participated(address indexed user, uint256 indexed round, uint8[5] numbers)",
  "event DrawSet(uint256 indexed round, uint8[5] winningNumbers, uint256 seed, uint256 timestamp)",
  "event PaidOut(uint256 indexed round, uint256 jackpotPool, uint256 secondaryPool, uint256 ownerFee, bool jackpotWon)",
  "event NewRoundStarted(uint256 indexed round, uint256 accumulatedJackpot, uint256 nextDrawTime)",
  "event WinningsCredited(address indexed account, uint256 amount)",
];

const toDateString = (date) => date.toISOString().slice(0, 10);

class ContractListener {
  constructor() {
    if (!RPC_URL) {
      throw new Error("RPC_URL (or SEPOLIA_RPC_URL) not set in environment variables");
    }

    this.provider = new ethers.JsonRpcProvider(RPC_URL);
    this.contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, this.provider);
  }

  roundDoc(round) {
    return db.collection("lotteries").doc(`${SESSION_ID}_${round}`);
  }

  async startListening() {
    this.contract.on("Participated", (user, round, numbers, event) =>
      this.handleParticipated(user, round, numbers, event)
    );

    this.contract.on("DrawSet", (round, winningNumbers, seed, timestamp, event) =>
      this.handleDrawSet(round, winningNumbers, seed, timestamp, event)
    );

    this.contract.on("PaidOut", (round, jackpotPool, secondaryPool, ownerFee, jackpotWon, event) =>
      this.handlePaidOut(round, jackpotPool, secondaryPool, ownerFee, jackpotWon, event)
    );

    this.contract.on("NewRoundStarted", (round, accumulatedJackpot, nextDrawTime, event) =>
      this.handleNewRound(round, accumulatedJackpot, nextDrawTime, event)
    );

    console.log("Contract listener active:", CONTRACT_ADDRESS);
  }

  async handleParticipated(user, round, numbers, event) {
    try {
      const roundNumber = Number(round);
      const picked = numbers.map((n) => Number(n));
      const userLower = user.toLowerCase();

      await this.roundDoc(roundNumber)
        .collection("entries")
        .doc(userLower)
        .set({
          user,
          numbers: picked,
          round: roundNumber,
          sessionId: SESSION_ID,
          blockNumber: event.log.blockNumber,
          transactionHash: event.log.transactionHash,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

      await this.roundDoc(roundNumber).set(
        {
          roundNumber,
          sessionId: SESSION_ID,
          participants: admin.firestore.FieldValue.arrayUnion(user),
          picks: { [userLower]: picked },
          status: "open",
        },
        { merge: true }
      );
    } catch (error) {
      console.error("Error handling Participated event:", error);
    }
  }

  async handleDrawSet(round, winningNumbers, seed, timestamp, event) {
    try {
      const roundNumber = Number(round);
      const drawTimestamp = new Date(Number(timestamp) * 1000);

      await this.roundDoc(roundNumber).set(
        {
          roundNumber,
          sessionId: SESSION_ID,
          winningCombo: winningNumbers.map((n) => Number(n)),
          seed: seed.toString(),
          drawTimestamp,
          date: toDateString(drawTimestamp),
          drawBlockNumber: event.log.blockNumber,
          drawTransactionHash: event.log.transactionHash,
          status: "drawn",
        },
        { merge: true }
      );
    } catch (error) {
      console.error("Error handling DrawSet event:", error);
    }
  }

  async handlePaidOut(round, jackpotPool, secondaryPool, ownerFee, jackpotWon, event) {
    try {
      const roundNumber = Number(round);
      const winnings = await this.collectWinnings(event.log.transactionHash);

      await this.roundDoc(roundNumber).set(
        {
          roundNumber,
          sessionId: SESSION_ID,
          jackpotPool: ethers.formatEther(jackpotPool),
          secondaryPool: ethers.formatEther(secondaryPool),
          ownerFee: ethers.formatEther(ownerFee),
          jackpotWon,
          winnings,
          paidOutTimestamp: new Date(),
          paidOutBlockNumber: event.log.blockNumber,
          tx: event.log.transactionHash,
          status: "completed",
        },
        { merge: true }
      );
    } catch (error) {
      console.error("Error handling PaidOut event:", error);
    }
  }

  async collectWinnings(transactionHash) {
    const winnings = {};
    try {
      const receipt = await this.provider.getTransactionReceipt(transactionHash);
      if (!receipt) {
        return winnings;
      }

      for (const log of receipt.logs) {
        let parsed;
        try {
          parsed = this.contract.interface.parseLog(log);
        } catch {
          continue;
        }

        if (parsed?.name !== "WinningsCredited") {
          continue;
        }

        const account = parsed.args.account.toLowerCase();
        const amount = parsed.args.amount;
        const previous = winnings[account] ? ethers.parseEther(winnings[account]) : 0n;
        winnings[account] = ethers.formatEther(previous + amount);
      }
    } catch (error) {
      console.error("Error collecting winnings:", error);
    }

    return winnings;
  }

  async handleNewRound(round, accumulatedJackpot, nextDrawTime, event) {
    try {
      const roundNumber = Number(round);
      const drawTime = new Date(Number(nextDrawTime) * 1000);

      await this.roundDoc(roundNumber).set(
        {
          roundNumber,
          sessionId: SESSION_ID,
          accumulatedJackpot: ethers.formatEther(accumulatedJackpot),
          nextDrawTime: drawTime,
          startedTimestamp: new Date(),
          date: toDateString(new Date()),
          startBlockNumber: event.log.blockNumber,
          status: "open",
        },
        { merge: true }
      );
    } catch (error) {
      console.error("Error handling NewRoundStarted event:", error);
    }
  }

  stopListening() {
    this.contract.removeAllListeners();
  }
}

if (require.main === module) {
  const listener = new ContractListener();

  listener.startListening().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });

  process.on("SIGINT", () => {
    listener.stopListening();
    process.exit(0);
  });
}

module.exports = ContractListener;
