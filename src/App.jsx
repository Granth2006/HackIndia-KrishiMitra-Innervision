import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  Outlet,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { BlockchainProvider } from "./context/BlockchainContext";
import { ThemeProvider } from "./context/ThemeContext";
import { useToast } from "./hooks/useToast";
import ToastContainer from "./components/Toast";
import Sidebar from "./components/Sidebar";
import MobileNav from "./components/MobileNav";
import { DashboardFloatingLanguageButton } from "./components/LanguageSelector";
import BlockchainRewardToast from "./components/BlockchainRewardToast";
import Landing from "./pages/Landing";
import Sprinkler from "./pages/Sprinkler";
import Disease from "./pages/Disease";
import CropRecommendation from "./pages/CropRecommendation";
import Chatbot from "./pages/Chatbot";
import Weather from "./pages/Weather";
import Marketplace from "./pages/Marketplace";
import SprinklerDashboard from "./pages/SprinklerDashboard";
import Profile from "./pages/Profile";
import YourField from "./pages/YourField";
import BlockchainDashboard from "./pages/BlockchainDashboard";
import Admin from "./pages/Admin";
import "./index.css";

function ProtectedRoute() {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="loading-screen">
        <i className="fas fa-spinner fa-spin"></i>
      </div>
    );
  if (!user) return <Navigate to="/" replace />;
  return (
    <div className="dashboard-layout">
      <Sidebar />
      <main className="dashboard-content">
        <Outlet />
      </main>
      <MobileNav />
      <DashboardFloatingLanguageButton />
      <BlockchainRewardToast />
    </div>
  );
}

function AppRoutes() {
  const { toasts, showToast, removeToast } = useToast();

  return (
    <>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/dashboard" element={<ProtectedRoute />}>
          <Route index element={<Navigate to="/dashboard/disease" replace />} />
          <Route path="sprinkler" element={<Sprinkler />} />
          <Route path="disease" element={<Disease />} />
          <Route path="crop" element={<CropRecommendation />} />
          <Route path="chatbot" element={<Chatbot />} />
          <Route path="weather" element={<Weather />} />
          <Route path="marketplace" element={<Marketplace />} />
          <Route path="sprinkler-dashboard" element={<SprinklerDashboard />} />
          <Route path="profile" element={<Profile />} />
          <Route path="your-field" element={<YourField />} />
          <Route path="blockchain" element={<BlockchainDashboard />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </>
  );
}

export default function App() {
  return (
    <Router>
      <ThemeProvider>
        <AuthProvider>
          <BlockchainProvider>
            <AppRoutes />
          </BlockchainProvider>
        </AuthProvider>
      </ThemeProvider>
    </Router>
  );
}
