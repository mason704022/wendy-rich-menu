import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { initLiff } from "./lib/liff";
import { AdminPage } from "./pages/AdminPage";
import { BookingPage } from "./pages/BookingPage";
import { CoursesPage } from "./pages/CoursesPage";
import { MemberPage } from "./pages/MemberPage";
import { PurchasePage } from "./pages/PurchasePage";

function AppRoutes() {
  const location = useLocation();

  return (
    <Routes location={location}>
      <Route path="/courses" element={<CoursesPage />} />
      <Route path="/purchase" element={<PurchasePage />} />
      <Route path="/booking" element={<BookingPage />} />
      <Route path="/member" element={<MemberPage />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/" element={<Navigate to="/courses" replace />} />
      <Route path="*" element={<Navigate to="/courses" replace />} />
    </Routes>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    initLiff()
      .then(() => setReady(true))
      .catch((err) => {
        if (String(err).includes("Redirecting")) return;
        setError(err instanceof Error ? err.message : "LIFF 初始化失敗");
      });
  }, []);

  if (error) {
    return (
      <div className="app-shell">
        <div className="error-box">{error}</div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="app-shell">
        <div className="loading">載入中…</div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </div>
  );
}
