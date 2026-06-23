# Web3 Integration Plan - MetaMask Wallet & Smart Contract Integration

## Context
The blockchain lottery frontend needs Web3 integration to:
1. Connect users' MetaMask wallets (authentication)
2. Switch to Ethereum Sepolia testnet
3. Read lottery data from a smart contract (round info, history, timing)
4. Replace hardcoded data in components with real on-chain data

**Current State:**
- Basic MetaMask detection exists but only checks `braveEthereum` (incomplete)
- No Web3 library installed (only @metamask/providers)
- Components have hardcoded data marked with TODOs
- No state management for wallet/contract data
- Smart contract not yet deployed (will use placeholder address)

**User Preferences:**
- ethers.js v6 for Web3 interactions
- .env file for configuration
- Contract will be deployed later (use placeholder for now)

## Implementation Plan

### 1. Install Dependencies & Setup Configuration

**Files to create:**
- `frontend/.env` - Environment variables for contract address and RPC URL
- `frontend/.env.example` - Template for environment variables

**Install:**
```bash
npm install ethers@^6.13.0
```

**Environment variables:**
```env
VITE_CONTRACT_ADDRESS=0x0000000000000000000000000000000000000000
VITE_SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
VITE_SEPOLIA_CHAIN_ID=11155111
```

### 2. Create Contract ABI Placeholder

**Files to create:**
- `frontend/src/contracts/LotteryABI.ts` - Contract ABI (placeholder structure based on expected functions)

**Expected functions (to be refined when contract is deployed):**
- `getCurrentRound()` - Returns current round ID and status
- `getRoundInfo(roundId)` - Returns round details
- `getNextDrawTime()` - Returns timestamp of next draw
- `getPastRounds(count)` - Returns history of past rounds
- `enterLottery()` - Function for users to participate (write operation)

### 3. Create Web3 Context Provider

**Files to create:**
- `frontend/src/contexts/Web3Context.tsx` - Main Web3 context with wallet connection logic

**Context will provide:**
- `account` - Connected wallet address (null if not connected)
- `isConnected` - Boolean connection status
- `chainId` - Current network chain ID
- `provider` - ethers.js BrowserProvider instance
- `signer` - ethers.js Signer instance
- `connectWallet()` - Function to connect MetaMask
- `disconnectWallet()` - Function to disconnect
- `switchToSepolia()` - Function to switch network
- `isCorrectNetwork` - Boolean for Sepolia check

**Key features:**
- Auto-detect MetaMask (`window.ethereum` or `window.braveEthereum`)
- Handle account changes (MetaMask event listeners)
- Handle network changes (MetaMask event listeners)
- Persist connection state in localStorage
- Auto-reconnect on page load if previously connected

### 4. Create Smart Contract Hook

**Files to create:**
- `frontend/src/hooks/useContract.ts` - Hook for contract interactions
- `frontend/src/hooks/useLotteryData.ts` - Hook for reading lottery-specific data

**useContract hook:**
- Returns contract instance connected to signer/provider
- Handles contract initialization
- Provides read/write methods

**useLotteryData hook:**
- `currentRound` - Current round info (id, status)
- `nextDrawTime` - Timestamp for next draw
- `pastRounds` - Array of historical rounds
- `loading` - Loading state
- `error` - Error state
- Auto-refresh data on network/account changes

### 5. Update Layout Component

**Files to modify:**
- `frontend/src/pages/LayoutPage.tsx`

**Changes:**
- Replace current `handleConnectWallet` with Web3Context's `connectWallet`
- Show connected address (truncated) when wallet is connected
- Show "Connect Wallet" button when disconnected
- Show network warning if not on Sepolia
- Use proper MetaMask detection (both `ethereum` and `braveEthereum`)

### 6. Integrate Context into App

**Files to modify:**
- `frontend/src/App.tsx` or `frontend/src/main.tsx`

**Changes:**
- Wrap app with `Web3Provider`
- Make Web3 context available to all components

### 7. Update Components with Real Data

**Files to modify:**
- `frontend/src/pages/HomePage.tsx` - Use `useLotteryData` for round status
- `frontend/src/components/TimerToNextDraw.tsx` - Use `nextDrawTime` from contract
- `frontend/src/components/HistoryTable.tsx` - Use `pastRounds` from contract
- `frontend/src/components/MostFrequentNumbersCard.tsx` - Calculate from `pastRounds`

**Changes:**
- Remove hardcoded data
- Replace with data from `useLotteryData` hook
- Add loading states
- Add error handling
- Show user-friendly messages when wallet not connected

### 8. Move and Fix TypeScript Declaration

**Files to modify:**
- Move `frontend/types/global.d.ts` to `frontend/src/global.d.ts` (to be included by tsconfig)
- Fix the declaration to work as a module with `export {}`

### 9. Add Network Switching Logic

**Implementation in Web3Context:**
- Detect current network on connection
- Auto-prompt to switch to Sepolia if on wrong network
- Use `wallet_switchEthereumChain` RPC method
- Fallback to `wallet_addEthereumChain` if Sepolia not added to MetaMask

### 10. Error Handling & Edge Cases

**Handle:**
- MetaMask not installed (show helpful error)
- User rejects connection request
- User rejects network switch
- Contract call failures
- Network connection issues
- Wrong network warnings

## Critical Files

**New files:**
- `frontend/src/contexts/Web3Context.tsx` - Core Web3 logic
- `frontend/src/hooks/useContract.ts` - Contract interaction hook
- `frontend/src/hooks/useLotteryData.ts` - Lottery data hook
- `frontend/src/contracts/LotteryABI.ts` - Contract ABI
- `frontend/.env` - Environment config
- `frontend/.env.example` - Environment template

**Modified files:**
- `frontend/src/pages/LayoutPage.tsx` - Connect button integration
- `frontend/src/pages/HomePage.tsx` - Use real round status
- `frontend/src/components/TimerToNextDraw.tsx` - Use real timer data
- `frontend/src/components/HistoryTable.tsx` - Use real history data
- `frontend/src/components/MostFrequentNumbersCard.tsx` - Calculate from real data
- `frontend/src/App.tsx` - Wrap with Web3Provider
- `frontend/src/global.d.ts` - Move and fix types

**Configuration files:**
- `frontend/.gitignore` - Add .env to gitignore if not already present

## Verification Steps

1. **Install dependencies:** Run `npm install` in frontend directory
2. **Type checking:** Run `npm run build` to verify TypeScript compilation
3. **Dev server:** Run `npm run dev` and open browser
4. **Test MetaMask detection:** Check console for MetaMask detection
5. **Test wallet connection:** Click "Connect Wallet" button
6. **Test network switching:** Verify Sepolia switch prompt if on wrong network
7. **Test account display:** Verify connected address shows in header
8. **Test data loading:** Verify components show loading/error states appropriately
9. **Test account change:** Switch accounts in MetaMask, verify app updates
10. **Test network change:** Switch networks in MetaMask, verify app responds

## Notes

- Contract address is placeholder (0x0) until real contract is deployed
- ABI is template structure - will need updating when contract is finalized
- When contract is deployed, only `.env` file needs updating (no code changes)
- All Web3 logic is centralized in context for easy maintenance
- Components remain clean - they just consume hooks for data
