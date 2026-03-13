// Vercel Serverless Function: Save push subscription to Supabase
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  try {
    const { subscription, userId, userEmail } = req.body;

    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ error: "Invalid subscription" });
    }

    // Upsert subscription — use endpoint as unique key
    const { data, error } = await supabase
      .from("push_subscriptions")
      .upsert(
        {
          endpoint: subscription.endpoint,
          keys_p256dh: subscription.keys?.p256dh || null,
          keys_auth: subscription.keys?.auth || null,
          user_id: userId || null,
          user_email: userEmail || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "endpoint" }
      )
      .select()
      .single();

    if (error) {
      console.error("Supabase upsert error:", error);
      return res.status(500).json({ error: "Failed to save subscription" });
    }

    return res.status(200).json({ success: true, id: data?.id });
  } catch (err) {
    console.error("save-subscription error:", err);
    return res.status(500).json({ error: err.message });
  }
}
