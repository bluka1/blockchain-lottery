/**
 * setAutomationRegistry helper
 *
 * Čemu služi:
 *   Poziva `setAutomationRegistry(forwarder)` na Lottery contractu. Time se postavlja
 *   adresa koja (uz ownera) smije zvati `performUpkeep` — vidi `onlyAutomation` modifier.
 *
 * Zašto se trenutno NE koristi:
 *   Životni ciklus pokreće naš vlastiti keeper (backend/src/services/keeper.js) koji
 *   koristi OWNER račun. Owner je u `onlyAutomation` ionako dopušten, pa autorizacija
 *   dodatne adrese nije potrebna. (Klasični Chainlink Automation, za koji je ovo prvotno
 *   bilo namijenjeno, ugašen je na testnetima.)
 *
 * Kad će se POTENCIJALNO koristiti i za što:
 *   1. Migracija na pravu automation infrastrukturu (npr. Chainlink CRE receiver ili neki
 *      relayer/forwarder) — autorizira se njihova adresa.
 *   2. Sigurnosni pattern: keeper se vrti s ODVOJENIM računom (ne owner ključem). Tada se
 *      keeper adresa autorizira ovom skriptom, pa keeper ključ može samo `performUpkeep`,
 *      a owner ključ ostaje "hladan".
 *      Napomena: `cancelStuckVRFRequest()` je `onlyOwner` (ne `onlyAutomation`), pa bi za
 *      potpunu funkcionalnost odvojenog keepera tu funkciju trebalo relaksirati na `onlyAutomation`.
 *
 * Korištenje:
 *   Postaviti LOTTERY_ADDRESS i AUTOMATION_FORWARDER u .env, pa pokrenuti:
 *     npm run set-registry:sepolia
 */
import 'dotenv/config';
import { network } from 'hardhat';

function requireEnv(name: string): string {
	const value = process.env[name];
	if (!value) {
		throw new Error(`Missing required environment variable: ${name}`);
	}
	return value;
}

async function main() {
	const { ethers } = await network.connect();

	const lotteryAddress = requireEnv('LOTTERY_ADDRESS');
	const forwarder = requireEnv('AUTOMATION_FORWARDER');

	const [signer] = await ethers.getSigners();
	console.log('Signer:', signer.address);
	console.log('Lottery:', lotteryAddress);
	console.log('Forwarder:', forwarder);

	const lottery = await ethers.getContractAt('Lottery', lotteryAddress);

	const owner = await lottery.owner();
	if (owner.toLowerCase() !== signer.address.toLowerCase()) {
		throw new Error(`Signer is not the contract owner (owner=${owner})`);
	}

	const tx = await lottery.setAutomationRegistry(forwarder);
	console.log('setAutomationRegistry tx:', tx.hash);
	await tx.wait();

	const stored = await lottery.automationRegistry();
	console.log('automationRegistry now:', stored);
	console.log(
		stored.toLowerCase() === forwarder.toLowerCase() ? 'OK' : 'MISMATCH',
	);
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});
