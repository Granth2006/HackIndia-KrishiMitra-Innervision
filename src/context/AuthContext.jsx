import { createContext, useContext, useState, useEffect } from "react";
import { upsertUser, getUserByEmail, updateUserProfile } from "../lib/supabase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hasDevice, setHasDevice] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("krishimitra_user");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setUser(parsed);

        // If Google user, sync from Supabase to get latest dbId
        if (parsed.email && !parsed.isGuest) {
          getUserByEmail(parsed.email).then(({ user: dbUser }) => {
            if (dbUser) {
              const synced = {
                ...parsed,
                dbId: dbUser.id,
                location: dbUser.location || parsed.location,
              };
              setUser(synced);
              localStorage.setItem("krishimitra_user", JSON.stringify(synced));
            }
          });
        }
      } catch {
        /* ignore */
      }
    }
    const deviceFlag = localStorage.getItem("krishimitra_hasDevice");
    if (deviceFlag === "true") setHasDevice(true);
    setLoading(false);
  }, []);

  const toggleDevice = async (val) => {
    setHasDevice(val);
    localStorage.setItem("krishimitra_hasDevice", val ? "true" : "false");
    // Sync to Supabase
    if (user?.dbId) {
      await updateUserProfile(user.dbId, { has_device: val });
    }
  };

  const login = async (userData) => {
    // Save to localStorage first (instant feedback)
    localStorage.setItem("krishimitra_user", JSON.stringify(userData));
    setUser(userData);

    // Upsert to Supabase
    if (userData.email) {
      try {
        const { user: dbUser } = await upsertUser({
          email: userData.email,
          name: userData.name,
          picture: userData.picture,
          location: userData.location || null,
        });
        if (dbUser) {
          const enriched = {
            ...userData,
            dbId: dbUser.id,
            location: dbUser.location || userData.location,
          };
          setUser(enriched);
          localStorage.setItem("krishimitra_user", JSON.stringify(enriched));
        }
      } catch (e) {
        console.error("Supabase upsert failed:", e);
      }
    }
  };

  const loginAsGuest = () => {
    const guest = { name: "Guest", email: "", isGuest: true };
    localStorage.setItem("krishimitra_user", JSON.stringify(guest));
    setUser(guest);
  };

  const logout = () => {
    localStorage.removeItem("krishimitra_user");
    setUser(null);
  };

  const updateUser = async (updates) => {
    const updated = { ...user, ...updates };
    localStorage.setItem("krishimitra_user", JSON.stringify(updated));
    setUser(updated);

    // Sync to Supabase
    if (user?.dbId) {
      const dbUpdates = {};
      if (updates.name) dbUpdates.name = updates.name;
      if (updates.location) dbUpdates.location = updates.location;
      if (updates.picture) dbUpdates.picture = updates.picture;
      if (Object.keys(dbUpdates).length > 0) {
        await updateUserProfile(user.dbId, dbUpdates);
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        loginAsGuest,
        logout,
        updateUser,
        hasDevice,
        toggleDevice,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
