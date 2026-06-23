import "dotenv/config";
import { network } from "hardhat";

const DEFAULT_SEPOLIA_VRF_COORDINATOR = "0x8103B0A8A00be2DDC778e6e7eaa21791Cd364625";
const DEFAULT_SEPOLIA_KEY_HASH = "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function main() {
  const { ethers } = await network.connect();

  const subscriptionId = requireEnv("SEPOLIA_VRF_SUBSCRIPTION_ID");
  const vrfCoordinator = process.env.SEPOLIA_VRF_COORDINATOR || DEFAULT_SEPOLIA_VRF_COORDINATOR;
  const keyHash = process.env.SEPOLIA_KEY_HASH || DEFAULT_SEPOLIA_KEY_HASH;
  const automationRegistry = process.env.AUTOMATION_REGISTRY;

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");
  console.log("VRF Subscription ID:", subscriptionId);
  console.log("VRF Coordinator:", vrfCoordinator);
  console.log("Key Hash:", keyHash);

  const lottery = await ethers.deployContract("Lottery", [
    subscriptionId,
    vrfCoordinator,
    keyHash,
  ]);
  await lottery.waitForDeployment();

  const address = await lottery.getAddress();
  console.log("\nLottery deployed to:", address);

  if (automationRegistry) {
    const tx = await lottery.setAutomationRegistry(automationRegistry);
    await tx.wait();
    console.log("Automation registry set to:", automationRegistry);
  }

  console.log("\nNext steps:");
  console.log("1. Add the contract as a VRF consumer:");
  console.log(`   https://vrf.chain.link/sepolia/${subscriptionId}`);
  console.log("2. Create a Chainlink Automation upkeep (custom logic) targeting:", address);
  console.log("   https://automation.chain.link/sepolia");
  if (!automationRegistry) {
    console.log("3. Authorize the upkeep forwarder/registry:");
    console.log(`   lottery.setAutomationRegistry(<forwarderAddress>)`);
    console.log("   (or set AUTOMATION_REGISTRY in .env before deploying)");
  }
  console.log("4. Update frontend contract address in frontend/src/config/contract.ts");
  console.log("5. (Optional) Verify on Etherscan:");
  console.log(`   npx hardhat verify --network sepolia ${address} "${subscriptionId}" "${vrfCoordinator}" "${keyHash}"`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
