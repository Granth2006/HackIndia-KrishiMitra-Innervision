// Vercel Serverless Function: AI Chatbot

const GROQ_API_KEY = process.env.GROQ_API_KEY_1;
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const TEXT_MODEL = "openai/gpt-oss-20b";
const VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

const SYSTEM_PROMPT = `You are KrishiMitra AI, a helpful farming assistant for Indian farmers. Respond concisely in simple language. Focus on crops, soil, weather, pests, irrigation, and sustainable methods. Do not use Markdown formatting. End with a helpful follow-up question.`;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  try {
    const {
      messages: chatHistory,
      userMessage,
      imageBase64,
      mimeType,
    } = req.body;

    const hasImage = !!imageBase64;
    const model = hasImage ? VISION_MODEL : TEXT_MODEL;

    // Validate image is agriculture-related before processing
    if (hasImage) {
      const validationPrompt = `Look at this image and determine if it is related to agriculture, farming, plants, crops, leaves, soil, fields, gardens, or any kind of vegetation/botanical subject. Respond with ONLY a JSON object in this exact format (no markdown, no extra text):
{"isAgricultural": true} or {"isAgricultural": false}`;

      const imageDataUrl = `data:${mimeType || "image/jpeg"};base64,${imageBase64}`;

      const validationRes = await fetch(GROQ_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: VISION_MODEL,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: validationPrompt },
                { type: "image_url", image_url: { url: imageDataUrl } },
              ],
            },
          ],
          temperature: 0.1,
          max_tokens: 50,
        }),
      });

      if (validationRes.ok) {
        const valData = await validationRes.json();
        const valText = valData.choices?.[0]?.message?.content?.trim() || "";
        try {
          const valCleaned = valText
            .replace(/```json\n?/g, "")
            .replace(/```\n?/g, "")
            .trim();
          const valParsed = JSON.parse(valCleaned);
          if (valParsed.isAgricultural === false) {
            return res.status(200).json({
              reply:
                "🌾 This image doesn't seem to be related to agriculture or farming. Please upload a photo of your crops, plants, leaves, or anything related to farming, and I'll be happy to help analyze it!",
              notAgricultural: true,
            });
          }
        } catch {
          // If parsing fails, proceed with chat anyway
        }
      }
    }

    // Build messages array
    const messages = [{ role: "system", content: SYSTEM_PROMPT }];

    // Add chat history (last 10) — always as plain strings
    if (chatHistory && Array.isArray(chatHistory)) {
      chatHistory.slice(-10).forEach((msg) => {
        messages.push({
          role: msg.role === "user" ? "user" : "assistant",
          content: msg.text,
        });
      });
    }

    // Add current user message
    if (hasImage) {
      messages.push({
        role: "user",
        content: [
          {
            type: "text",
            text:
              userMessage ||
              "Analyze this plant image for health, diseases, or farming issues.",
          },
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
      const errData = await groqRes.json().catch(() => ({}));
      console.error("Groq chat error:", groqRes.status, errData);
      return res.status(500).json({
        error: `AI error: ${errData?.error?.message || groqRes.statusText}`,
      });
    }

    const data = await groqRes.json();
    const reply = data.choices?.[0]?.message?.content?.trim();
    return res.status(200).json({
      reply: reply || "I'm having trouble responding. Please try again.",
    });
  } catch (err) {
    console.error("chat error:", err);
    return res.status(500).json({ error: err.message });
  }
}
