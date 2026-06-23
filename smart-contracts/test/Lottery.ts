import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.connect();

const TICKET_PRICE = ethers.parseEther("0.005");
const KEY_HASH = "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c";
const VRF_TIMEOUT = 30 * 60;
const DRAW_INTERVAL = 2 * 60;

const encodeAction = (action: number) =>
  ethers.AbiCoder.defaultAbiCoder().encode(["uint8"], [action]);

async function increaseTime(seconds: number) {
  await ethers.provider.send("evm_increaseTime", [seconds]);
  await ethers.provider.send("evm_mine", []);
}

async function fulfillCurrentRequest(
  lottery: any,
  coordinator: any,
  seed0: bigint,
  seed1: bigint
) {
  const requestId = await lottery.vrfRequestId();
  await coordinator.fulfillRandomWordsWithOverride(
    requestId,
    await lottery.getAddress(),
    [seed0, seed1]
  );
}

type Ticket = [number, number, number, number, number];

function predictWinningNumbers(seed: bigint): Ticket {
  let currentSeed = seed;
  const used = new Set<number>();
  const numbers: number[] = [];

  for (let i = 0; i < 5; i++) {
    let attempts = 0n;
    let num = 0;

    do {
      const hash = ethers.solidityPackedKeccak256(
        ["uint256", "uint8", "uint256"],
        [currentSeed, i, attempts]
      );
      currentSeed = BigInt(hash);
      num = Number(currentSeed % 50n) + 1;
      attempts++;
    } while (used.has(num) && attempts < 100n);

    used.add(num);
    numbers.push(num);
  }

  return numbers as Ticket;
}

function pickLosingNumbers(winning: number[]): Ticket {
  const taken = new Set(winning);
  const result: number[] = [];
  let n = 1;
  while (result.length < 5) {
    if (!taken.has(n)) result.push(n);
    n++;
  }
  return result as Ticket;
}

async function deployFixture() {
  const signers = await ethers.getSigners();
  const [owner] = signers;

  const coordinator = await ethers.deployContract("VRFCoordinatorMock", [
    ethers.parseEther("0.1"),
    1_000_000_000n,
    4_000_000_000_000_000n,
  ]);

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

  await coordinator.fundSubscription(subId, ethers.parseEther("100"));

  const lottery = await ethers.deployContract("Lottery", [
    subId,
    await coordinator.getAddress(),
    KEY_HASH,
  ]);

  await coordinator.addConsumer(subId, await lottery.getAddress());

  return { lottery, coordinator, subId, owner, signers };
}

async function drawWithSeed(
  lottery: any,
  coordinator: any,
  seed0: bigint,
  seed1: bigint
) {
  await lottery.closeLotteryAndRequestDraw();
  const requestId = await lottery.vrfRequestId();
  await coordinator.fulfillRandomWordsWithOverride(
    requestId,
    await lottery.getAddress(),
    [seed0, seed1]
  );
}

describe("Lottery", function () {
  describe("Deployment", function () {
    it("initializes round 1 in the Open phase", async function () {
      const { lottery, owner } = await deployFixture();

      expect(await lottery.currentRound()).to.equal(1n);
      expect(await lottery.phase()).to.equal(0n);
      expect(await lottery.owner()).to.equal(owner.address);
      expect(await lottery.nextDrawTime()).to.be.greaterThan(0n);
    });
  });

  describe("participate", function () {
    it("accepts a valid entry", async function () {
      const { lottery, signers } = await deployFixture();
      const player = signers[1];

      await expect(
        lottery.connect(player).participate([1, 2, 3, 4, 5], { value: TICKET_PRICE })
      )
        .to.emit(lottery, "Participated")
        .withArgs(player.address, 1n, [1, 2, 3, 4, 5]);

      expect(await lottery.participantsCount()).to.equal(1n);

      const [exists, numbers] = await lottery.getUserEntry(1, player.address);
      expect(exists).to.equal(true);
      expect(numbers.map((n: bigint) => Number(n))).to.deep.equal([1, 2, 3, 4, 5]);
    });

    it("rejects a wrong ticket price", async function () {
      const { lottery, signers } = await deployFixture();
      await expect(
        lottery.connect(signers[1]).participate([1, 2, 3, 4, 5], {
          value: ethers.parseEther("0.004"),
        })
      ).to.be.revertedWith("Wrong ticket price");
    });

    it("rejects double participation by the same wallet", async function () {
      const { lottery, signers } = await deployFixture();
      const player = signers[1];
      await lottery.connect(player).participate([1, 2, 3, 4, 5], { value: TICKET_PRICE });
      await expect(
        lottery.connect(player).participate([6, 7, 8, 9, 10], { value: TICKET_PRICE })
      ).to.be.revertedWith("Already participated");
    });

    it("rejects numbers out of range", async function () {
      const { lottery, signers } = await deployFixture();
      await expect(
        lottery.connect(signers[1]).participate([0, 2, 3, 4, 5], { value: TICKET_PRICE })
      ).to.be.revertedWith("Out of range");
      await expect(
        lottery.connect(signers[1]).participate([1, 2, 3, 4, 51], { value: TICKET_PRICE })
      ).to.be.revertedWith("Out of range");
    });

    it("rejects duplicate numbers", async function () {
      const { lottery, signers } = await deployFixture();
      await expect(
        lottery.connect(signers[1]).participate([1, 1, 3, 4, 5], { value: TICKET_PRICE })
      ).to.be.revertedWith("Duplicate");
    });

    it("rejects participation once the round is closed", async function () {
      const { lottery, signers } = await deployFixture();
      await lottery.connect(signers[1]).participate([1, 2, 3, 4, 5], { value: TICKET_PRICE });
      await lottery.closeLotteryAndRequestDraw();
      await expect(
        lottery.connect(signers[2]).participate([6, 7, 8, 9, 10], { value: TICKET_PRICE })
      ).to.be.revertedWith("Not open");
    });
  });

  describe("closeLotteryAndRequestDraw", function () {
    it("is restricted to the owner", async function () {
      const { lottery, signers } = await deployFixture();
      await lottery.connect(signers[1]).participate([1, 2, 3, 4, 5], { value: TICKET_PRICE });
      await expect(
        lottery.connect(signers[1]).closeLotteryAndRequestDraw()
      ).to.be.revert(ethers);
    });

    it("requires at least one participant", async function () {
      const { lottery } = await deployFixture();
      await expect(lottery.closeLotteryAndRequestDraw()).to.be.revertedWith(
        "No participants"
      );
    });

    it("moves to the Closed phase and marks a pending VRF request", async function () {
      const { lottery, signers } = await deployFixture();
      await lottery.connect(signers[1]).participate([1, 2, 3, 4, 5], { value: TICKET_PRICE });
      await lottery.closeLotteryAndRequestDraw();

      expect(await lottery.phase()).to.equal(1n);
      expect(await lottery.vrfRequestPending()).to.equal(true);
    });
  });

  describe("VRF fulfillment", function () {
    it("sets winning numbers and advances to the Drawn phase", async function () {
      const { lottery, coordinator, signers } = await deployFixture();
      await lottery.connect(signers[1]).participate([1, 2, 3, 4, 5], { value: TICKET_PRICE });

      await drawWithSeed(lottery, coordinator, 123456789n, 987654321n);

      expect(await lottery.phase()).to.equal(2n);
      expect(await lottery.vrfRequestPending()).to.equal(false);

      const expected = predictWinningNumbers(123456789n);
      for (let i = 0; i < 5; i++) {
        expect(Number(await lottery.winningNumbers(i))).to.equal(expected[i]);
      }
    });
  });

  describe("payoutWinners without a jackpot", function () {
    it("rolls the jackpot over and credits secondary pool plus owner fee", async function () {
      const { lottery, coordinator, signers } = await deployFixture();
      const seed0 = 111n;
      const winning = predictWinningNumbers(seed0);
      const losing = pickLosingNumbers(winning);

      const players = [signers[1], signers[2], signers[3]];
      for (const player of players) {
        await lottery.connect(player).participate(losing, { value: TICKET_PRICE });
      }

      const collected = TICKET_PRICE * 3n;
      await drawWithSeed(lottery, coordinator, seed0, 222n);
      await lottery.payoutWinners();

      expect(await lottery.phase()).to.equal(3n);
      expect(await lottery.accumulatedJackpot()).to.equal((collected * 50n) / 100n);
      expect(await lottery.totalPending()).to.equal((collected * 50n) / 100n);
    });
  });

  describe("withdraw", function () {
    it("lets a credited account pull funds exactly once", async function () {
      const { lottery, coordinator, signers, owner } = await deployFixture();
      const seed0 = 111n;
      const winning = predictWinningNumbers(seed0);
      const losing = pickLosingNumbers(winning);

      for (const player of [signers[1], signers[2], signers[3]]) {
        await lottery.connect(player).participate(losing, { value: TICKET_PRICE });
      }

      await drawWithSeed(lottery, coordinator, seed0, 222n);
      await lottery.payoutWinners();

      const ownerFee = await lottery.pendingWithdrawals(owner.address);
      expect(ownerFee).to.be.greaterThan(0n);

      const before = await ethers.provider.getBalance(owner.address);
      const tx = await lottery.withdraw();
      const receipt = await tx.wait();
      const gas = receipt!.gasUsed * receipt!.gasPrice;
      const after = await ethers.provider.getBalance(owner.address);

      expect(after).to.equal(before + ownerFee - gas);
      expect(await lottery.pendingWithdrawals(owner.address)).to.equal(0n);

      await expect(lottery.withdraw()).to.be.revertedWith("Nothing to withdraw");
    });

    it("reverts when there is nothing to withdraw", async function () {
      const { lottery, signers } = await deployFixture();
      await expect(
        lottery.connect(signers[5]).withdraw()
      ).to.be.revertedWith("Nothing to withdraw");
    });
  });

  describe("payoutWinners with a jackpot", function () {
    it("credits the full jackpot to the matching player", async function () {
      const { lottery, coordinator, signers } = await deployFixture();
      const seed0 = 777n;
      const winning = predictWinningNumbers(seed0);
      const losing = pickLosingNumbers(winning);

      const winner = signers[1];
      await lottery.connect(winner).participate(winning, { value: TICKET_PRICE });
      await lottery.connect(signers[2]).participate(losing, { value: TICKET_PRICE });
      await lottery.connect(signers[3]).participate(losing, { value: TICKET_PRICE });

      const collected = TICKET_PRICE * 3n;
      await drawWithSeed(lottery, coordinator, seed0, 222n);
      await lottery.payoutWinners();

      expect(await lottery.accumulatedJackpot()).to.equal(0n);
      expect(await lottery.pendingWithdrawals(winner.address)).to.equal(
        (collected * 50n) / 100n
      );
    });
  });

  describe("cancelStuckVRFRequest", function () {
    it("reverts before the timeout and reopens the round afterwards", async function () {
      const { lottery, signers } = await deployFixture();
      await lottery.connect(signers[1]).participate([1, 2, 3, 4, 5], { value: TICKET_PRICE });
      await lottery.closeLotteryAndRequestDraw();

      await expect(lottery.cancelStuckVRFRequest()).to.be.revertedWith(
        "Timeout not reached"
      );

      await ethers.provider.send("evm_increaseTime", [VRF_TIMEOUT + 1]);
      await ethers.provider.send("evm_mine", []);

      await expect(lottery.cancelStuckVRFRequest()).to.emit(
        lottery,
        "VRFRequestCancelled"
      );

      expect(await lottery.phase()).to.equal(0n);
      expect(await lottery.vrfRequestPending()).to.equal(false);
    });
  });

  describe("startNewRound", function () {
    it("resets state and increments the round", async function () {
      const { lottery, coordinator, signers } = await deployFixture();
      const seed0 = 111n;
      const losing = pickLosingNumbers(predictWinningNumbers(seed0));

      for (const player of [signers[1], signers[2], signers[3]]) {
        await lottery.connect(player).participate(losing, { value: TICKET_PRICE });
      }

      await drawWithSeed(lottery, coordinator, seed0, 222n);
      await lottery.payoutWinners();

      await expect(lottery.startNewRound()).to.emit(lottery, "JackpotRollover");

      expect(await lottery.currentRound()).to.equal(2n);
      expect(await lottery.phase()).to.equal(0n);
      expect(await lottery.participantsCount()).to.equal(0n);
    });
  });

  describe("getCurrentJackpot", function () {
    it("reflects the current pool while open and the rollover after payout", async function () {
      const { lottery, coordinator, signers } = await deployFixture();
      const seed0 = 111n;
      const losing = pickLosingNumbers(predictWinningNumbers(seed0));

      for (const player of [signers[1], signers[2], signers[3]]) {
        await lottery.connect(player).participate(losing, { value: TICKET_PRICE });
      }

      const collected = TICKET_PRICE * 3n;
      expect(await lottery.getCurrentJackpot()).to.equal((collected * 50n) / 100n);

      await drawWithSeed(lottery, coordinator, seed0, 222n);
      await lottery.payoutWinners();

      expect(await lottery.getCurrentJackpot()).to.equal(
        await lottery.accumulatedJackpot()
      );
    });
  });

  describe("emergencyWithdraw", function () {
    it("never touches funds reserved for winners", async function () {
      const { lottery, coordinator, signers } = await deployFixture();
      const seed0 = 111n;
      const losing = pickLosingNumbers(predictWinningNumbers(seed0));

      for (const player of [signers[1], signers[2], signers[3]]) {
        await lottery.connect(player).participate(losing, { value: TICKET_PRICE });
      }

      await drawWithSeed(lottery, coordinator, seed0, 222n);
      await lottery.payoutWinners();

      const totalPending = await lottery.totalPending();
      await lottery.emergencyWithdraw();

      expect(
        await ethers.provider.getBalance(await lottery.getAddress())
      ).to.equal(totalPending);
    });
  });

  describe("automation", function () {
    it("signals no upkeep before the draw time", async function () {
      const { lottery, signers } = await deployFixture();
      await lottery.connect(signers[1]).participate([1, 2, 3, 4, 5], { value: TICKET_PRICE });

      const [needed] = await lottery.checkUpkeep("0x");
      expect(needed).to.equal(false);
    });

    it("signals the close action once the draw time is reached", async function () {
      const { lottery, signers } = await deployFixture();
      await lottery.connect(signers[1]).participate([1, 2, 3, 4, 5], { value: TICKET_PRICE });

      await increaseTime(DRAW_INTERVAL + 1);

      const [needed, data] = await lottery.checkUpkeep("0x");
      expect(needed).to.equal(true);
      expect(data).to.equal(encodeAction(1));
    });

    it("rejects performUpkeep from an unauthorized caller", async function () {
      const { lottery, signers } = await deployFixture();
      await lottery.connect(signers[1]).participate([1, 2, 3, 4, 5], { value: TICKET_PRICE });
      await increaseTime(DRAW_INTERVAL + 1);

      await expect(
        lottery.connect(signers[2]).performUpkeep(encodeAction(1))
      ).to.be.revertedWith("Not authorized");
    });

    it("rejects the close action before the draw time", async function () {
      const { lottery, signers } = await deployFixture();
      await lottery.connect(signers[1]).participate([1, 2, 3, 4, 5], { value: TICKET_PRICE });

      await expect(lottery.performUpkeep(encodeAction(1))).to.be.revertedWith(
        "Too early"
      );
    });

    it("runs a full round through automation", async function () {
      const { lottery, coordinator, signers } = await deployFixture();
      const seed0 = 111n;
      const losing = pickLosingNumbers(predictWinningNumbers(seed0));

      for (const player of [signers[1], signers[2], signers[3]]) {
        await lottery.connect(player).participate(losing, { value: TICKET_PRICE });
      }

      await increaseTime(DRAW_INTERVAL + 1);

      let [needed, data] = await lottery.checkUpkeep("0x");
      expect(needed).to.equal(true);
      expect(data).to.equal(encodeAction(1));
      await lottery.performUpkeep(data);
      expect(await lottery.phase()).to.equal(1n);

      await fulfillCurrentRequest(lottery, coordinator, seed0, 222n);
      expect(await lottery.phase()).to.equal(2n);

      [needed, data] = await lottery.checkUpkeep("0x");
      expect(data).to.equal(encodeAction(2));
      await lottery.performUpkeep(data);
      expect(await lottery.phase()).to.equal(3n);

      [needed, data] = await lottery.checkUpkeep("0x");
      expect(data).to.equal(encodeAction(3));
      await lottery.performUpkeep(data);
      expect(await lottery.phase()).to.equal(0n);
      expect(await lottery.currentRound()).to.equal(2n);
    });

    it("skips to the next draw time when nobody participated", async function () {
      const { lottery } = await deployFixture();
      await increaseTime(DRAW_INTERVAL + 1);

      const [needed, data] = await lottery.checkUpkeep("0x");
      expect(needed).to.equal(true);
      expect(data).to.equal(encodeAction(4));

      const before = await lottery.nextDrawTime();
      await lottery.performUpkeep(data);
      expect(await lottery.nextDrawTime()).to.be.greaterThan(before);
      expect(await lottery.phase()).to.equal(0n);
    });

    it("lets the owner disable automation", async function () {
      const { lottery, signers } = await deployFixture();
      await lottery.connect(signers[1]).participate([1, 2, 3, 4, 5], { value: TICKET_PRICE });
      await increaseTime(DRAW_INTERVAL + 1);

      await expect(lottery.toggleAutomation(false))
        .to.emit(lottery, "AutomationToggled")
        .withArgs(false);

      const [needed] = await lottery.checkUpkeep("0x");
      expect(needed).to.equal(false);

      await expect(lottery.performUpkeep(encodeAction(1))).to.be.revertedWith(
        "Automation disabled"
      );
    });

    it("authorizes a configured registry to perform upkeep", async function () {
      const { lottery, signers } = await deployFixture();
      const registry = signers[4];

      await expect(
        lottery.setAutomationRegistry(ethers.ZeroAddress)
      ).to.be.revertedWith("No address");

      await expect(lottery.setAutomationRegistry(registry.address))
        .to.emit(lottery, "AutomationRegistrySet")
        .withArgs(registry.address);

      await lottery.connect(signers[1]).participate([1, 2, 3, 4, 5], { value: TICKET_PRICE });
      await increaseTime(DRAW_INTERVAL + 1);

      await lottery.connect(registry).performUpkeep(encodeAction(1));
      expect(await lottery.phase()).to.equal(1n);
    });
  });
});
