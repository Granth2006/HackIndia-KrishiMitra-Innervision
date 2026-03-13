// Vercel Serverless Function: Admin dashboard API
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY,
);

const SECRET = process.env.ADMIN_PASSWORD || "krishimitra@admin2024";

function createToken() {
  const payload = Buffer.from(
    JSON.stringify({ admin: true, exp: Date.now() + 86400000 }),
  ).toString("base64");
  const sig = crypto.createHmac("sha256", SECRET).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

function verifyToken(token) {
  try {
    const [payload, sig] = token.split(".");
    const expected = crypto
      .createHmac("sha256", SECRET)
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

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const { action } = req.body;

  // ─── Login ───
  if (action === "login") {
    const { username, password } = req.body;
    const validUser = username === (process.env.ADMIN_USERNAME || "admin");
    const validPass =
      password === (process.env.ADMIN_PASSWORD || "krishimitra@admin2024");

    if (!validUser || !validPass) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Hash the password for comparison log (not stored anywhere)
    const hash = crypto.createHash("sha256").update(password).digest("hex");
    console.log(`Admin login successful. Hash: ${hash.slice(0, 8)}...`);

    return res.status(200).json({ token: createToken() });
  }

  // ─── All other actions require auth ───
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace("Bearer ", "");
  if (!token || !verifyToken(token)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    // ─── Dashboard Stats ───
    if (action === "stats") {
      const { count: totalUsers } = await supabase
        .from("users")
        .select("id", { count: "exact", head: true })
        .eq("is_guest", false);

      const { count: guestUsers } = await supabase
        .from("users")
        .select("id", { count: "exact", head: true })
        .eq("is_guest", true);

      const { count: totalLogs } = await supabase
        .from("service_logs")
        .select("id", { count: "exact", head: true });

      const { count: activePlans } = await supabase
        .from("sprinkler_plans")
        .select("id", { count: "exact", head: true })
        .eq("status", "active");

      const { count: chatMessages } = await supabase
        .from("chat_messages")
        .select("id", { count: "exact", head: true });

      const { count: totalFields } = await supabase
        .from("user_fields")
        .select("id", { count: "exact", head: true });

      return res.status(200).json({
        totalUsers: totalUsers || 0,
        guestUsers: guestUsers || 0,
        totalLogs: totalLogs || 0,
        activePlans: activePlans || 0,
        chatMessages: chatMessages || 0,
        totalFields: totalFields || 0,
      });
    }

    // ─── All Users List ───
    if (action === "users") {
      const { data: users } = await supabase
        .from("users")
        .select("*")
        .order("created_at", { ascending: false });

      // Get service usage counts per user
      const { data: logs } = await supabase
        .from("service_logs")
        .select("user_id, service");

      const usageCounts = {};
      (logs || []).forEach((log) => {
        if (!usageCounts[log.user_id]) usageCounts[log.user_id] = 0;
        usageCounts[log.user_id]++;
      });

      const enrichedUsers = (users || []).map((u) => ({
        ...u,
        service_count: usageCounts[u.id] || 0,
      }));

      return res.status(200).json({ users: enrichedUsers });
    }

    // ─── Single User Details ───
    if (action === "user-detail") {
      const { userId } = req.body;
      if (!userId) return res.status(400).json({ error: "Missing userId" });

      const { data: user } = await supabase
        .from("users")
        .select("*")
        .eq("id", userId)
        .single();

      const { data: logs } = await supabase
        .from("service_logs")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      const { data: chats } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: true });

      const { data: plans } = await supabase
        .from("sprinkler_plans")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      const { data: fields } = await supabase
        .from("user_fields")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      const { data: blockchainRecords } = await supabase
        .from("blockchain_records")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      return res.status(200).json({
        user,
        serviceLogs: logs || [],
        chatHistory: chats || [],
        sprinklerPlans: plans || [],
        userFields: fields || [],
        blockchainRecords: blockchainRecords || [],
      });
    }

    return res.status(400).json({ error: "Unknown action" });
  } catch (err) {
    console.error("Admin API error:", err);
    return res.status(500).json({ error: err.message });
  }
}
