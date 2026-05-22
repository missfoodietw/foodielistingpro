export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).end();

  const { message } = req.body;
  if (!message || !message.text) return res.status(200).end();

  const chatId = message.chat.id;
  const text = message.text.trim();

  if (text.startsWith('/start')) {
    await sendMessage(chatId,
      `👋 Welcome to Foodie Listing Pro!\n\nJust type any product keyword and I'll generate a full Shopee listing for you.\n\nExample:\nDyson V15 cordless vacuum\nMUJI organic cotton pyjamas\n佳德 蔥軋餅`
    );
    return res.status(200).end();
  }

  if (text.startsWith('/')) return res.status(200).end();

  await sendMessage(chatId, `⏳ Generating listing copy for "${text}"... give me a few seconds!`);

  const systemPrompt = `You are an expert e-commerce copywriter specialising in Shopee Singapore listings.
Your writing is conversational, benefit-driven, and tailored to Singapore shoppers.
Given a product keyword, generate compelling listing content.
You MUST reply with ONLY a raw JSON object. No markdown, no backticks, no explanation, nothing else before or after the JSON.

Required JSON structure:
{
  "en": {
    "title": "Shopee SG product title (catchy, keyword-rich, under 60 chars)",
    "copy": "3-4 paragraph product description, paragraphs separated by two newlines",
    "seo": ["kw1","kw2","kw3","kw4","kw5","kw6"],
    "points": ["Highlight 1","Highlight 2","Highlight 3","Highlight 4","Highlight 5"]
  },
  "zh": {
    "title": "蝦皮商品標題60字內",
    "copy": "3-4段商品文案，段落間空一行",
    "seo": ["關鍵字1","關鍵字2","關鍵字3","關鍵字4","關鍵字5","關鍵字6"],
    "points": ["商品特點1","商品特點2","商品特點3","商品特點4","商品特點5"]
  }
}`;

  try {
    const aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://foodielisting.vercel.app',
        'X-Title': 'Foodie Listing Pro Bot'
      },
      body: JSON.stringify({
model: 'google/gemini-2.5-flash-preview:free',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Product keyword: ${text}` }
        ],
        response_format: { type: 'json_object' }
      })
    });

    const aiData = await aiRes.json();

    if (!aiRes.ok) {
      console.error('OpenRouter error:', JSON.stringify(aiData));
      await sendMessage(chatId, `⚠️ AI service error: ${aiData.error?.message || 'Unknown error'}. Please try again.`);
      return res.status(200).end();
    }

    const raw = aiData.choices?.[0]?.message?.content || '';
    console.log('Full aiData:', JSON.stringify(aiData));


    if (!raw || raw.trim() === '') {
      await sendMessage(chatId, `⚠️ AI returned empty response. Please try again.`);
      return res.status(200).end();
    }

    const clean = raw.replace(/```json|```/g, '').trim();
    const data = JSON.parse(clean);

    const en = data.en || {};
    const zh = data.zh || {};

    const enPoints = (en.points || []).map(p => `• ${p}`).join('\n');
    const zhPoints = (zh.points || []).map(p => `• ${p}`).join('\n');
    const enSeo = (en.seo || []).join(' | ');
    const zhSeo = (zh.seo || []).join(' | ');

    const reply = `🛍 Shopee Listing Ready!

━━━━━━━━ 🇸🇬 ENGLISH ━━━━━━━━

📌 Title
${en.title || ''}

✍️ Listing Copy
${en.copy || ''}

✅ Highlights
${enPoints}

🔍 SEO Keywords
${enSeo}

━━━━━━━━ 🇨🇳 中文 ━━━━━━━━

📌 標題
${zh.title || ''}

✍️ 商品文案
${zh.copy || ''}

✅ 商品特點
${zhPoints}

🔍 SEO 關鍵字
${zhSeo}`;

    await sendMessage(chatId, reply);

  } catch (err) {
    console.error('Handler error:', err.message);
    await sendMessage(chatId, `⚠️ Sorry, something went wrong (${err.message}). Please try again.`);
  }

  return res.status(200).end();
}

async function sendMessage(chatId, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: text
    })
  });
  if (!resp.ok) {
    const err = await resp.json();
    console.error('Telegram sendMessage error:', JSON.stringify(err));
  }
}
