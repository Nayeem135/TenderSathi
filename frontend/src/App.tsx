// App decides which page to show for each URL.
// <Routes> looks at the address bar and shows the first <Route> that matches.
import { Navigate, Route, Routes } from "react-router-dom";

import { ProtectedRoute } from "./auth";
import Layout from "./components/Layout";
import LoginPage from "./pages/LoginPage";
import ProfilePage from "./pages/ProfilePage";
import RegisterPage from "./pages/RegisterPage";
import ReportPage from "./pages/ReportPage";
import TendersPage from "./pages/TendersPage";

export default function App() {
  return (
    <Routes>
      {/* Pages anyone can open. */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Pages that need a login. ProtectedRoute sends visitors without a
          token to /login. Layout adds the navigation bar around each page. */}
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/tenders" element={<TendersPage />} />
          {/* :tenderId is a placeholder; /tenders/7/report shows tender 7. */}
          <Route path="/tenders/:tenderId/report" element={<ReportPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Route>
      </Route>

      {/* Any other address, including "/", goes to the tenders page. */}
      <Route path="*" element={<Navigate to="/tenders" replace />} />
    </Routes>
  );
}
