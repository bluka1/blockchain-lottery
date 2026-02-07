import { NavLink, Link } from "react-router"
export function LayoutPage({children}: {children: React.ReactNode}) {
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
          <button className='connect-button'>Connect wallet</button>
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
