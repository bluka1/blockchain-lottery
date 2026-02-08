import { Route, Routes } from "react-router";
import { HistoryPage } from "./pages/HistoryPage";
import { HomePage } from "./pages/HomePage";
import { LayoutPage } from "./pages/LayoutPage";

function App() {
  return (
    <LayoutPage>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/history" element={<HistoryPage />} />
      </Routes>
    </LayoutPage>
  )
}

export default App
