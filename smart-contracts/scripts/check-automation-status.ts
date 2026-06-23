import hre from "hardhat";
import { ethers } from "ethers";

const LOTTERY_ADDRESS = "0x6bb457c06d950aE273fBE89e32Dff89AaA2AfF0F";

async function main() {
  console.log("🔍 Checking Lottery Automation Status...\n");

  const [owner] = await hre.ethers.getSigners();
  console.log("Your address:", owner.address);
  console.log("Your balance:", ethers.formatEther(await hre.ethers.provider.getBalance(owner.address)), "ETH\n");

  // Get the deployed contract
  const lottery = await hre.ethers.getContractAt("Lottery", LOTTERY_ADDRESS);

  console.log("📋 Contract State:");
  console.log("═".repeat(50));

  try {
    const currentRound = await lottery.currentRound();
    console.log("  Current Round:", currentRound.toString());

    const phase = await lottery.phase();
    const phaseNames = ["Open", "Closed", "Drawn", "Paid"];
    console.log("  Phase:", phase, `(${phaseNames[Number(phase)]})`);

    const nextDrawTime = await lottery.nextDrawTime();
    const nextDrawDate = new Date(Number(nextDrawTime) * 1000);
    const now = Math.floor(Date.now() / 1000);
    const timeUntilDraw = Number(nextDrawTime) - now;
    console.log("  Next Draw Time:", nextDrawTime.toString(), `(${nextDrawDate.toLocaleString()})`);
    console.log("  Time until draw:", timeUntilDraw > 0 ? `${timeUntilDraw}s` : `PASSED ${Math.abs(timeUntilDraw)}s ago`);

    const participantsCount = await lottery.participantsCount();
    console.log("  Participants Count:", participantsCount.toString());

    const jackpot = await lottery.getCurrentJackpot();
    console.log("  Current Jackpot:", ethers.formatEther(jackpot), "ETH");

    const contractOwner = await lottery.owner();
    console.log("  Contract Owner:", contractOwner);
    console.log("  You are owner:", contractOwner.toLowerCase() === owner.address.toLowerCase() ? "✅ YES" : "❌ NO");

  } catch (error: any) {
    console.log("  ❌ Error reading contract state:", error.message);
  }

  console.log("\n🤖 Automation Configuration:");
  console.log("═".repeat(50));

  try {
    const automationEnabled = await lottery.automationEnabled();
    console.log("  Automation Enabled:", automationEnabled ? "✅ YES" : "❌ NO");

    const automationRegistry = await lottery.automationRegistry();
    console.log("  Automation Registry:", automationRegistry);
    console.log("  Registry is set:", automationRegistry !== ethers.ZeroAddress ? "✅ YES" : "❌ NO (MUST BE SET!)");

    const lastUpkeepTimestamp = await lottery.lastUpkeepTimestamp();
    console.log("  Last Upkeep Timestamp:", lastUpkeepTimestamp.toString());
    if (Number(lastUpkeepTimestamp) > 0) {
      const lastUpkeepDate = new Date(Number(lastUpkeepTimestamp) * 1000);
      console.log("  Last Upkeep Date:", lastUpkeepDate.toLocaleString());
    } else {
      console.log("  Last Upkeep: ⚠️  NEVER (Automation never triggered)");
    }

  } catch (error: any) {
    console.log("  ❌ Error reading automation config:", error.message);
  }

  console.log("\n🔧 Testing checkUpkeep:");
  console.log("═".repeat(50));

  try {
    // checkUpkeep is a view function, we can call it directly
    const [upkeepNeeded, performData] = await lottery.checkUpkeep("0x");
    console.log("  Upkeep Needed:", upkeepNeeded ? "✅ YES" : "❌ NO");

    if (upkeepNeeded) {
      const action = ethers.AbiCoder.defaultAbiCoder().decode(["uint8"], performData)[0];
      const actionNames = {
        1: "Close lottery and request VRF",
        2: "Payout winners",
        3: "Start new round",
        4: "Skip to next draw time (no participants)"
      };
      console.log("  Action to perform:", action.toString(), `-`, actionNames[Number(action) as keyof typeof actionNames] || "Unknown");
    } else {
      console.log("  ⚠️  No upkeep needed - Automation won't trigger!");
    }

  } catch (error: any) {
    console.log("  ❌ Error calling checkUpkeep:", error.message);
  }

  console.log("\n📝 Next Steps:");
  console.log("═".repeat(50));

  const automationRegistry = await lottery.automationRegistry();

  if (automationRegistry === ethers.ZeroAddress) {
    console.log("\n⚠️  AUTOMATION REGISTRY NOT SET!");
    console.log("\nYou need to:");
    console.log("1. Create an Upkeep on Chainlink Automation:");
    console.log("   https://automation.chain.link/sepolia/new");
    console.log("\n2. When creating the Upkeep:");
    console.log("   - Contract address:", LOTTERY_ADDRESS);
    console.log("   - Select 'Custom logic' trigger");
    console.log("   - Fund with at least 1 LINK");
    console.log("   - Set gas limit to 500,000+");
    console.log("\n3. After creating the Upkeep, get the Forwarder address from the Upkeep details");
    console.log("\n4. Set the Automation Registry address:");
    console.log(`   npx hardhat run scripts/set-automation-registry.ts --network sepolia`);
  } else {
    console.log("\n✅ Automation Registry is set!");
    console.log("\nCheck your Upkeep status:");
    console.log("   https://automation.chain.link/sepolia");
    console.log("\nMake sure:");
    console.log("   - Upkeep is Active (not Paused)");
    console.log("   - Upkeep has sufficient LINK balance");
    console.log("   - Contract address in Upkeep matches:", LOTTERY_ADDRESS);
  }

  console.log("\n✅ Done!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
