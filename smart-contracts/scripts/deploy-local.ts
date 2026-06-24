import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { network } from "hardhat";

const KEY_HASH = "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c";

function generateSessionId(length = 6): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = randomBytes(length);
  let id = "";
  for (let i = 0; i < length; i++) {
    id += alphabet[bytes[i] % alphabet.length];
  }
  return id;
}

function upsertEnv(filePath: string, values: Record<string, string>): void {
  const existing = existsSync(filePath) ? readFileSync(filePath, "utf8") : "";
  const lines = existing.length > 0 ? existing.replace(/\n+$/, "").split("\n") : [];
  const remaining = { ...values };

  const updated = lines.map((line) => {
    const match = line.match(/^([^#=]+)=/);
    if (match && match[1].trim() in remaining) {
      const key = match[1].trim();
      const value = remaining[key];
      delete remaining[key];
      return `${key}=${value}`;
    }
    return line;
  });

  for (const [key, value] of Object.entries(remaining)) {
    updated.push(`${key}=${value}`);
  }

  writeFileSync(filePath, updated.join("\n") + "\n");
}

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

  const deployReceipt = await lottery.deploymentTransaction()?.wait();
  const sessionId = deployReceipt?.blockHash
    ? deployReceipt.blockHash.slice(2, 8).toLowerCase()
    : generateSessionId();

  await (await coordinator.addConsumer(subId, lotteryAddress)).wait();
  await (await lottery.setAutomationRegistry(deployer.address)).wait();

  const deployment = {
    lottery: lotteryAddress,
    coordinator: coordinatorAddress,
    subId: subId.toString(),
    chainId: 31337,
    sessionId,
  };

  const deploymentsDir = join(process.cwd(), "deployments");
  mkdirSync(deploymentsDir, { recursive: true });
  writeFileSync(join(deploymentsDir, "local.json"), JSON.stringify(deployment, null, 2) + "\n");

  const frontendEnv = join(process.cwd(), "..", "frontend", ".env.local");
  upsertEnv(frontendEnv, {
    VITE_CONTRACT_ADDRESS: lotteryAddress,
    VITE_CHAIN_ID: "31337",
    VITE_CHAIN_NAME: "Localhost",
    VITE_SESSION_ID: sessionId,
  });

  const backendEnv = join(process.cwd(), "..", "backend", ".env");
  upsertEnv(backendEnv, {
    RPC_URL: "http://127.0.0.1:8545",
    LOTTERY_CONTRACT_ADDRESS: lotteryAddress,
    LOTTERY_SESSION_ID: sessionId,
  });

  console.log("\nLottery:", lotteryAddress);
  console.log("VRF Coordinator (mock):", coordinatorAddress);
  console.log("Subscription:", subId.toString());
  console.log("Automation registry:", deployer.address);
  console.log("Session ID:", sessionId);
  console.log("\nWrote deployments/local.json, frontend/.env.local and backend/.env");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
