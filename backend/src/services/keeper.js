require('dotenv').config();

const { ethers } = require('ethers');

const RPC_URL = process.env.RPC_URL || process.env.SEPOLIA_RPC_URL || '';
const CONTRACT_ADDRESS = process.env.LOTTERY_CONTRACT_ADDRESS || '';
const PRIVATE_KEY = process.env.KEEPER_PRIVATE_KEY || '';
const POLL_INTERVAL_MS = Number(process.env.KEEPER_POLL_MS || 15000);
const VERBOSE =
	(process.env.KEEPER_VERBOSE || 'true').toLowerCase() !== 'false';

const PHASE_CLOSED = 1;

const CONTRACT_ABI = [
	'function checkUpkeep(bytes calldata checkData) view returns (bool upkeepNeeded, bytes memory performData)',
	'function performUpkeep(bytes calldata performData)',
	'function cancelStuckVRFRequest()',
	'function owner() view returns (address)',
	'function phase() view returns (uint8)',
	'function currentRound() view returns (uint256)',
	'function participantsCount() view returns (uint256)',
	'function nextDrawTime() view returns (uint256)',
	'function vrfRequestPending() view returns (bool)',
	'function vrfRequestTimestamp() view returns (uint256)',
	'function VRF_TIMEOUT() view returns (uint256)',
];

const PHASE_LABELS = ['Open', 'Closed', 'Drawn', 'Paid'];

const ACTION_LABELS = {
	1: 'close round + request VRF',
	2: 'payout winners',
	3: 'start new round',
	4: 'skip empty round',
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const stamp = () => new Date().toISOString().slice(11, 19);

class Keeper {
	constructor() {
		if (!RPC_URL) {
			throw new Error('RPC_URL (or SEPOLIA_RPC_URL) not set');
		}
		if (!CONTRACT_ADDRESS) {
			throw new Error('LOTTERY_CONTRACT_ADDRESS not set');
		}
		if (!PRIVATE_KEY) {
			throw new Error('KEEPER_PRIVATE_KEY not set');
		}

		this.provider = new ethers.JsonRpcProvider(RPC_URL);
		this.wallet = new ethers.Wallet(PRIVATE_KEY, this.provider);
		this.contract = new ethers.Contract(
			CONTRACT_ADDRESS,
			CONTRACT_ABI,
			this.wallet,
		);
		this.vrfTimeout = 0n;
	}

	async assertOwner() {
		const owner = await this.contract.owner();
		if (owner.toLowerCase() !== this.wallet.address.toLowerCase()) {
			throw new Error(
				`Keeper account ${this.wallet.address} is not the contract owner (${owner})`,
			);
		}
	}

	async readState() {
		const [phase, round, players, nextDrawTime, vrfPending, vrfTimestamp] =
			await Promise.all([
				this.contract.phase(),
				this.contract.currentRound(),
				this.contract.participantsCount(),
				this.contract.nextDrawTime(),
				this.contract.vrfRequestPending(),
				this.contract.vrfRequestTimestamp(),
			]);

		return {
			phase: Number(phase),
			round,
			players,
			nextDrawTime,
			vrfPending,
			vrfTimestamp,
		};
	}

	isVrfStuck(state) {
		if (state.phase !== PHASE_CLOSED || !state.vrfPending) {
			return false;
		}
		const now = BigInt(Math.floor(Date.now() / 1000));
		return now >= state.vrfTimestamp + this.vrfTimeout;
	}

	logHeartbeat(state) {
		const phaseLabel = PHASE_LABELS[state.phase] || 'Unknown';
		const secondsToDraw =
			Number(state.nextDrawTime) - Math.floor(Date.now() / 1000);

		console.log(
			`[${stamp()}] idle | round=${state.round} phase=${phaseLabel} players=${state.players} ` +
				`nextDraw=${secondsToDraw >= 0 ? `${secondsToDraw}s` : `${-secondsToDraw}s ago`} ` +
				`vrfPending=${state.vrfPending}`,
		);
	}

	async cancelStuckVrf() {
		console.log(
			`[${stamp()}] VRF request stuck past timeout -> cancelling and reopening round`,
		);
		const tx = await this.contract.cancelStuckVRFRequest();
		console.log(`[${stamp()}] cancelStuckVRFRequest -> ${tx.hash}`);
		const receipt = await tx.wait();
		console.log(`[${stamp()}]   confirmed in block ${receipt.blockNumber}`);
	}

	async tick() {
		const state = await this.readState();

		if (this.isVrfStuck(state)) {
			await this.cancelStuckVrf();
			return;
		}

		const [needed, performData] = await this.contract.checkUpkeep('0x');

		if (!needed) {
			if (VERBOSE) {
				this.logHeartbeat(state);
			}
			return;
		}

		const action = Number(
			ethers.AbiCoder.defaultAbiCoder().decode(['uint8'], performData)[0],
		);
		const label = ACTION_LABELS[action] || 'unknown';

		const tx = await this.contract.performUpkeep(performData);
		console.log(
			`[${stamp()}] performUpkeep action ${action} (${label}) -> ${tx.hash}`,
		);
		const receipt = await tx.wait();
		console.log(
			`[${stamp()}]   confirmed in block ${receipt.blockNumber} (gas ${receipt.gasUsed})`,
		);
	}

	async start() {
		await this.assertOwner();
		this.vrfTimeout = await this.contract.VRF_TIMEOUT();

		console.log('Keeper watching lottery:', CONTRACT_ADDRESS);
		console.log('Keeper account (owner):', this.wallet.address);
		console.log(
			`Polling every ${POLL_INTERVAL_MS}ms (verbose=${VERBOSE}, vrfTimeout=${this.vrfTimeout}s)`,
		);

		for (;;) {
			try {
				await this.tick();
			} catch (error) {
				console.error(
					`[${stamp()}] Keeper iteration error:`,
					error.shortMessage || error.message || error,
				);
			}
			await sleep(POLL_INTERVAL_MS);
		}
	}
}

new Keeper().start().catch((error) => {
	console.error(error);
	process.exit(1);
});
