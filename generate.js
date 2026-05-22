export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { keyword } = req.body;
  if (!keyword) return res.status(400).json({ error: 'Missing keyword' });

  const systemPrompt = `You are an expert e-commerce copywriter specialising in Shopee Singapore listings. 
Your writing is conversational, benefit-driven, and tailored to Singapore shoppers (Singlish-friendly tone is welcome for Chinese copy).
Given a product keyword, generate compelling listing content.
Reply ONLY with raw JSON — no markdown fences, no preamble.

JSON structure:
{
  "en": {
    "title": "Shopee SG product title (catchy, keyword-rich, under 60 chars)",
    "copy": "3-4 paragraph product description (conversational, pain-point focused, Singapore audience, paragraphs separated by \\n\\n)",
    "seo": ["keyword1","keyword2","keyword3","keyword4","keyword5","keyword6","keyword7","keyword8"],
    "points": ["Highlight 1 (benefit-focused, punchy)","Highlight 2","Highlight 3","Highlight 4","Highlight 5"]
  },
  "zh": {
    "title": "蝦皮商品標題（吸引人，含關鍵字，60字內）",
    "copy": "3-4段商品文案（口語化，貼近消費者痛點，段落間用\\n\\n分隔）",
    "seo": ["關鍵字1","關鍵字2","關鍵字3","關鍵字4","關鍵字5","關鍵字6","關鍵字7","關鍵字8"],
    "points": ["商品特點1（口語化，點出好處）","商品特點2","商品特點3","商品特點4","商品特點5"]
  }
}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        system: systemPrompt,
        messages: [{ role: 'user', content: `Product keyword: ${keyword}` }]
      })
    });

    if (!response.ok) {
      const err = await response.json();
      return res.status(response.status).json({ error: err.error?.message || 'API error' });
    }

    const data = await response.json();
    const text = (data.content || []).map(b => b.text || '').join('');
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    return res.status(200).json(parsed);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
