require("dotenv").config();

const { ethers } = require("ethers");
const { admin, db } = require("../config/firebase");

const CONTRACT_ADDRESS =
  process.env.LOTTERY_CONTRACT_ADDRESS ||
  "0x6bb457c06d950aE273fBE89e32Dff89AaA2AfF0F";
const RPC_URL = process.env.RPC_URL || process.env.SEPOLIA_RPC_URL || "";

const CONTRACT_ABI = [
  "event Participated(address indexed user, uint256 indexed round, uint8[5] numbers)",
  "event DrawSet(uint256 indexed round, uint8[5] winningNumbers, uint256 seed, uint256 timestamp)",
  "event PaidOut(uint256 indexed round, uint256 jackpotPool, uint256 secondaryPool, uint256 ownerFee, bool jackpotWon)",
  "event NewRoundStarted(uint256 indexed round, uint256 accumulatedJackpot, uint256 nextDrawTime)",
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
    return db.collection("lotteries").doc(round.toString());
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

      await this.roundDoc(roundNumber)
        .collection("entries")
        .doc(user.toLowerCase())
        .set({
          user,
          numbers: picked,
          round: roundNumber,
          blockNumber: event.log.blockNumber,
          transactionHash: event.log.transactionHash,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

      await this.roundDoc(roundNumber).set(
        {
          roundNumber,
          participants: admin.firestore.FieldValue.arrayUnion(user),
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

      await this.roundDoc(roundNumber).set(
        {
          roundNumber,
          jackpotPool: ethers.formatEther(jackpotPool),
          secondaryPool: ethers.formatEther(secondaryPool),
          ownerFee: ethers.formatEther(ownerFee),
          jackpotWon,
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

  async handleNewRound(round, accumulatedJackpot, nextDrawTime, event) {
    try {
      const roundNumber = Number(round);
      const drawTime = new Date(Number(nextDrawTime) * 1000);

      await this.roundDoc(roundNumber).set(
        {
          roundNumber,
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
