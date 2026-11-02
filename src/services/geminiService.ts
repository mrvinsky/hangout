import { PetAnalysisResult } from '../types/pet';
import {
  GEMINI_MODEL_DEFAULT,
  analyzeBody,
  buildChatPrompt,
  chatBody,
  extractText,
  geminiEndpoint,
  parseAnalysis,
} from './geminiPrompts';

/**
 * Gemini AI Vision & Character Service
 * Varsayılan yol: kendi backend'imiz (/api/gemini) — anahtar istemciye gömülmez.
 * Kullanıcı yükleme ekranında kendi anahtarını girerse doğrudan Google'a gider.
 * İkisi de başarısız olursa çevrimdışı varsayılan sonuç döner.
 */

const API_BASE = process.env.EXPO_PUBLIC_API_BASE || '';

async function callProxy<T>(body: object): Promise<T | null> {
  try {
    const response = await fetch(`${API_BASE}/api/gemini`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

async function callDirect(apiKey: string, body: object): Promise<string | null> {
  try {
    const response = await fetch(geminiEndpoint(GEMINI_MODEL_DEFAULT, apiKey), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) return null;
    return extractText(await response.json());
  } catch (err) {
    console.warn('Gemini doğrudan çağrı başarısız:', err);
    return null;
  }
}

export async function analyzePetPhoto(
  base64Image: string,
  apiKey?: string
): Promise<PetAnalysisResult> {
  const cleanBase64 = base64Image.replace(/^data:image\/[a-z]+;base64,/, '');

  if (cleanBase64) {
    if (apiKey) {
      const text = await callDirect(apiKey, analyzeBody(cleanBase64));
      const parsed = text ? parseAnalysis(text) : null;
      if (parsed) return parsed as unknown as PetAnalysisResult;
    } else {
      const res = await callProxy<{ analysis: PetAnalysisResult }>({ action: 'analyze', image: cleanBase64 });
      if (res?.analysis) return res.analysis;
    }
  }

  // Çevrimdışı varsayılan (backend/anahtar yoksa)
  await new Promise((resolve) => setTimeout(resolve, 800));
  return {
    species: 'cat',
    breed: 'British Shorthair (British Blue)',
    coatPattern: 'solid',
    furColorHex: '#6b7280',
    secondaryColorHex: '#9ca3af',
    eyeColorHex: '#ffb703',
    personality: 'Asil, Sakin ve Koruyucu Muhafız',
    patronusTitle: 'Lord Boban the Silver Guardian',
    patronusAuraColor: '#dbeafe',
    summary: 'Kadife gibi kurşuni gri kürkü ve büyüleyici kehribar gözleriyle sadık bir ruhani muhafız.',
  };
}

export async function generatePetMessage(
  petName: string,
  userPrompt: string,
  personality?: string,
  apiKey?: string
): Promise<string> {
  let reply: string | null = null;
  if (apiKey) {
    reply = await callDirect(apiKey, chatBody(buildChatPrompt(petName, userPrompt, personality)));
  } else {
    const res = await callProxy<{ reply: string }>({ action: 'chat', petName, message: userPrompt, personality });
    reply = res?.reply || null;
  }
  return reply || `*${petName} gözlerini kısıp başını eline sürtüyor ve usulca mırıldanıyor: "Her zaman senin yanındayım..."*`;
}
