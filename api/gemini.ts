/**
 * Vercel Serverless Function — Gemini proxy.
 * API anahtarı sadece sunucuda (GEMINI_API_KEY) durur, istemciye hiç gitmez.
 *
 * POST /api/gemini
 *   { action: 'analyze', image: <base64 jpeg> }
 *   { action: 'chat', petName, message, personality? }
 */
import {
  GEMINI_MODEL_DEFAULT,
  analyzeBody,
  buildChatPrompt,
  chatBody,
  extractText,
  geminiEndpoint,
  parseAnalysis,
} from '../src/services/geminiPrompts';

const MAX_IMAGE_BASE64 = 3_000_000; // ~2.2 MB JPEG, Vercel'in 4.5 MB gövde limitinin altında

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    res.status(503).json({ error: 'GEMINI_API_KEY tanımlı değil' });
    return;
  }
  const model = process.env.GEMINI_MODEL || GEMINI_MODEL_DEFAULT;
  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};

  let payload: unknown;
  if (body.action === 'analyze') {
    const image = String(body.image || '').replace(/^data:image\/[a-z]+;base64,/, '');
    if (!image || image.length > MAX_IMAGE_BASE64) {
      res.status(400).json({ error: 'Geçersiz ya da çok büyük görsel' });
      return;
    }
    payload = analyzeBody(image);
  } else if (body.action === 'chat') {
    const message = String(body.message || '').trim();
    if (!message) {
      res.status(400).json({ error: 'Boş mesaj' });
      return;
    }
    payload = chatBody(buildChatPrompt(String(body.petName || 'Dost').slice(0, 40), message, body.personality));
  } else {
    res.status(400).json({ error: 'Bilinmeyen action' });
    return;
  }

  try {
    const upstream = await fetch(geminiEndpoint(model, key), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!upstream.ok) {
      res.status(502).json({ error: `Gemini ${upstream.status}` });
      return;
    }
    const text = extractText(await upstream.json());
    if (body.action === 'analyze') {
      const analysis = parseAnalysis(text);
      if (!analysis) {
        res.status(502).json({ error: 'Analiz ayrıştırılamadı' });
        return;
      }
      res.status(200).json({ analysis });
    } else {
      res.status(200).json({ reply: text });
    }
  } catch (err) {
    res.status(502).json({ error: 'Gemini erişilemedi' });
  }
}
