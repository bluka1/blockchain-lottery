import 'dotenv/config';
import { network } from 'hardhat';

// according to https://docs.chain.link/vrf/v2.5/quick-start/quick-start-sepolia/
const DEFAULT_SEPOLIA_VRF_COORDINATOR =
	'0x9DdfaCa8183c41ad55329BdeeD9F6A8d53168B1B';
const DEFAULT_SEPOLIA_KEY_HASH =
	'0x787d74caea10b2b357790d5b5247c2f63d1d91572a9846f780606e4d953677ae';

function requireEnv(name: string): string {
	const value = process.env[name];
	if (!value) {
		throw new Error(`Missing required environment variable: ${name}`);
	}
	return value;
}

async function main() {
	const { ethers } = await network.connect();

	const subscriptionId = requireEnv('SEPOLIA_VRF_SUBSCRIPTION_ID');
	const vrfCoordinator =
		process.env.SEPOLIA_VRF_COORDINATOR || DEFAULT_SEPOLIA_VRF_COORDINATOR;
	const keyHash = process.env.SEPOLIA_KEY_HASH || DEFAULT_SEPOLIA_KEY_HASH;
	const automationRegistry = process.env.AUTOMATION_REGISTRY;

	const [deployer] = await ethers.getSigners();
	console.log('Deployer:', deployer.address);
	console.log(
		'Balance:',
		ethers.formatEther(await ethers.provider.getBalance(deployer.address)),
		'ETH',
	);
	console.log('VRF Subscription ID:', subscriptionId);
	console.log('VRF Coordinator:', vrfCoordinator);
	console.log('Key Hash:', keyHash);

	const lottery = await ethers.deployContract('Lottery', [
		subscriptionId,
		vrfCoordinator,
		keyHash,
	]);
	await lottery.waitForDeployment();

	const address = await lottery.getAddress();
	console.log('\nLottery deployed to:', address);

	if (automationRegistry) {
		const tx = await lottery.setAutomationRegistry(automationRegistry);
		await tx.wait();
		console.log('Automation registry set to:', automationRegistry);
	}

	console.log('\nNext steps:');
	console.log('1. Add the contract as a VRF consumer:');
	console.log(`   https://vrf.chain.link/sepolia/${subscriptionId}`);
	console.log(
		'2. Create a Chainlink Automation upkeep (custom logic) targeting:',
		address,
	);
	console.log('   https://automation.chain.link/sepolia');
	if (!automationRegistry) {
		console.log('3. Authorize the upkeep forwarder/registry:');
		console.log(`   lottery.setAutomationRegistry(<forwarderAddress>)`);
		console.log('   (or set AUTOMATION_REGISTRY in .env before deploying)');
	}
	console.log(
		'4. Update frontend contract address in frontend/src/config/contract.ts',
	);
	console.log('5. (Optional) Verify on Etherscan:');
	console.log(
		`   npx hardhat verify --network sepolia ${address} "${subscriptionId}" "${vrfCoordinator}" "${keyHash}"`,
	);
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});
