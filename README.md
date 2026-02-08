# Blockchain lottery

Blockchain projekt koji implementira decentraliziranu lutriju na Ethereum testnetu pomoću pametnih ugovora i oracle-based randomnessa.

## Tech Stack

- Solidity (Ethereum testnet)
- React + ethers.js + Vite
- Hardhar + ethers.js
- Randomness Oracle (Chainlink VRF)
- Node.js (backend analitika)

## Struktura projekta

```md
.
├── backend/
├── docs/
├── frontend/
└── smart-contracts/
```

## Kako pokrenuti?

### Frontend

- `cd frontend`
- `npm ci`
- `npm run dev`

### Backend

- `cd backend`
- `npm ci`
- `npm run start`

### Lokalni blockchain

- `cd smart-contracts`
- `npx hardhat node`

## Docs

- [/docs/whitepaper.md](/docs/whitepaper.md)
