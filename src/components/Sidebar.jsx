import { NavLink, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useBlockchain } from "../context/BlockchainContext";
import logo from "../assets/krishimitra.png";
import "./Sidebar.css";

const navItems = [
  // { path: "/dashboard/sprinkler", icon: "fa-tint", label: "Auto Sprinkler" }, // Hidden from sidebar
  { path: "/dashboard/disease", icon: "fa-virus", label: "Disease Detection" },
  { path: "/dashboard/crop", icon: "fa-seedling", label: "Crop Advisor" },
  { path: "/dashboard/chatbot", icon: "fa-robot", label: "AI Chatbot" },
  { path: "/dashboard/weather", icon: "fa-cloud-sun", label: "Weather" },
  { path: "/dashboard/marketplace", icon: "fa-store", label: "Marketplace" },
  {
    path: "/dashboard/sprinkler-dashboard",
    icon: "fa-tachometer-alt",
    label: "Sprinkler Dashboard",
  },
  {
    path: "/dashboard/your-field",
    icon: "fa-map-marked-alt",
    label: "Your Field",
  },
  {
    path: "/dashboard/blockchain",
    icon: "fa-database",
    label: "Your Data",
  },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const blockchain = useBlockchain();

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <Link to="/">
          <img src={logo} alt="KrishiMitra" className="sidebar-logo" />
          <h2>KrishiMitra AI</h2>
        </Link>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `sidebar-link${isActive ? " active" : ""}`
            }
          >
            <i className={`fas ${item.icon}`}></i>
            <span>{item.label}</span>
            {item.path === "/dashboard/blockchain" && blockchain?.tokenBalance > 0 && (
              <span className="sidebar-token-badge">{blockchain.tokenBalance.toFixed(0)}</span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <NavLink
          to="/dashboard/profile"
          className={({ isActive }) =>
            `sidebar-link${isActive ? " active" : ""}`
          }
        >
          <i className="fas fa-user-circle"></i>
          <span>{user?.name || "Profile"}</span>
        </NavLink>

        <button
          className="sidebar-link theme-btn"
          onClick={toggleTheme}
          aria-label="Toggle theme"
        >
          <i className={`fas ${isDark ? "fa-sun" : "fa-moon"}`}></i>
          <span>{isDark ? "Light Mode" : "Dark Mode"}</span>
        </button>

        <button
          className="sidebar-link logout-btn"
          onClick={logout}
          aria-label="Logout"
        >
          <i className="fas fa-sign-out-alt"></i>
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
