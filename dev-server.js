// Local dev API server — mirrors the Vercel serverless functions
// Run with: node dev-server.js
import express from "express";
import cors from "cors";
import { config } from "dotenv";

config(); // load .env

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

const GROQ_API_KEY = process.env.GROQ_API_KEY_1;
const WEATHER_API_KEY = process.env.WEATHER_API_KEY;
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const TEXT_MODEL = "moonshotai/kimi-k2-instruct";
const VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

// ============ /api/analyze-plant ============
app.post("/api/analyze-plant", async (req, res) => {
  try {
    const { mode, imageBase64, mimeType } = req.body;
    if (!imageBase64)
      return res.status(400).json({ error: "No image provided" });

    const prompt =
      mode === "sprinkler"
        ? `You are an expert agricultural AI assistant. Analyze this plant image and provide a comprehensive irrigation and disease management report. Return your response in the following JSON format ONLY (no markdown, no extra text, no code fences):
{"diseaseName":"name","severity":"Low/Medium/High/None","confidence":"85%","irrigationPlan":{"frequency":"","quantity":"","bestTime":"","method":""},"pesticide":{"type":"","amount":"","applicationMethod":"","frequency":"","safetyPeriod":""},"soilSuggestions":"","additionalTips":["","",""]}`
        : `You are an expert agricultural AI assistant. Analyze this plant image for diseases. Return your response in the following JSON format ONLY (no markdown, no extra text, no code fences):
{"diseaseName":"name","severity":"Low/Medium/High/None","confidence":"85%","symptoms":["",""],"causes":["",""],"treatment":["",""],"prevention":["",""],"additionalTips":["",""]}`;

    const messages = [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          {
            type: "image_url",
            image_url: {
              url: `data:${mimeType || "image/jpeg"};base64,${imageBase64}`,
            },
          },
        ],
      },
    ];

    const groqRes = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: VISION_MODEL,
        messages,
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (!groqRes.ok) {
      const err = await groqRes.json().catch(() => ({}));
      return res.status(500).json({ error: err?.error?.message || "AI error" });
    }
    const data = await groqRes.json();
    const text = data.choices?.[0]?.message?.content?.trim() || "";
    const cleaned = text
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    res.json(JSON.parse(jsonMatch ? jsonMatch[0] : cleaned));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ /api/chat ============
const SYSTEM_PROMPT = `You are KrishiMitra AI, a helpful farming assistant for Indian farmers. Respond concisely in simple language. Focus on crops, soil, weather, pests, irrigation, and sustainable methods. Do not use Markdown formatting. End with a helpful follow-up question.`;

app.post("/api/chat", async (req, res) => {
  try {
    const {
      messages: chatHistory,
      userMessage,
      imageBase64,
      mimeType,
    } = req.body;
    const hasImage = !!imageBase64;
    const model = hasImage ? VISION_MODEL : TEXT_MODEL;

    const messages = [{ role: "system", content: SYSTEM_PROMPT }];
    if (chatHistory && Array.isArray(chatHistory)) {
      chatHistory.slice(-10).forEach((m) => {
        messages.push({
          role: m.role === "user" ? "user" : "assistant",
          content: m.text,
        });
      });
    }

    if (hasImage) {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: userMessage || "Analyze this plant image." },
          {
            type: "image_url",
            image_url: {
              url: `data:${mimeType || "image/jpeg"};base64,${imageBase64}`,
            },
          },
        ],
      });
    } else {
      messages.push({ role: "user", content: userMessage });
    }

    const groqRes = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.7,
        max_tokens: 1200,
      }),
    });

    if (!groqRes.ok) {
      const err = await groqRes.json().catch(() => ({}));
      return res.status(500).json({ error: err?.error?.message || "AI error" });
    }
    const data = await groqRes.json();
    res.json({
      reply: data.choices?.[0]?.message?.content?.trim() || "Sorry, try again.",
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ /api/crop-recommend ============
const UNIT_CONV = { acre: 1.0, bigha: 0.619, yard: 0.0002066 };
const CITY_STATE = {
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
  faridabad: "haryana",
  noida: "uttar pradesh",
};
const SOIL = {
  maharashtra: { ph: 7.5, n: 320, p: 14, k: 220, t: "Black and Red" },
  haryana: { ph: 8.1, n: 280, p: 15, k: 220, t: "Alluvial and Arid" },
  default: { ph: 7.2, n: 320, p: 15, k: 220, t: "Loamy" },
};

app.post("/api/crop-recommend", async (req, res) => {
  try {
    const {
      location,
      farm_size,
      farm_size_unit = "acre",
      last_crop = "None",
      crop_type = "Vegetables",
    } = req.body;
    if (!location || !farm_size)
      return res.status(400).json({ error: "Missing fields" });

    const acres =
      parseFloat(farm_size) * (UNIT_CONV[farm_size_unit.toLowerCase()] || 1);
    const state = CITY_STATE[location.toLowerCase()] || "default";
    const soil = SOIL[state] || SOIL.default;

    // Get weather
    const geoRes = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(location)}&format=json&limit=1`,
      { headers: { "User-Agent": "krishimitraai/2.0" } },
    );
    const geo = await geoRes.json();
    let weather = { temp: 30, humidity: 60, weather: "clear sky" };
    if (geo.length) {
      const wRes = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${geo[0].lat}&lon=${geo[0].lon}&appid=${WEATHER_API_KEY}&units=metric`,
      );
      if (wRes.ok) {
        const w = await wRes.json();
        weather = {
          temp: w.main.temp,
          humidity: w.main.humidity,
          weather: w.weather[0].description,
        };
      }
    }

    const prompt = `Recommend exactly 4 field-grown ${crop_type.toLowerCase()} for high profit in ${state}.\nFarm: ${acres} acres, City: ${location}, Last crop: ${last_crop}\nSoil: pH=${soil.ph}, N=${soil.n}, P=${soil.p}, K=${soil.k}, texture=${soil.t}\nWeather: ${weather.temp}°C, ${weather.humidity}%, ${weather.weather}\n\nOutput:\nCrop 1:\nName: [name]\nReason: [reason]\nExpected Yield: [tons/acre]\nWater Requirements: [mm/season]\nCurrent Market Price: ₹[price]/kg\n\n(Repeat for Crop 2, 3, 4)`;

    const groqRes = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: TEXT_MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 1600,
      }),
    });

    if (!groqRes.ok) {
      const err = await groqRes.json().catch(() => ({}));
      return res.status(500).json({ error: err?.error?.message || "AI error" });
    }
    const data = await groqRes.json();
    const text = data.choices?.[0]?.message?.content?.trim() || "";

    // Parse crops
    const crops = [];
    let cur = {};
    for (const line of text.split("\n")) {
      const c = line.replace(/\*\*?|__|^#+\s*|^[*-]\s*/g, "").trim();
      if (!c) continue;
      if (/Crop \d+:/i.test(c)) {
        if (cur.name) crops.push(cur);
        cur = {};
        if (crops.length >= 4) break;
      } else if (c.includes(":")) {
        const [k, ...v] = c.split(":");
        const key = k.trim().toLowerCase().replace(/\s+/g, "_");
        const val = v.join(":").trim();
        if (key === "name") cur.name = val;
        else if (key === "reason") cur.season = val;
        else if (key === "expected_yield") cur.expectedYield = val;
        else if (key === "water_requirements") cur.waterRequirement = val;
        else if (key === "current_market_price") cur.profitMargin = val;
        cur.suitability = 85;
      }
    }
    if (cur.name && crops.length < 4) crops.push(cur);
    while (crops.length < 4)
      crops.push({
        name: `Crop ${crops.length + 1}`,
        season: "N/A",
        expectedYield: "N/A",
        waterRequirement: "N/A",
        profitMargin: "N/A",
        suitability: 50,
      });
    res.json({ crops: crops.slice(0, 4) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ Supabase setup for DB routes ============
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY,
);

// ============ /api/guest-check ============
app.post("/api/guest-check", async (req, res) => {
  try {
    const { service } = req.body;
    if (!service) return res.status(400).json({ error: "Missing service" });

    const ip =
      (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
      req.headers["x-real-ip"] ||
      req.socket?.remoteAddress ||
      "127.0.0.1";

    let { data: guestUser } = await supabase
      .from("users")
      .select("id, ip_address, location")
      .eq("ip_address", ip)
      .eq("is_guest", true)
      .single();

    if (!guestUser) {
      let location = null;
      try {
        const geoRes = await fetch(
          `http://ip-api.com/json/${ip}?fields=city,regionName,country`,
        );
        if (geoRes.ok) {
          const geo = await geoRes.json();
          location = [geo.city, geo.regionName, geo.country]
            .filter(Boolean)
            .join(", ");
        }
      } catch {
        /* ignore */
      }

      const { data: newUser } = await supabase
        .from("users")
        .insert({ ip_address: ip, name: "Guest", is_guest: true, location })
        .select()
        .single();
      guestUser = newUser;
    }

    if (!guestUser) return res.json({ allowed: true, error: "DB issue" });

    const { count } = await supabase
      .from("service_logs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", guestUser.id)
      .eq("service", service);

    return res.json({
      allowed: (count || 0) < 1,
      guest_user_id: guestUser.id,
      used: count || 0,
      limit: 1,
      ip,
    });
  } catch (err) {
    res.status(500).json({ allowed: true, error: err.message });
  }
});

// ============ /api/admin ============
const ADMIN_SECRET = process.env.ADMIN_PASSWORD || "krishimitra@admin2024";

function createAdminToken() {
  const payload = Buffer.from(
    JSON.stringify({ admin: true, exp: Date.now() + 86400000 }),
  ).toString("base64");
  const sig = crypto
    .createHmac("sha256", ADMIN_SECRET)
    .update(payload)
    .digest("hex");
  return `${payload}.${sig}`;
}

function verifyAdminToken(token) {
  try {
    const [payload, sig] = token.split(".");
    const expected = crypto
      .createHmac("sha256", ADMIN_SECRET)
      .update(payload)
      .digest("hex");
    if (sig !== expected) return null;
    const data = JSON.parse(Buffer.from(payload, "base64").toString());
    if (Date.now() > data.exp) return null;
    return data;
  } catch {
    return null;
  }
}

app.post("/api/admin", async (req, res) => {
  const { action } = req.body;

  if (action === "login") {
    const { username, password } = req.body;
    if (
      username === (process.env.ADMIN_USERNAME || "admin") &&
      password === ADMIN_SECRET
    ) {
      return res.json({ token: createAdminToken() });
    }
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token || !verifyAdminToken(token)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    if (action === "stats") {
      const [u, g, l, p, c] = await Promise.all([
        supabase
          .from("users")
          .select("id", { count: "exact", head: true })
          .eq("is_guest", false),
        supabase
          .from("users")
          .select("id", { count: "exact", head: true })
          .eq("is_guest", true),
        supabase
          .from("service_logs")
          .select("id", { count: "exact", head: true }),
        supabase
          .from("sprinkler_plans")
          .select("id", { count: "exact", head: true })
          .eq("status", "active"),
        supabase
          .from("chat_messages")
          .select("id", { count: "exact", head: true }),
      ]);
      return res.json({
        totalUsers: u.count || 0,
        guestUsers: g.count || 0,
        totalLogs: l.count || 0,
        activePlans: p.count || 0,
        chatMessages: c.count || 0,
      });
    }

    if (action === "users") {
      const { data: users } = await supabase
        .from("users")
        .select("*")
        .order("created_at", { ascending: false });
      const { data: logs } = await supabase
        .from("service_logs")
        .select("user_id, service");
      const counts = {};
      (logs || []).forEach((l) => {
        counts[l.user_id] = (counts[l.user_id] || 0) + 1;
      });
      return res.json({
        users: (users || []).map((u) => ({
          ...u,
          service_count: counts[u.id] || 0,
        })),
      });
    }

    if (action === "user-detail") {
      const { userId } = req.body;
      const [uu, ll, cc, pp] = await Promise.all([
        supabase.from("users").select("*").eq("id", userId).single(),
        supabase
          .from("service_logs")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false }),
        supabase
          .from("chat_messages")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: true }),
        supabase
          .from("sprinkler_plans")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false }),
      ]);
      return res.json({
        user: uu.data,
        serviceLogs: ll.data || [],
        chatHistory: cc.data || [],
        sprinklerPlans: pp.data || [],
      });
    }

    return res.status(400).json({ error: "Unknown action" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(3001, () =>
  console.log("✅ API server running on http://localhost:3001"),
);
