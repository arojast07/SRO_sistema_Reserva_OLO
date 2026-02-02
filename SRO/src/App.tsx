import { BrowserRouter } from "react-router-dom";
import { AppRoutes } from "./router";
import { I18nextProvider } from "react-i18next";
import i18n from "./i18n";
import { AuthProvider } from "./contexts/AuthContext";
import { useLocation } from "react-router-dom";
import Sidebar from "./components/feature/Sidebar";
import Navbar from "./components/feature/Navbar";
import { ErrorBoundary } from "./components/ErrorBoundary";

function AppContent() {
  const location = useLocation();
  const isLoginPage = location.pathname === '/login';
  const isAccessPendingPage = location.pathname === '/access-pending';

  return (
    <div className="flex min-h-screen bg-gray-50">
      {!isLoginPage && !isAccessPendingPage && <Sidebar />}
      <main className="flex-1 overflow-auto">
        {!isLoginPage && !isAccessPendingPage && <Navbar />}
        <AppRoutes />
      </main>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <I18nextProvider i18n={i18n}>
          <BrowserRouter basename={__BASE_PATH__}>
            <AppContent />
          </BrowserRouter>
        </I18nextProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
