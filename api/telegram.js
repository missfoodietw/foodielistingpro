module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).end();
  }

  try {
    const { message } = req.body;

    if (!message || !message.text) {
      return res.status(200).end();
    }

    const chatId = message.chat.id;
    const text = message.text.trim();

    // START COMMAND
    if (text.startsWith('/start')) {
      await sendMessage(
        chatId,
        `👋 Welcome to Foodie Listing Pro!

Type any product keyword to generate a Shopee listing.

Example:
Dyson V15 vacuum

Example:
佳德 蔥軋餅`
      );

      return res.status(200).end();
    }

    // IGNORE OTHER COMMANDS
    if (text.startsWith('/')) {
      return res.status(200).end();
    }

    // LOADING MESSAGE
    await sendMessage(
      chatId,
      `⏳ Writing listing copy for "${text}"... please wait!`
    );

    // AI PROMPT
    const prompt = `You are a Shopee Singapore copywriter.

Given a product keyword, write listing content.

IMPORTANT:
Reply with ONLY valid JSON.
No markdown.
No backticks.
No explanation.

Product keyword:
${text}

Return this exact JSON structure:

{
  "en_title": "catchy Shopee title under 60 chars",
  "en_copy": "3 paragraph English product description",
  "en_seo": "keyword1, keyword2, keyword3, keyword4, keyword5",
  "en_points": "point1|point2|point3|point4|point5",

  "zh_title": "吸引人的蝦皮標題60字內",
  "zh_copy": "3段中文商品文案",
  "zh_seo": "關鍵字1, 關鍵字2, 關鍵字3, 關鍵字4, 關鍵字5",
  "zh_points": "特點1|特點2|特點3|特點4|特點5"
}`;

    // GEMINI API
    const aiRes = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=' +
        process.env.GEMINI_API_KEY,
      {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json'
        },

        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt
                }
              ]
            }
          ],

          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1200
          }
        })
      }
    );

    const aiData = await aiRes.json();

    console.log('STATUS:', aiRes.status);
    console.log(
      'DATA:',
      JSON.stringify(aiData).substring(0, 1000)
    );

    // API ERROR
    if (!aiRes.ok) {
      await sendMessage(
        chatId,
        `⚠️ Gemini Error ${aiRes.status}

${JSON.stringify(aiData).substring(0, 500)}`
      );

      return res.status(200).end();
    }

    // RAW AI TEXT
    const raw =
      aiData?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!raw) {
      await sendMessage(
        chatId,
        '⚠️ Empty AI response.'
      );

      return res.status(200).end();
    }

    // CLEAN JSON
    const clean = raw
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

    console.log('RAW CLEAN:', clean);

    let d;

    // SAFE JSON PARSE
    try {
      d = JSON.parse(clean);
    } catch (e) {
      console.log('JSON ERROR:', e.message);
      console.log(clean);

      await sendMessage(
        chatId,
        '⚠️ AI returned invalid JSON. Please try again.'
      );

      return res.status(200).end();
    }

    // FORMAT BULLETS
    const enPoints = (d.en_points || '')
      .split('|')
      .map(p => `• ${p.trim()}`)
      .join('\n');

    const zhPoints = (d.zh_points || '')
      .split('|')
      .map(p => `• ${p.trim()}`)
      .join('\n');

    // FINAL REPLY
    const reply = `🛍 Listing Ready!

━━━ 🇸🇬 ENGLISH ━━━

📌 Title
${d.en_title || '-'}

✍️ Copy
${d.en_copy || '-'}

✅ Highlights
${enPoints || '-'}

🔍 SEO
${d.en_seo || '-'}

━━━ 🇨🇳 中文 ━━━

📌 標題
${d.zh_title || '-'}

✍️ 文案
${d.zh_copy || '-'}

✅ 特點
${zhPoints || '-'}

🔍 SEO
${d.zh_seo || '-'}`;

    // TELEGRAM MESSAGE LIMIT
    await sendMessage(
      chatId,
      reply.substring(0, 4000)
    );

    return res.status(200).end();

  } catch (err) {
    console.error('MAIN ERROR:', err);

    await sendMessage(
      process.env.ADMIN_CHAT_ID || '',
      `❌ BOT ERROR:\n${err.message}`
    );

    return res.status(200).json({
      error: err.message
    });
  }
}

// TELEGRAM SEND FUNCTION
async function sendMessage(chatId, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!chatId) return;

  await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json'
      },

      body: JSON.stringify({
        chat_id: chatId,
        text
      })
    }
  );
}
