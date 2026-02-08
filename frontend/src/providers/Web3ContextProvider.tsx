import { createContext, useCallback, useContext, useEffect, useState } from "react";

interface Web3ContextType {
  wallet: string | null;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  chainId: string | null;
  isMetaMaskInstalled: boolean;
}

const initialContext: Web3ContextType = {
  wallet: null,
  connectWallet: async () => {},
  disconnectWallet: () => {},
  chainId: null,
  isMetaMaskInstalled: false
};

export const Web3Context = createContext<Web3ContextType>(initialContext);

export const useWeb3Context = () => useContext(Web3Context);

const getMetaMaskProvider = () => {
  if ((window.ethereum as any)?.providers && Array.isArray((window.ethereum as any).providers)) {
    const metaMaskProvider = (window.ethereum as any).providers.find(
      (provider: any) => provider.isMetaMask && !provider.isBraveWallet
    );
    if (metaMaskProvider) {
      return metaMaskProvider;
    }
    console.log('MetaMask not found in providers array');
    return null;
  }

  if (window.ethereum) {
    const eth = window.ethereum as any;
    if (eth.isMetaMask && !eth.isBraveWallet) {
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

  const disconnectWallet = useCallback(() => {
    setWallet(null);
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

  const contextValue: Web3ContextType = {
    wallet,
    connectWallet,
    disconnectWallet,
    chainId,
    isMetaMaskInstalled,
  };

  return <Web3Context.Provider value={contextValue}>{children}</Web3Context.Provider>;
};
