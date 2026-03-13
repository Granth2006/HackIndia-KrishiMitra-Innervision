import { NavLink } from "react-router-dom";
import "./MobileNav.css";

const navItems = [
  // { path: "/dashboard/sprinkler", icon: "fa-tint", label: "Sprinkler" }, // Hidden
  { path: "/dashboard/disease", icon: "fa-virus", label: "Disease" },
  { path: "/dashboard/crop", icon: "fa-seedling", label: "Crops" },
  { path: "/dashboard/chatbot", icon: "fa-robot", label: "Chat" },
  { path: "/dashboard/weather", icon: "fa-cloud-sun", label: "Weather" },
  { path: "/dashboard/marketplace", icon: "fa-store", label: "Market" },
  {
    path: "/dashboard/sprinkler-dashboard",
    icon: "fa-tachometer-alt",
    label: "Dashboard",
  },
  {
    path: "/dashboard/your-field",
    icon: "fa-map-marked-alt",
    label: "My Field",
  },
  { path: "/dashboard/blockchain", icon: "fa-database", label: "Data" },
  { path: "/dashboard/profile", icon: "fa-user", label: "Profile" },
];

export default function MobileNav() {
  return (
    <nav className="mobile-nav" aria-label="Mobile navigation">
      {navItems.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          className={({ isActive }) =>
            `mobile-nav-item${isActive ? " active" : ""}`
          }
        >
          <i className={`fas ${item.icon}`}></i>
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
