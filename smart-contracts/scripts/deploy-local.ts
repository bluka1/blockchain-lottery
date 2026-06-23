import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { network } from "hardhat";

const KEY_HASH = "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c";

async function main() {
  const { ethers } = await network.connect();

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const coordinator = await ethers.deployContract("VRFCoordinatorMock", [
    ethers.parseEther("0.1"),
    1_000_000_000n,
    4_000_000_000_000_000n,
  ]);
  await coordinator.waitForDeployment();
  const coordinatorAddress = await coordinator.getAddress();

  const createTx = await coordinator.createSubscription();
  const createReceipt = await createTx.wait();
  const created = createReceipt!.logs
    .map((log) => {
      try {
        return coordinator.interface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find((parsed) => parsed?.name === "SubscriptionCreated");
  const subId: bigint = created!.args.subId;

  await (await coordinator.fundSubscription(subId, ethers.parseEther("100"))).wait();

  const lottery = await ethers.deployContract("Lottery", [
    subId,
    coordinatorAddress,
    KEY_HASH,
  ]);
  await lottery.waitForDeployment();
  const lotteryAddress = await lottery.getAddress();

  await (await coordinator.addConsumer(subId, lotteryAddress)).wait();
  await (await lottery.setAutomationRegistry(deployer.address)).wait();

  const deployment = {
    lottery: lotteryAddress,
    coordinator: coordinatorAddress,
    subId: subId.toString(),
    chainId: 31337,
  };

  const deploymentsDir = join(process.cwd(), "deployments");
  mkdirSync(deploymentsDir, { recursive: true });
  writeFileSync(join(deploymentsDir, "local.json"), JSON.stringify(deployment, null, 2) + "\n");

  const frontendEnv = join(process.cwd(), "..", "frontend", ".env.local");
  writeFileSync(
    frontendEnv,
    [
      `VITE_CONTRACT_ADDRESS=${lotteryAddress}`,
      `VITE_CHAIN_ID=31337`,
      `VITE_CHAIN_NAME=Localhost`,
      "",
    ].join("\n")
  );

  console.log("\nLottery:", lotteryAddress);
  console.log("VRF Coordinator (mock):", coordinatorAddress);
  console.log("Subscription:", subId.toString());
  console.log("Automation registry:", deployer.address);
  console.log("\nWrote deployments/local.json and frontend/.env.local");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
