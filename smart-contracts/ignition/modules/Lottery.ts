import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

// Chainlink VRF V2.5 Configuration for Sepolia Testnet
const VRF_CONFIG = {
  vrfCoordinator: "0x9DdfaCa8183c41ad55329BdeeD9F6A8d53168B1B",
  keyHash: "0x787d74caea10b2b357790d5b5247c2f63d1d91572a9846f780606e4d953677ae",
  subscriptionId: 0n, // Update this with your VRF subscription ID
};

export default buildModule("LotteryModule", (m) => {
  // Get parameters (can be overridden during deployment)
  const subscriptionId = m.getParameter("subscriptionId", VRF_CONFIG.subscriptionId);
  const vrfCoordinator = m.getParameter("vrfCoordinator", VRF_CONFIG.vrfCoordinator);
  const keyHash = m.getParameter("keyHash", VRF_CONFIG.keyHash);

  // Deploy Lottery contract
  const lottery = m.contract("Lottery", [
    subscriptionId,
    vrfCoordinator,
    keyHash,
  ]);

  return { lottery };
});
