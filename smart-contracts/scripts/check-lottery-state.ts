import { ethers } from "ethers";
import hre from "hardhat";

// Your deployed contract address
const LOTTERY_ADDRESS = "0x0bb81fFBf48D83D653b76FcAb798c8403265C42b";

async function main() {
  console.log("🔍 Checking Lottery contract state...\n");

  const lottery = await hre.ethers.getContractAt("Lottery", LOTTERY_ADDRESS);
  const [signer] = await hre.ethers.getSigners();

  console.log("📋 Contract Address:", LOTTERY_ADDRESS);
  console.log("👤 Your Address:", signer.address);
  console.log();

  try {
    // Basic info
    const currentRound = await lottery.currentRound();
    console.log("🎲 Current Round:", currentRound.toString());

    const phase = await lottery.phase();
    const phaseNames = ["Open", "Closed", "Drawn", "Paid"];
    console.log("📊 Phase:", phaseNames[Number(phase)], `(${phase})`);

    const nextDrawTime = await lottery.nextDrawTime();
    const date = new Date(Number(nextDrawTime) * 1000);
    console.log("⏰ Next Draw Time:", date.toLocaleString());

    const participantsCount = await lottery.participantsCount();
    console.log("👥 Participants:", participantsCount.toString());

    const jackpot = await lottery.getCurrentJackpot();
    console.log("💰 Jackpot:", ethers.formatEther(jackpot), "ETH");

    const automationEnabled = await lottery.automationEnabled();
    console.log("🤖 Automation Enabled:", automationEnabled);

    const vrfRequestPending = await lottery.vrfRequestPending();
    console.log("🎰 VRF Request Pending:", vrfRequestPending);

    // Owner check
    const owner = await lottery.owner();
    const isOwner = owner.toLowerCase() === signer.address.toLowerCase();
    console.log("\n👑 Contract Owner:", owner);
    console.log("✅ You are owner:", isOwner ? "YES" : "NO");

    // Winning numbers (if drawn)
    try {
      const winningNumbers = await lottery.winningNumbers(0);
      console.log("\n🎯 Winning Numbers:");
      for (let i = 0; i < 5; i++) {
        const num = await lottery.winningNumbers(i);
        console.log(`  [${i}]:`, num.toString());
      }
    } catch (error) {
      console.log("\n🎯 Winning Numbers: Not yet drawn");
    }

    // Instructions based on current state
    console.log("\n📝 What you can do:");

    if (!isOwner) {
      console.log("  ⚠️  You are NOT the owner. You cannot call emergency functions.");
    } else {
      if (phase === 0n) { // Open
        if (participantsCount > 0n) {
          console.log("  1. Call emergencyCloseLottery() to close and request draw");
          console.log("     (Make sure automation is disabled first)");
        } else {
          console.log("  ⚠️  No participants yet. Cannot close lottery.");
        }
      } else if (phase === 1n) { // Closed
        if (vrfRequestPending) {
          console.log("  ⏳ Waiting for Chainlink VRF to fulfill random numbers...");
          console.log("  Check again in 1-3 blocks.");
        } else {
          console.log("  ⚠️  Phase is Closed but VRF not pending. Something went wrong.");
        }
      } else if (phase === 2n) { // Drawn
        console.log("  2. Call emergencyPayout() to distribute winnings");
      } else if (phase === 3n) { // Paid
        console.log("  3. Call emergencyStartNewRound() to start next round");
      }

      if (automationEnabled) {
        console.log("\n  💡 TIP: Call toggleAutomation(false) before using emergency functions");
      }
    }

  } catch (error: any) {
    console.error("\n❌ Error reading contract:", error.message);
    console.log("\nPossible reasons:");
    console.log("  - Contract not deployed at this address");
    console.log("  - Wrong network (make sure you're on Sepolia)");
    console.log("  - RPC provider issue");
  }

  console.log();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
