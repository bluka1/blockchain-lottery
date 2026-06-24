import { readFileSync } from "node:fs";
import { join } from "node:path";
import { network } from "hardhat";

const POLL_INTERVAL_MS = 5000;
const PHASE_CLOSED = 1;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const { ethers } = await network.connect();

  const deploymentPath = join(process.cwd(), "deployments", "local.json");
  let deployment: { lottery: string; coordinator: string };
  try {
    deployment = JSON.parse(readFileSync(deploymentPath, "utf8"));
  } catch {
    throw new Error("Missing deployments/local.json - run `npm run deploy:local` first");
  }

  const lottery = await ethers.getContractAt("Lottery", deployment.lottery);
  const coordinator = await ethers.getContractAt("VRFCoordinatorMock", deployment.coordinator);

  console.log("Keeper watching lottery:", deployment.lottery);
  console.log("Simulating Chainlink VRF + Automation. Press Ctrl+C to stop.\n");

  for (;;) {
    try {
      await ethers.provider.send("evm_mine", []);

      const phase = Number(await lottery.phase());
      const pending: boolean = await lottery.vrfRequestPending();

      if (phase === PHASE_CLOSED && pending) {
        const requestId = await lottery.vrfRequestId();
        await (await coordinator.fulfillRandomWords(requestId, deployment.lottery)).wait();
        console.log(`VRF fulfilled for request ${requestId.toString()}`);
      }

      const [needed, performData] = await lottery.checkUpkeep("0x");
      if (needed) {
        await (await lottery.performUpkeep(performData)).wait();
        const action = ethers.AbiCoder.defaultAbiCoder().decode(["uint8"], performData)[0];
        console.log(`performUpkeep executed (action ${action})`);
      }
    } catch (error: any) {
      console.error("Keeper iteration error:", error.message ?? error);
    }

    await sleep(POLL_INTERVAL_MS);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
