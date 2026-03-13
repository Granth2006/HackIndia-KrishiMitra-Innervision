// Vercel Serverless Function: Send push notification via web-push
import webPush from "web-push";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  try {
    // Configure VAPID inside handler to avoid crash on missing env vars
    const vapidPublic = process.env.VAPID_PUBLIC_KEY;
    const vapidPrivate = process.env.VAPID_PRIVATE_KEY;

    if (!vapidPublic || !vapidPrivate) {
      console.error("VAPID keys not set in environment variables");
      return res.status(500).json({
        error:
          "Push notifications not configured. VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY must be set in Vercel environment variables.",
      });
    }

    webPush.setVapidDetails(
      "mailto:krishimitra@example.com",
      vapidPublic,
      vapidPrivate
    );

    const { userId, userEmail, endpoint, title, body, url } = req.body;

    if (!userId && !userEmail && !endpoint) {
      return res
        .status(400)
        .json({ error: "userId, userEmail, or endpoint is required" });
    }

    // Find subscriptions
    let query = supabase.from("push_subscriptions").select("*");
    
    // If endpoint is provided, we ONLY target this specific device
    if (endpoint) {
      query = query.eq("endpoint", endpoint);
    } else if (userId) {
      // Otherwise fallback to broadcasting to all devices for this user
      query = query.eq("user_id", userId);
    } else if (userEmail) {
      query = query.eq("user_email", userEmail);
    }

    const { data: subscriptions, error } = await query;

    if (error) {
      console.error("Supabase query error:", error);
      return res.status(500).json({ error: "Failed to fetch subscriptions" });
    }

    if (!subscriptions || subscriptions.length === 0) {
      return res
        .status(404)
        .json({ error: "No push subscriptions found for this user" });
    }

    const payload = JSON.stringify({
      title: title || "🌾 KrishiMitra AI",
      body:
        body ||
        "This is a test notification from KrishiMitra! Your push notifications are working perfectly. 🚜",
      icon: "/krishimitra.png",
      badge: "/krishimitra.png",
      url: url || "/dashboard/profile",
    });

    // Send to all subscriptions for this user (they may have multiple devices)
    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.keys_p256dh,
            auth: sub.keys_auth,
          },
        };

        try {
          const pushOptions = {
            TTL: 86400, // 24 hours
            headers: {
              Urgency: "high",
            },
          };
          await webPush.sendNotification(pushSubscription, payload, pushOptions);
          return { endpoint: sub.endpoint, success: true };
        } catch (pushError) {
          console.error(
            "Push failed for endpoint:",
            sub.endpoint,
            pushError.statusCode
          );

          // If subscription is expired or invalid (410 Gone, 404), remove it
          if (
            pushError.statusCode === 410 ||
            pushError.statusCode === 404
          ) {
            await supabase
              .from("push_subscriptions")
              .delete()
              .eq("endpoint", sub.endpoint);
          }

          return {
            endpoint: sub.endpoint,
            success: false,
            error: pushError.message,
          };
        }
      })
    );

    const sent = results.filter(
      (r) => r.status === "fulfilled" && r.value.success
    ).length;
    const failed = results.length - sent;

    return res.status(200).json({
      success: true,
      sent,
      failed,
      total: results.length,
    });
  } catch (err) {
    console.error("send-notification error:", err);
    return res.status(500).json({ error: err.message });
  }
}
