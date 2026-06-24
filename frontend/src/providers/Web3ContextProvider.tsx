import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { ethers, BrowserProvider, Contract } from "ethers";
import { CONTRACT_CONFIG, EXPECTED_CHAIN_ID_HEX } from "../config/contract";

interface Web3ContextType {
  wallet: string | null;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  chainId: string | null;
  isCorrectChain: boolean;
  switchToExpectedChain: () => Promise<void>;
  isMetaMaskInstalled: boolean;
  provider: BrowserProvider | null;
  signer: ethers.Signer | null;
  contract: Contract | null;
}

const initialContext: Web3ContextType = {
  wallet: null,
  connectWallet: async () => {},
  disconnectWallet: () => {},
  chainId: null,
  isCorrectChain: false,
  switchToExpectedChain: async () => {},
  isMetaMaskInstalled: false,
  provider: null,
  signer: null,
  contract: null,
};

export const Web3Context = createContext<Web3ContextType>(initialContext);

export const useWeb3Context = () => useContext(Web3Context);

const isRealMetaMask = (provider: any) =>
  !!provider?.isMetaMask &&
  !provider.isBraveWallet &&
  !provider.isPhantom &&
  !provider.isCoinbaseWallet &&
  !provider.isRabby;

const getMetaMaskProvider = () => {
  if ((window.ethereum as any)?.providers && Array.isArray((window.ethereum as any).providers)) {
    const metaMaskProvider = (window.ethereum as any).providers.find(isRealMetaMask);
    if (metaMaskProvider) {
      return metaMaskProvider;
    }
    console.log('MetaMask not found in providers array');
    return null;
  }

  if (window.ethereum) {
    if (isRealMetaMask(window.ethereum)) {
      return window.ethereum;
    }
    console.log('Provider found but it\'s not MetaMask');
    return null;
  }

  console.log('No Ethereum provider found');
  return null;
};

export const Web3ContextProvider = ({ children }: {children: React.ReactNode}) => {
  const [wallet, setWallet] = useState<string | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);
  const [isMetaMaskInstalled, setIsMetaMaskInstalled] = useState(false);
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [contract, setContract] = useState<Contract | null>(null);

  const isCorrectChain = chainId?.toLowerCase() === EXPECTED_CHAIN_ID_HEX.toLowerCase();

  const disconnectWallet = useCallback(() => {
    setWallet(null);
    setProvider(null);
    setSigner(null);
    setContract(null);
  }, []);

  const switchToExpectedChain = useCallback(async () => {
    const provider = getMetaMaskProvider();
    if (!provider) {
      alert("MetaMask is not installed. Please install it first.");
      return;
    }

    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: EXPECTED_CHAIN_ID_HEX }],
      });
    } catch (error: unknown) {
      const code = (error as { code?: number })?.code;
      if (code === 4902) {
        await provider.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: EXPECTED_CHAIN_ID_HEX,
              chainName: CONTRACT_CONFIG.chainName,
              nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
              rpcUrls: [CONTRACT_CONFIG.rpcUrl],
            },
          ],
        });
      } else {
        console.error("Error switching network:", error);
      }
    }
  }, []);

  const connectWallet = useCallback(async () => {
    const provider = getMetaMaskProvider();

    if (!provider) {
      alert('MetaMask is not installed. Please install it first.');
      return;
    }

    try {
      const accounts = await provider.request({
        method: "eth_requestAccounts",
      });

      if (accounts && accounts.length > 0) {
        setWallet(accounts[0]);
      }
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error) {
        if (error.code === 4001) {
          console.log('User rejected the connection request');
        }
      } else {
        console.error('Error connecting wallet:', error);
      }
    }
  }, []);

  // reconnect logic
  useEffect(() => {
    const provider = getMetaMaskProvider();

    if (provider) {
      setIsMetaMaskInstalled(true);

      // get current account without prompting (reconnecting)
      provider.request({ method: 'eth_accounts' })
        .then((accounts: string[]) => {
          if (accounts && accounts.length > 0) {
            setWallet(accounts[0]);
          }
        })
        .catch((error: unknown) => {
          console.error('Error getting accounts:', error);
        });

      // get current network
      provider.request({ method: 'eth_chainId' })
        .then((currentChainId: string) => {
          setChainId(currentChainId);
        })
        .catch((error: unknown) => {
          console.error('Error getting chainId:', error);
        });
    } else {
      setIsMetaMaskInstalled(false);
    }
  }, []);

  // setup event listeners
  useEffect(() => {
    const provider = getMetaMaskProvider();
    if (!provider) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length > 0) {
        setWallet(accounts[0]);
      } else {
        disconnectWallet();
      }
    };

    const handleChainChanged = (newChainId: string) => {
      setChainId(newChainId);
    };

    const handleDisconnect = () => {
      disconnectWallet();
    };

    provider.on("accountsChanged", handleAccountsChanged);
    provider.on("chainChanged", handleChainChanged);
    provider.on("disconnect", handleDisconnect);

    return () => {
      provider.removeListener("accountsChanged", handleAccountsChanged);
      provider.removeListener("chainChanged", handleChainChanged);
      provider.removeListener("disconnect", handleDisconnect);
    };
  }, [disconnectWallet]);

  // initialize provider, signer, and contract when wallet is connected
  useEffect(() => {
    const initializeContract = async () => {
      const metaMaskProvider = getMetaMaskProvider();

      if (!wallet || !metaMaskProvider || !isCorrectChain) {
        setProvider(null);
        setSigner(null);
        setContract(null);
        return;
      }

      try {
        const ethersProvider = new BrowserProvider(metaMaskProvider);
        setProvider(ethersProvider);

        const ethersSigner = await ethersProvider.getSigner();
        setSigner(ethersSigner);

        const lotteryContract = new Contract(
          CONTRACT_CONFIG.address,
          CONTRACT_CONFIG.abi,
          ethersSigner
        );
        setContract(lotteryContract);
      } catch (error) {
        console.error('Error initializing contract:', error);
        setProvider(null);
        setSigner(null);
        setContract(null);
      }
    };

    initializeContract();
  }, [wallet, isCorrectChain]);

  const contextValue: Web3ContextType = {
    wallet,
    connectWallet,
    disconnectWallet,
    chainId,
    isCorrectChain,
    switchToExpectedChain,
    isMetaMaskInstalled,
    provider,
    signer,
    contract,
  };

  return <Web3Context.Provider value={contextValue}>{children}</Web3Context.Provider>;
};
