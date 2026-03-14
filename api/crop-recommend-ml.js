// Vercel Serverless Function: ML-Based Crop Recommendation
// Uses pre-computed ML model predictions from ml-crop-data.json

import { readFileSync } from "fs";
import { join } from "path";

// ─── Load ML prediction data ───────────────────────────────────────
let ML_DATA = null;

function loadMLData() {
  if (ML_DATA) return ML_DATA;
  try {
    const filePath = join(process.cwd(), "api", "ml-crop-data.json");
    const raw = readFileSync(filePath, "utf-8");
    ML_DATA = JSON.parse(raw);
    return ML_DATA;
  } catch (err) {
    console.error("Failed to load ML data:", err.message);
    return null;
  }
}

// ─── City → State mapping ──────────────────────────────────────────
const CITY_TO_STATE = {
  mumbai: "maharashtra",
  delhi: "delhi",
  bangalore: "karnataka",
  bengaluru: "karnataka",
  hyderabad: "telangana",
  ahmedabad: "gujarat",
  chennai: "tamil nadu",
  kolkata: "west bengal",
  pune: "maharashtra",
  jaipur: "rajasthan",
  lucknow: "uttar pradesh",
  kanpur: "uttar pradesh",
  nagpur: "maharashtra",
  indore: "madhya pradesh",
  bhopal: "madhya pradesh",
  patna: "bihar",
  vadodara: "gujarat",
  ludhiana: "punjab",
  agra: "uttar pradesh",
  faridabad: "haryana",
  varanasi: "uttar pradesh",
  srinagar: "jammu and kashmir",
  amritsar: "punjab",
  ranchi: "jharkhand",
  coimbatore: "tamil nadu",
  madurai: "tamil nadu",
  raipur: "chhattisgarh",
  guwahati: "assam",
  chandigarh: "chandigarh",
  mysore: "karnataka",
  gurgaon: "haryana",
  gurugram: "haryana",
  bhubaneswar: "odisha",
  thiruvananthapuram: "kerala",
  kochi: "kerala",
  mangalore: "karnataka",
  noida: "uttar pradesh",
  "new delhi": "delhi",
  ajmer: "rajasthan",
  surat: "gujarat",
  nashik: "maharashtra",
  jodhpur: "rajasthan",
  kota: "rajasthan",
  dehradun: "uttarakhand",
  shimla: "himachal pradesh",
  manali: "himachal pradesh",
  dharamshala: "himachal pradesh",
  jammu: "jammu and kashmir",
  panaji: "goa",
  goa: "goa",
  visakhapatnam: "andhra pradesh",
  vijayawada: "andhra pradesh",
  warangal: "telangana",
  karnal: "haryana",
  rohtak: "haryana",
  hisar: "haryana",
  panipat: "haryana",
  ambala: "haryana",
  mathura: "uttar pradesh",
  allahabad: "uttar pradesh",
  prayagraj: "uttar pradesh",
  gorakhpur: "uttar pradesh",
  bareilly: "uttar pradesh",
  meerut: "uttar pradesh",
  ghaziabad: "uttar pradesh",
  muzaffarpur: "bihar",
  gaya: "bihar",
  bhagalpur: "bihar",
  aurangabad: "maharashtra",
  solapur: "maharashtra",
  kolhapur: "maharashtra",
  sangli: "maharashtra",
  satara: "maharashtra",
  nanded: "maharashtra",
  rajkot: "gujarat",
  bhavnagar: "gujarat",
  jamnagar: "gujarat",
  junagadh: "gujarat",
  jabalpur: "madhya pradesh",
  gwalior: "madhya pradesh",
  ujjain: "madhya pradesh",
  udaipur: "rajasthan",
  bikaner: "rajasthan",
  alwar: "rajasthan",
  bhilwara: "rajasthan",
  salem: "tamil nadu",
  tirupur: "tamil nadu",
  erode: "tamil nadu",
  vellore: "tamil nadu",
  tiruchirappalli: "tamil nadu",
  thanjavur: "tamil nadu",
  thoothukudi: "tamil nadu",
  tirunelveli: "tamil nadu",
  hubli: "karnataka",
  belgaum: "karnataka",
  bellary: "karnataka",
  davangere: "karnataka",
  gulbarga: "karnataka",
  shimoga: "karnataka",
  kozhikode: "kerala",
  thrissur: "kerala",
  kollam: "kerala",
  palakkad: "kerala",
  malappuram: "kerala",
  cuttack: "odisha",
  sambalpur: "odisha",
  rourkela: "odisha",
  berhampur: "odisha",
  bilaspur: "chhattisgarh",
  durg: "chhattisgarh",
  korba: "chhattisgarh",
  dibrugarh: "assam",
  silchar: "assam",
  jorhat: "assam",
  tezpur: "assam",
  jamshedpur: "jharkhand",
  dhanbad: "jharkhand",
  bokaro: "jharkhand",
  hazaribagh: "jharkhand",
};

// ─── Weather fetching from Open-Meteo (free, no API key) ───────────
async function geocode(city) {
  const res = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=5&language=en&format=json`
  );
  const data = await res.json();
  const results = data.results || [];
  if (!results.length) return null;
  
  // Prefer Indian results
  const indiaResults = results.filter(
    (r) => (r.country_code || "").toUpperCase() === "IN"
  );
  const match = indiaResults.length ? indiaResults[0] : results[0];
  return { lat: match.latitude, lon: match.longitude };
}

async function getWeather(lat, lon) {
  const res = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,rain&daily=precipitation_sum&timezone=Asia/Kolkata&forecast_days=30`
  );
  const data = await res.json();
  const current = data.current || {};
  const daily = data.daily || {};
  
  const temp = current.temperature_2m || 25;
  const humidity = current.relative_humidity_2m || 60;
  const precipList = daily.precipitation_sum || [];
  const rainfall = precipList.reduce((a, b) => a + b, 0) || 100;

  return { temp: Math.round(temp * 10) / 10, humidity, rainfall: Math.round(rainfall * 10) / 10 };
}

// ─── Temperature band classifier ──────────────────────────────────
function getTempBand(temp) {
  const bands = [
    { label: "cold", temp: 15 },
    { label: "cool_dry", temp: 18 },
    { label: "mild", temp: 22 },
    { label: "warm", temp: 28 },
    { label: "hot_humid", temp: 32 },
    { label: "hot", temp: 35 },
  ];
  let closest = bands[0];
  let minDiff = Math.abs(temp - bands[0].temp);
  for (const band of bands) {
    const diff = Math.abs(temp - band.temp);
    if (diff < minDiff) {
      minDiff = diff;
      closest = band;
    }
  }
  return closest.label;
}

// ─── Resolve state from city ──────────────────────────────────────
function resolveState(city) {
  const lower = city.toLowerCase().trim();
  
  // Direct lookup
  if (CITY_TO_STATE[lower]) return CITY_TO_STATE[lower];
  
  // Check if city name contains a known state
  const mlData = loadMLData();
  if (mlData && mlData.soil_data) {
    for (const state of Object.keys(mlData.soil_data)) {
      if (lower.includes(state) || state.includes(lower)) return state;
    }
  }
  
  // Check if city contains a known city key
  for (const [cityKey, stateVal] of Object.entries(CITY_TO_STATE)) {
    if (lower.includes(cityKey) || cityKey.includes(lower)) return stateVal;
  }
  
  return null;
}

// ─── Map crop_type from website to ML crop_category ────────────────
function mapCropType(cropType) {
  const mapping = {
    vegetables: "vegetables",
    fruits: "fruits",
    grains: "grains",
    pulses: "pulses",
    spices: "commercial",
    flowers: "other",
    oilseeds: "oilseeds",
    commercial: "commercial",
  };
  return mapping[(cropType || "vegetables").toLowerCase()] || "other";
}

// ─── Adjust confidence → suitability with weather relevance ────────
function adjustSuitability(baseSuitability, actualTemp, bandTemp) {
  const tempDiff = Math.abs(actualTemp - bandTemp);
  const penalty = Math.min(15, Math.round(tempDiff * 1.5));
  return Math.max(40, baseSuitability - penalty);
}

const BAND_TEMPS = {
  cold: 15,
  cool_dry: 18,
  mild: 22,
  warm: 28,
  hot_humid: 32,
  hot: 35,
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  try {
    const {
      location,
      farm_size,
      farm_size_unit = "acre",
      last_crop = "None",
      crop_type = "Vegetables",
    } = req.body;

    if (!location || !farm_size) {
      return res.status(400).json({ error: "Missing location or farm_size" });
    }

    // Load ML data
    const mlData = loadMLData();
    if (!mlData) {
      return res.status(500).json({ error: "ML model data not available" });
    }

    // Resolve state
    let state = resolveState(location);
    
    // If state not found, try geocoding and finding nearest state
    let weatherData = null;
    const coords = await geocode(location);
    
    if (coords) {
      weatherData = await getWeather(coords.lat, coords.lon);
    } else {
      weatherData = { temp: 28, humidity: 65, rainfall: 100 };
    }

    // If we still don't have a state, use "uttar pradesh" as default (most populated)
    if (!state) {
      state = "uttar pradesh";
    }

    // Map crop type to ML category
    const category = mapCropType(crop_type);
    
    // Get temperature band
    const band = getTempBand(weatherData.temp);

    // Look up predictions
    const statePredictions = mlData.predictions[state];
    if (!statePredictions) {
      return res.status(400).json({ 
        error: `No ML data available for state: ${state}. Try a different location.` 
      });
    }

    const categoryPredictions = statePredictions[category];
    if (!categoryPredictions) {
      return res.status(400).json({ 
        error: `No ML data for category: ${category} in ${state}.` 
      });
    }

    let crops = categoryPredictions[band];
    if (!crops || !crops.length) {
      // Fall back to "warm" band
      crops = categoryPredictions["warm"] || categoryPredictions["mild"] || [];
    }

    if (!crops.length) {
      return res.status(400).json({ 
        error: "No ML predictions available for this combination." 
      });
    }

    // Adjust suitability based on actual weather vs band weather
    const bandTemp = BAND_TEMPS[band] || 28;
    crops = crops.map((crop) => ({
      ...crop,
      suitability: adjustSuitability(crop.suitability, weatherData.temp, bandTemp),
    }));

    return res.status(200).json({
      crops,
      source: "ml_model",
      model_info: mlData.model_info,
      weather: weatherData,
      state_used: state,
      category_used: category,
      temp_band: band,
    });
  } catch (err) {
    console.error("crop-recommend-ml error:", err);
    return res.status(500).json({ error: err.message });
  }
}
