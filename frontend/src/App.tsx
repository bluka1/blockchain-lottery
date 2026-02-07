import { Route, Routes } from "react-router";
import { LayoutPage } from "./LayoutPage";

function App() {
  return (
    <LayoutPage>
      <Routes>
        <Route path="/">
          <Route index element={<h1>How it works</h1>} />
        </Route>
        <Route path="/history">
          <Route index element={<h1>History</h1>} />
        </Route>
        <Route path="/">
          <Route index element={<h1>Connect wallet</h1>} />
        </Route>
      </Routes>
    </LayoutPage>
  )
}

export default App
