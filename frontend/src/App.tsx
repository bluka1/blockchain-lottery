import { Route, Routes } from "react-router";
import { HistoryPage } from "./pages/HistoryPage";
import { HomePage } from "./pages/HomePage";
import { LayoutPage } from "./pages/LayoutPage";

function App() {
  return (
    <LayoutPage>
      <Routes>
        <Route path="/">
          <Route index element={<HomePage />} />
        </Route>
        <Route path="/history">
          <Route index element={<HistoryPage />} />
        </Route>
      </Routes>
    </LayoutPage>
  )
}

export default App
