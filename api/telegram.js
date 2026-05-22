export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).end();

  const { message } = req.body;
  if (!message || !message.text) return res.status(200).end();

  const chatId = message.chat.id;
  const text = message.text.trim();

  if (text.startsWith('/start')) {
    await sendMessage(chatId,
      `👋 *Welcome to Foodie Listing Pro\\!*\n\nJust type any product keyword and I'll generate a full Shopee listing for you\\.\n\n*Example:*\n\`Dyson V15 cordless vacuum\`\n\`MUJI organic cotton pyjamas\`\n\`佳德 蔥軋餅\``
    );
    return res.status(200).end();
  }

  if (text.startsWith('/')) return res.status(200).end();

  await sendMessage(chatId, `⏳ Generating listing copy for *"${escMd(text)}"*\\.\\.\\. give me a few seconds\\!`);

  const systemPrompt = `You are an expert e-commerce copywriter specialising in Shopee Singapore listings.
Your writing is conversational, benefit-driven, and tailored to Singapore shoppers.
Given a product keyword, generate compelling listing content.
Reply ONLY with raw JSON — no markdown fences, no preamble.

JSON structure:
{
  "en": {
    "title": "Shopee SG product title (catchy, keyword-rich, under 60 chars)",
    "copy": "3-4 paragraph product description (conversational, pain-point focused, paragraphs separated by \\n\\n)",
    "seo": ["kw1","kw2","kw3","kw4","kw5","kw6"],
    "points": ["Highlight 1","Highlight 2","Highlight 3","Highlight 4","Highlight 5"]
  },
  "zh": {
    "title": "蝦皮商品標題（吸引人，含關鍵字，60字內）",
    "copy": "3-4段商品文案（口語化，貼近痛點，段落間用\\n\\n分隔）",
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
        'HTTP-Referer': 'https://shopee-listing.vercel.app',
        'X-Title': 'Foodie Listing Pro Bot'
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-4-maverick:free',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Product keyword: ${text}` }
        ]
      })
    });

    const aiData = await aiRes.json();
    const raw = aiData.choices?.[0]?.message?.content || '';
    const clean = raw.replace(/```json|```/g, '').trim();
    const data = JSON.parse(clean);

    const en = data.en;
    const zh = data.zh;

    const reply = [
      `🛍 *Shopee Listing Ready\\!*`,
      ``,
      `━━━━━━━━ 🇸🇬 ENGLISH ━━━━━━━━`,
      ``,
      `📌 *Title*`,
      escMd(en.title),
      ``,
      `✍️ *Listing Copy*`,
      escMd(en.copy),
      ``,
      `✅ *Highlights*`,
      (en.points || []).map(p => `• ${escMd(p)}`).join('\n'),
      ``,
      `🔍 *SEO Keywords*`,
      (en.seo || []).map(k => `\`${k}\``).join('  '),
      ``,
      `━━━━━━━━ 🇨🇳 中文 ━━━━━━━━`,
      ``,
      `📌 *標題*`,
      escMd(zh.title),
      ``,
      `✍️ *商品文案*`,
      escMd(zh.copy),
      ``,
      `✅ *商品特點*`,
      (zh.points || []).map(p => `• ${escMd(p)}`).join('\n'),
      ``,
      `🔍 *SEO 關鍵字*`,
      (zh.seo || []).map(k => `\`${k}\``).join('  '),
    ].join('\n');

    await sendMessage(chatId, reply);
  } catch (err) {
    console.error(err);
    await sendMessage(chatId, `⚠️ Sorry, something went wrong\\. Please try again\\.`);
  }

  return res.status(200).end();
}

function escMd(str) {
  if (!str) return '';
  return str.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
}

async function sendMessage(chatId, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'MarkdownV2'
    })
  });
}

