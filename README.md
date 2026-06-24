# Blockchain lottery

Blockchain projekt koji implementira decentraliziranu lutriju na Ethereum testnetu pomoću pametnih ugovora i oracle-based randomnessa.

## Tech Stack

- Solidity (Ethereum testnet)
- React + ethers.js + Vite
- Hardhat + ethers.js
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

### Backend (u drugoj sesiji terminala)

- `cd backend`
- `npm ci`
- `npm run start`

### Lokalni blockchain (u trećoj sesiji terminala)

- `cd ../smart-contracts`
- `npm run node`

### Deploy lokalnog pametnog ugovora (u četvrtoj sesiji terminala)

- `cd smart-contracts`
- `npm run deploy:local`

### Lokalna simulacija Chainlink VRF-a i automatizacije (u istoj sesiji terminala kao i deploy)

- `cd smart-contracts`
- `npm run keeper`

## Docs

- [/docs/whitepaper.md](/docs/whitepaper.md)
