export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).end();

  const { message } = req.body;
  if (!message || !message.text) return res.status(200).end();

  const chatId = message.chat.id;
  const text = message.text.trim();

  if (text.startsWith('/start')) {
    await sendMessage(chatId, `👋 Welcome to Foodie Listing Pro!\n\nType any product keyword to generate a full Shopee listing.\n\nExample: Dyson V15 vacuum\nExample: 佳德 蔥軋餅`);
    return res.status(200).end();
  }

  if (text.startsWith('/')) return res.status(200).end();

  await sendMessage(chatId, `⏳ Writing listing copy for "${text}"... please wait!`);

  const prompt = `You are a Shopee Singapore copywriter. Given a product keyword, write listing content.

IMPORTANT: Reply with ONLY a JSON object, nothing else. No markdown, no backticks, no explanation.

Product keyword: ${text}

Return this exact JSON structure:
{
  "en_title": "catchy Shopee title under 60 chars",
  "en_copy": "3 paragraph description for Singapore shoppers, conversational tone",
  "en_seo": "keyword1, keyword2, keyword3, keyword4, keyword5",
  "en_points": "point1|point2|point3|point4|point5",
  "zh_title": "吸引人的蝦皮標題60字內",
  "zh_copy": "3段口語化商品文案，貼近消費者痛點",
  "zh_seo": "關鍵字1, 關鍵字2, 關鍵字3, 關鍵字4, 關鍵字5",
  "zh_points": "特點1|特點2|特點3|特點4|特點5"
}`;

  try {
    const aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://foodielisting.vercel.app',
        'X-Title': 'Foodie Listing Pro'
      },
body: JSON.stringify({
  model: 'deepseek/deepseek-chat',
  messages: [{ role: 'user', content: prompt }],
  temperature: 0.7,
  max_tokens: 1200
})
      })
    });

    const aiData = await aiRes.json();
    console.log('Status:', aiRes.status);
    console.log('Response:', JSON.stringify(aiData).substring(0, 500));

    if (!aiRes.ok) {
      await sendMessage(chatId, `⚠️ Error ${aiRes.status}: ${aiData.error?.message || 'Unknown'}. Please try again.`);
      return res.status(200).end();
    }

    const raw = aiData.choices?.[0]?.message?.content || '';
    if (!raw) {
      await sendMessage(chatId, `⚠️ Empty response from AI. Please try again.`);
      return res.status(200).end();
    }

    const clean = raw.replace(/```json|```/g, '').trim();
   let d;

try {
  d = JSON.parse(clean);
} catch (e) {
  console.log(clean);
  await sendMessage(chatId, '⚠️ AI returned invalid JSON. Please try again.');
  return res.status(200).end();
}
━━━ 🇸🇬 ENGLISH ━━━

📌 Title
${d.en_title}

✍️ Copy
${d.en_copy}

✅ Highlights
${enPoints}

🔍 SEO
${d.en_seo}

━━━ 🇨🇳 中文 ━━━

📌 標題
${d.zh_title}

✍️ 文案
${d.zh_copy}

✅ 特點
${zhPoints}

🔍 SEO
${d.zh_seo}`;

    await sendMessage(chatId, reply);

  } catch (err) {
    console.error('Error:', err.message);
    await sendMessage(chatId, `⚠️ Error: ${err.message}. Please try again.`);
  }

  return res.status(200).end();
}

async function sendMessage(chatId, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text })
  });
}
