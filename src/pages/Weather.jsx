import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import {
  logService,
  hasGuestUsedService,
  markGuestServiceUsed,
} from "../lib/supabase";
import { useBlockchain } from "../context/BlockchainContext";
import "./Weather.css";

const API_KEY = "8371e0a55f78972661743dbb15d9ae17";

const iconMap = {
  Clear: "fa-sun",
  Clouds: "fa-cloud",
  Rain: "fa-cloud-rain",
  Drizzle: "fa-cloud-rain",
  Thunderstorm: "fa-bolt",
  Snow: "fa-snowflake",
  Mist: "fa-smog",
  Fog: "fa-smog",
  Haze: "fa-smog",
};

export default function Weather() {
  const { user } = useAuth();
  const blockchain = useBlockchain();
  const [current, setCurrent] = useState(null);
  const [forecast, setForecast] = useState([]);
  const [city, setCity] = useState("");
  const [searchCity, setSearchCity] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchWeather = async (q, isManualSearch = false) => {
    // Guest limit check (localStorage) — only on manual searches
    if (isManualSearch && user?.isGuest && hasGuestUsedService("weather")) {
      setError(
        "Guest users can only use each service once. Please sign in with Google to continue.",
      );
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const curRes = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?q=${q}&appid=${API_KEY}&units=metric`,
      );
      if (!curRes.ok) throw new Error("City not found");
      const curData = await curRes.json();
      setCurrent(curData);
      setCity(curData.name);

      const fcRes = await fetch(
        `https://api.openweathermap.org/data/2.5/forecast?q=${q}&appid=${API_KEY}&units=metric`,
      );
      if (fcRes.ok) {
        const fcData = await fcRes.json();
        const daily = {};
        fcData.list.forEach((item) => {
          const date = item.dt_txt.split(" ")[0];
          const hour = item.dt_txt.split(" ")[1].split(":")[0];
          if (hour === "12") daily[date] = item;
        });
        setForecast(Object.values(daily).slice(0, 5));
      }

      // Log to Supabase
      const userId = user?.dbId || null;
      if (userId) {
        logService(userId, "weather", { city: q }, null);
        // Blockchain: record on-chain + award tokens (manual search only)
        if (isManualSearch && blockchain) {
          blockchain.addRecord("weather", { city: q, temp: curData.main?.temp, condition: curData.weather?.[0]?.main });
          blockchain.awardTokens(3, "weather_check");
        }
      } else if (isManualSearch && user?.isGuest) {
        markGuestServiceUsed("weather");
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("krishimitra_user") || "{}");
    const c = stored.city || "Faridabad";
    setSearchCity(c);
    fetchWeather(c);
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchCity.trim()) fetchWeather(searchCity.trim(), true);
  };

  return (
    <div className="page-container weather-container">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="page-header"
      >
        <div className="page-title">
          <i className="fas fa-cloud-sun"></i>
          <h1>Weather Forecast</h1>
        </div>
        <p className="page-desc">
          Real-time weather data for your farm location
        </p>
      </motion.div>

      <form className="weather-search" onSubmit={handleSearch}>
        <input
          value={searchCity}
          onChange={(e) => setSearchCity(e.target.value)}
          placeholder="Search city..."
        />
        <button type="submit">
          <i className="fas fa-search"></i>
        </button>
      </form>

      {error && (
        <div className="error-msg" style={{ margin: "1rem 0" }}>
          <i className="fas fa-exclamation-triangle"></i> {error}
        </div>
      )}

      {loading ? (
        <div className="weather-loading">
          <i className="fas fa-spinner fa-spin"></i> Loading weather...
        </div>
      ) : (
        current && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="weather-current card">
              <div className="weather-main">
                <div className="weather-icon-large">
                  <i
                    className={`fas ${iconMap[current.weather[0].main] || "fa-cloud"}`}
                  ></i>
                </div>
                <div className="weather-temp">
                  {Math.round(current.main.temp)}°C
                </div>
                <div className="weather-condition">
                  {current.weather[0].description}
                </div>
                <div className="weather-location">
                  <i className="fas fa-map-marker-alt"></i> {current.name},{" "}
                  {current.sys.country}
                </div>
              </div>
              <div className="weather-details">
                <div className="weather-detail">
                  <i className="fas fa-tint"></i>
                  <span>Humidity</span>
                  <strong>{current.main.humidity}%</strong>
                </div>
                <div className="weather-detail">
                  <i className="fas fa-wind"></i>
                  <span>Wind</span>
                  <strong>{Math.round(current.wind.speed * 3.6)} km/h</strong>
                </div>
                <div className="weather-detail">
                  <i className="fas fa-cloud-rain"></i>
                  <span>Rain</span>
                  <strong>
                    {current.rain ? `${current.rain["1h"] || 0} mm` : "0 mm"}
                  </strong>
                </div>
                <div className="weather-detail">
                  <i className="fas fa-eye"></i>
                  <span>Visibility</span>
                  <strong>{(current.visibility / 1000).toFixed(1)} km</strong>
                </div>
                <div className="weather-detail">
                  <i className="fas fa-compress-arrows-alt"></i>
                  <span>Pressure</span>
                  <strong>{current.main.pressure} hPa</strong>
                </div>
                <div className="weather-detail">
                  <i className="fas fa-temperature-low"></i>
                  <span>Feels Like</span>
                  <strong>{Math.round(current.main.feels_like)}°C</strong>
                </div>
              </div>
            </div>

            {forecast.length > 0 && (
              <div className="forecast-section">
                <h2>5-Day Forecast</h2>
                <div className="forecast-grid">
                  {forecast.map((day, i) => (
                    <motion.div
                      key={i}
                      className="forecast-card card"
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.08 }}
                    >
                      <div className="forecast-day">
                        {new Date(day.dt_txt).toLocaleDateString("en-US", {
                          weekday: "short",
                        })}
                      </div>
                      <i
                        className={`fas ${iconMap[day.weather[0].main] || "fa-cloud"} forecast-icon`}
                      ></i>
                      <div className="forecast-temp">
                        {Math.round(day.main.temp)}°C
                      </div>
                      <div className="forecast-desc">
                        {day.weather[0].description}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )
      )}
    </div>
  );
}
