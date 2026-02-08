import { NavLink, Link } from "react-router"
import { useWeb3Context } from "../providers/Web3ContextProvider"

export function LayoutPage({children}: {children: React.ReactNode}) {
  const { connectWallet, wallet } = useWeb3Context();

  return (
    <>
      <header className="header">
        <Link to='/' className="hero-link">
          <img src="/logo.svg" alt="" />
          <h1 className="app-name">Blockchain lottery</h1>
        </Link>
        <nav className="nav">
          <NavLink to="/" className={({isActive}) => isActive ? 'link active-link' : 'link'}>Home</NavLink>
          <NavLink to="/history" className={({isActive}) => isActive ? 'link active-link' : 'link'}>History</NavLink>
          {!wallet && <button className='connect-button' onClick={connectWallet}>Connect wallet</button>}
          {wallet && <p className="wallet-address">{wallet.substring(0, 6)}...{wallet.substring(wallet.length - 4)}</p>}
        </nav>
      </header>
      <main className="main">
        {children}
      </main>
      <footer className="footer">
        <p>Copyright &copy; 2026</p>
      </footer>
    </>
  )
}
