// Vercel Serverless Function: Analyze plant image

const GROQ_API_KEY = process.env.GROQ_API_KEY_1;
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  try {
    const { mode, imageBase64, mimeType } = req.body;
    if (!imageBase64)
      return res.status(400).json({ error: "No image provided" });

    const imageDataUrl = `data:${mimeType || "image/jpeg"};base64,${imageBase64}`;

    // Step 1: Validate if the image is agriculture-related
    const validationPrompt = `Look at this image and determine if it is related to agriculture, farming, plants, crops, leaves, soil, fields, gardens, or any kind of vegetation/botanical subject. Respond with ONLY a JSON object in this exact format (no markdown, no extra text):
{"isAgricultural": true} or {"isAgricultural": false}`;

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
          return res.status(400).json({
            error:
              "This image does not appear to be related to agriculture. Please upload a photo of your crops, plants, leaves, or anything related to farming for analysis.",
            notAgricultural: true,
          });
        }
      } catch {
        // If parsing fails, proceed with analysis anyway
      }
    }

    // Step 2: Proceed with actual analysis
    const prompt =
      mode === "sprinkler"
        ? `You are an expert agricultural AI assistant. Analyze this plant image and provide a comprehensive irrigation and disease management report. Return your response in the following JSON format ONLY (no markdown, no extra text, no code fences):
{
  "diseaseName": "name of suspected disease or 'Healthy'",
  "severity": "Low/Medium/High/None",
  "confidence": "percentage like '85%'",
  "irrigationPlan": {
    "frequency": "how often to water",
    "quantity": "liters per plant per session",
    "bestTime": "best time of day to water",
    "method": "drip/sprinkler/flood etc"
  },
  "pesticide": {
    "type": "pesticide name or 'None needed'",
    "amount": "dosage per liter of water",
    "applicationMethod": "how to apply",
    "frequency": "how often to apply",
    "safetyPeriod": "days before harvest"
  },
  "soilSuggestions": "soil care tips",
  "additionalTips": ["tip1", "tip2", "tip3"]
}`
        : `You are an expert agricultural AI assistant. Analyze this plant image for diseases AND generate a comprehensive sprinkler/irrigation management plan based on the detected condition. Return your response in the following JSON format ONLY (no markdown, no extra text, no code fences):
{
  "diseaseName": "name of disease or 'Healthy'",
  "severity": "Low/Medium/High/None",
  "confidence": "percentage like '85%'",
  "symptoms": ["symptom1", "symptom2"],
  "causes": ["cause1", "cause2"],
  "treatment": ["treatment1", "treatment2"],
  "prevention": ["prevention1", "prevention2"],
  "additionalTips": ["tip1", "tip2"],
  "irrigationPlan": {
    "frequency": "how often to water based on disease condition",
    "quantity": "liters per plant per session",
    "bestTime": "best time of day to water",
    "method": "drip/sprinkler/flood etc"
  },
  "pesticide": {
    "type": "pesticide name or 'None needed'",
    "amount": "dosage per liter of water",
    "applicationMethod": "how to apply",
    "frequency": "how often to apply",
    "safetyPeriod": "days before harvest"
  },
  "soilSuggestions": "soil care tips based on the disease",
  "sprinklerSchedule": [
    { "day": "Day 1", "action": "description of what to do", "time": "time of day" },
    { "day": "Day 3", "action": "description", "time": "time" },
    { "day": "Day 7", "action": "description", "time": "time" },
    { "day": "Day 14", "action": "description", "time": "time" },
    { "day": "Day 21", "action": "description", "time": "time" }
  ]
}`;

    // Vision model requires array content with image_url
    const messages = [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          {
            type: "image_url",
            image_url: { url: imageDataUrl },
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
      const errData = await groqRes.json().catch(() => ({}));
      console.error("Groq API error:", groqRes.status, errData);
      return res.status(500).json({
        error: `AI service error: ${errData?.error?.message || groqRes.statusText}`,
      });
    }

    const data = await groqRes.json();
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) return res.status(500).json({ error: "No response from AI" });

    // Parse JSON from response
    const cleaned = text
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    try {
      const parsed = JSON.parse(cleaned);
      return res.status(200).json(parsed);
    } catch {
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return res.status(200).json(JSON.parse(jsonMatch[0]));
      }
      return res
        .status(500)
        .json({ error: "Failed to parse AI response", raw: cleaned });
    }
  } catch (err) {
    console.error("analyze-plant error:", err);
    return res.status(500).json({ error: err.message });
  }
}
