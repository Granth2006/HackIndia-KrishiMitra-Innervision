// Vercel Serverless Function: Crop Recommendation

const GROQ_API_KEY = process.env.GROQ_API_KEY_1;
const WEATHER_API_KEY = process.env.WEATHER_API_KEY;
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "openai/gpt-oss-20b";

const UNIT_CONVERSIONS = { acre: 1.0, bigha: 0.619, yard: 0.0002066 };

const CITY_TO_STATE = {
  mumbai: "maharashtra",
  delhi: "delhi",
  bangalore: "karnataka",
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
};

const SOIL_DATA = {
  "andhra pradesh": {
    ph: 7.2,
    nitrogen: 320,
    phosphorus: 18,
    potassium: 220,
    texture: "Red and Laterite",
  },
  bihar: {
    ph: 7.0,
    nitrogen: 280,
    phosphorus: 10,
    potassium: 160,
    texture: "Alluvial",
  },
  gujarat: {
    ph: 7.9,
    nitrogen: 300,
    phosphorus: 12,
    potassium: 240,
    texture: "Alluvial, Black, Desert",
  },
  haryana: {
    ph: 8.1,
    nitrogen: 280,
    phosphorus: 15,
    potassium: 220,
    texture: "Alluvial and Arid",
  },
  karnataka: {
    ph: 6.8,
    nitrogen: 340,
    phosphorus: 16,
    potassium: 230,
    texture: "Red and Laterite",
  },
  kerala: {
    ph: 5.5,
    nitrogen: 360,
    phosphorus: 12,
    potassium: 200,
    texture: "Laterite",
  },
  "madhya pradesh": {
    ph: 7.2,
    nitrogen: 400,
    phosphorus: 10,
    potassium: 300,
    texture: "Black, Red, Alluvial",
  },
  maharashtra: {
    ph: 7.5,
    nitrogen: 320,
    phosphorus: 14,
    potassium: 220,
    texture: "Black and Red",
  },
  punjab: {
    ph: 8.2,
    nitrogen: 260,
    phosphorus: 25,
    potassium: 200,
    texture: "Alluvial",
  },
  rajasthan: {
    ph: 8.0,
    nitrogen: 280,
    phosphorus: 10,
    potassium: 260,
    texture: "Desert and Alluvial",
  },
  "tamil nadu": {
    ph: 7.0,
    nitrogen: 310,
    phosphorus: 18,
    potassium: 240,
    texture: "Red and Laterite",
  },
  telangana: {
    ph: 7.4,
    nitrogen: 330,
    phosphorus: 16,
    potassium: 230,
    texture: "Black and Red",
  },
  "uttar pradesh": {
    ph: 7.8,
    nitrogen: 250,
    phosphorus: 8,
    potassium: 180,
    texture: "Alluvial",
  },
  "west bengal": {
    ph: 6.9,
    nitrogen: 340,
    phosphorus: 25,
    potassium: 200,
    texture: "Alluvial and Deltaic",
  },
  default: {
    ph: 7.2,
    nitrogen: 320,
    phosphorus: 15,
    potassium: 220,
    texture: "Loamy",
  },
};

async function geocode(city) {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&format=json&limit=1`,
    {
      headers: { "User-Agent": "krishimitraai/2.0" },
    },
  );
  const data = await res.json();
  if (!data.length) throw new Error(`City '${city}' not found`);
  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
}

async function getWeather(lat, lon) {
  const res = await fetch(
    `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${WEATHER_API_KEY}&units=metric`,
  );
  if (!res.ok) throw new Error("Weather fetch failed");
  const d = await res.json();
  return {
    temp: d.main.temp,
    humidity: d.main.humidity,
    weather: d.weather[0].description,
  };
}

function getSoil(city) {
  const lower = city.toLowerCase().trim();
  const state =
    CITY_TO_STATE[lower] ||
    Object.keys(SOIL_DATA).find(
      (k) => k.includes(lower) || lower.includes(k),
    ) ||
    "default";
  return { ...(SOIL_DATA[state] || SOIL_DATA.default), state };
}

function parseCrops(text) {
  const crops = [];
  let current = {};
  for (const line of text.split("\n")) {
    const clean = line.replace(/\*\*?|__|^#+\s*|^[*-]\s*/g, "").trim();
    if (!clean) continue;
    if (/Crop \d+:/i.test(clean)) {
      if (current.name) crops.push(current);
      current = {};
      if (crops.length >= 4) break;
    } else if (clean.includes(":")) {
      const [key, ...rest] = clean.split(":");
      const val = rest.join(":").trim();
      const k = key.trim().toLowerCase().replace(/\s+/g, "_");
      if (k === "name") current.name = val;
      else if (k === "reason") current.season = val;
      else if (k === "expected_yield") current.expectedYield = val;
      else if (k === "water_requirements") current.waterRequirement = val;
      else if (k === "current_market_price") current.profitMargin = val;
      current.suitability = 85;
    }
  }
  if (current.name && crops.length < 4) crops.push(current);
  while (crops.length < 4)
    crops.push({
      name: `Suggested Crop ${crops.length + 1}`,
      season: "N/A",
      expectedYield: "N/A",
      waterRequirement: "N/A",
      profitMargin: "N/A",
      suitability: 50,
    });
  return crops.slice(0, 4);
}

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
    if (!location || !farm_size)
      return res.status(400).json({ error: "Missing location or farm_size" });

    const acres =
      parseFloat(farm_size) *
      (UNIT_CONVERSIONS[farm_size_unit.toLowerCase()] || 1);
    const soil = getSoil(location);
    const { lat, lon } = await geocode(location);
    const weather = await getWeather(lat, lon);

    const prompt = `Recommend exactly 4 field-grown ${crop_type.toLowerCase()} for high profit in ${soil.state.charAt(0).toUpperCase() + soil.state.slice(1)}.
Farm size: ${acres.toFixed(2)} acres, City: ${location}, Last crop: ${last_crop}
Soil: pH=${soil.ph}, N=${soil.nitrogen}, P=${soil.phosphorus}, K=${soil.potassium}, texture=${soil.texture}
Weather: temp=${weather.temp}°C, humidity=${weather.humidity}%, condition=${weather.weather}

Output Format (Plain Text Only):
Crop 1:
Name: [name]
Reason: [reason]
Expected Yield: [tons/acre]
Water Requirements: [mm/season]
Current Market Price: ₹[price]/kg

(Repeat for Crop 2, 3, 4)`;

    const groqRes = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 1600,
      }),
    });

    if (!groqRes.ok) {
      const err = await groqRes.json().catch(() => ({}));
      return res
        .status(500)
        .json({ error: err?.error?.message || "AI service error" });
    }

    const data = await groqRes.json();
    const text = data.choices?.[0]?.message?.content?.trim() || "";
    const crops = parseCrops(text);

    return res.status(200).json({ crops, raw: text });
  } catch (err) {
    console.error("crop-recommend error:", err);
    return res.status(500).json({ error: err.message });
  }
}
