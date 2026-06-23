import { ethers } from "hardhat";

// Correct Sepolia VRF V2 parameters from Chainlink documentation
const SEPOLIA_VRF_COORDINATOR = "0x8103B0A8A00be2DDC778e6e7eaa21791Cd364625";
const SEPOLIA_KEY_HASH = "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c";

// Your deployed contract address
const LOTTERY_ADDRESS = "0x0bb81fFBf48D83D653b76FcAb798c8403265C42b";

async function main() {
  console.log("🔧 Fixing VRF configuration for deployed Lottery contract...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer address:", deployer.address);
  console.log("Deployer balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

  // Get the deployed contract
  const lottery = await ethers.getContractAt("Lottery", LOTTERY_ADDRESS);

  console.log("📋 Current configuration:");
  try {
    const currentCoordinator = await lottery.s_vrfCoordinator();
    console.log("  Current VRF Coordinator:", currentCoordinator);
    console.log("  Expected VRF Coordinator:", SEPOLIA_VRF_COORDINATOR);
    console.log("  Match:", currentCoordinator.toLowerCase() === SEPOLIA_VRF_COORDINATOR.toLowerCase() ? "✅" : "❌");
  } catch (error) {
    console.log("  Error reading current coordinator:", error);
  }

  try {
    const currentKeyHash = await lottery.s_keyHash();
    console.log("\n  Current KeyHash:", currentKeyHash);
    console.log("  Expected KeyHash:", SEPOLIA_KEY_HASH);
    console.log("  Match:", currentKeyHash.toLowerCase() === SEPOLIA_KEY_HASH.toLowerCase() ? "✅" : "❌");
  } catch (error) {
    console.log("  Error reading current keyHash:", error);
  }

  // Check if we're the owner
  try {
    const owner = await lottery.owner();
    console.log("\n  Contract owner:", owner);
    console.log("  Your address:", deployer.address);
    console.log("  You are owner:", owner.toLowerCase() === deployer.address.toLowerCase() ? "✅" : "❌");

    if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
      console.log("\n⚠️  You are NOT the owner! Cannot update configuration.");
      return;
    }
  } catch (error) {
    console.log("  Error checking owner:", error);
  }

  // Update VRF Coordinator
  console.log("\n🔄 Updating VRF Coordinator...");
  try {
    const tx = await lottery.setCoordinator(SEPOLIA_VRF_COORDINATOR);
    console.log("  Transaction hash:", tx.hash);
    console.log("  Waiting for confirmation...");
    await tx.wait();
    console.log("  ✅ VRF Coordinator updated successfully!");
  } catch (error: any) {
    console.log("  ❌ Failed to update coordinator:", error.message);
  }

  // Check if contract has a setter for keyHash
  console.log("\n🔍 Checking if keyHash can be updated...");

  // KeyHash is typically immutable in VRF contracts, but let's verify the current state after coordinator update
  console.log("\n📋 Final configuration:");
  try {
    const finalCoordinator = await lottery.s_vrfCoordinator();
    console.log("  VRF Coordinator:", finalCoordinator);
    console.log("  Correct:", finalCoordinator.toLowerCase() === SEPOLIA_VRF_COORDINATOR.toLowerCase() ? "✅" : "❌");
  } catch (error) {
    console.log("  Error reading coordinator:", error);
  }

  try {
    const finalKeyHash = await lottery.s_keyHash();
    console.log("  KeyHash:", finalKeyHash);
    console.log("  Correct:", finalKeyHash.toLowerCase() === SEPOLIA_KEY_HASH.toLowerCase() ? "✅" : "❌");

    if (finalKeyHash.toLowerCase() !== SEPOLIA_KEY_HASH.toLowerCase()) {
      console.log("\n⚠️  KeyHash is still incorrect!");
      console.log("  The keyHash is set in the constructor and cannot be changed.");
      console.log("  You will need to redeploy the contract with the correct keyHash.");
    }
  } catch (error) {
    console.log("  Error reading keyHash:", error);
  }

  // Test reading some contract data to see if it works now
  console.log("\n🧪 Testing contract read functions...");
  try {
    const currentRound = await lottery.currentRound();
    console.log("  currentRound:", currentRound.toString());

    const phase = await lottery.phase();
    console.log("  phase:", phase, `(${["Open", "Closed", "Drawn", "Paid"][Number(phase)]})`);

    const nextDrawTime = await lottery.nextDrawTime();
    console.log("  nextDrawTime:", nextDrawTime.toString(), `(${new Date(Number(nextDrawTime) * 1000).toLocaleString()})`);

    const jackpot = await lottery.getCurrentJackpot();
    console.log("  jackpot:", ethers.formatEther(jackpot), "ETH");

    const participantsCount = await lottery.participantsCount();
    console.log("  participantsCount:", participantsCount.toString());

    console.log("\n✅ All read functions working!");
  } catch (error: any) {
    console.log("\n❌ Contract read functions still failing:", error.message);
  }

  console.log("\n✅ Done!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
