// Vercel Serverless Function: Guest usage check + IP tracking
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY,
);

// Helper: find or create the canonical guest user for an IP
async function getOrCreateGuestUser(ip) {
  // Step 1: Try to find existing guest user for this IP
  const { data: existing } = await supabase
    .from("users")
    .select("id, ip_address, location")
    .eq("ip_address", ip)
    .eq("is_guest", true)
    .order("created_at", { ascending: true })
    .limit(1);

  if (existing && existing.length > 0) {
    return { guestUser: existing[0], allGuestIds: null };
  }

  // Step 2: No guest exists, create one
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
    /* ignore geo errors */
  }

  const { data: newUser, error } = await supabase
    .from("users")
    .insert({
      ip_address: ip,
      name: "Guest",
      is_guest: true,
      location,
    })
    .select()
    .single();

  if (error) {
    // Race condition: another request created the user in between
    // Fetch the existing one
    console.error("Guest user creation race:", error.message);
    const { data: raceExisting } = await supabase
      .from("users")
      .select("id, ip_address, location")
      .eq("ip_address", ip)
      .eq("is_guest", true)
      .order("created_at", { ascending: true })
      .limit(1);

    if (raceExisting && raceExisting.length > 0) {
      return { guestUser: raceExisting[0], allGuestIds: null };
    }
    throw new Error("Failed to create or find guest user");
  }

  return { guestUser: newUser, allGuestIds: null };
}

// Helper: count service usage across ALL guest users with this IP
// (handles any existing duplicate guest rows in the DB)
async function countServiceUsage(ip, service) {
  const { data: allGuests } = await supabase
    .from("users")
    .select("id")
    .eq("ip_address", ip)
    .eq("is_guest", true);

  const allGuestIds = (allGuests || []).map((u) => u.id);
  if (allGuestIds.length === 0) return 0;

  const { count } = await supabase
    .from("service_logs")
    .select("id", { count: "exact", head: true })
    .in("user_id", allGuestIds)
    .eq("service", service);

  return count || 0;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  try {
    const { service, action, form_data, result_data } = req.body;
    if (!service) return res.status(400).json({ error: "Missing service" });

    // Get client IP
    const ip =
      (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
      req.headers["x-real-ip"] ||
      req.socket?.remoteAddress ||
      "unknown";

    // Get or create the canonical guest user
    const { guestUser } = await getOrCreateGuestUser(ip);

    // Count existing service usage across all guest rows for this IP
    const totalCount = await countServiceUsage(ip, service);

    const limit = 1;
    const allowed = totalCount < limit;

    // If action is "log", atomically check + log in one call
    if (action === "log") {
      if (!allowed) {
        return res.status(200).json({
          allowed: false,
          guest_user_id: guestUser.id,
          used: totalCount,
          limit,
          ip,
          logged: false,
        });
      }

      // Log the service usage
      const { error: logError } = await supabase.from("service_logs").insert({
        user_id: guestUser.id,
        service,
        form_data: form_data || null,
        result_data: result_data || null,
      });

      if (logError) {
        console.error("Guest service log error:", logError);
      }

      return res.status(200).json({
        allowed: true,
        guest_user_id: guestUser.id,
        used: totalCount + 1,
        limit,
        ip,
        logged: !logError,
      });
    }

    // Default: just check
    return res.status(200).json({
      allowed,
      guest_user_id: guestUser.id,
      used: totalCount,
      limit,
      ip,
    });
  } catch (err) {
    console.error("guest-check error:", err);
    return res.status(500).json({ allowed: true, error: err.message });
  }
}
