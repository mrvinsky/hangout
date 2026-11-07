import { PetMemory, PetProfile } from '../types/pet';

/**
 * Cihazda kalıcı pet profilleri ve anılar (localStorage).
 * Uygulama arayüzü web'de (native'de WebView içinde) çalıştığı için tek depo yeterli.
 * Erişilemezse (gizli sekme vb.) sessizce boş döner.
 */

const PETS_KEY = 'eternalpaws.pets.v1';
const ACTIVE_KEY = 'eternalpaws.activePet.v1';
const MEMORIES_KEY = 'eternalpaws.memories.v1';
const MAX_MEMORIES = 100;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn('Kayıt yazılamadı:', err);
  }
}

export function loadPets(): PetProfile[] {
  return read<PetProfile[]>(PETS_KEY, []);
}

export function savePet(profile: PetProfile) {
  const pets = loadPets().filter((p) => p.id !== profile.id);
  pets.unshift(profile);
  write(PETS_KEY, pets);
}

export function deletePet(id: string) {
  write(PETS_KEY, loadPets().filter((p) => p.id !== id));
  write(MEMORIES_KEY, loadMemories().filter((m) => m.petId !== id));
  if (read<string | null>(ACTIVE_KEY, null) === id) write(ACTIVE_KEY, null);
}

export function loadActivePet(): PetProfile | null {
  const id = read<string | null>(ACTIVE_KEY, null);
  return loadPets().find((p) => p.id === id) || null;
}

export function setActivePet(id: string) {
  write(ACTIVE_KEY, id);
}

export function loadMemories(petId?: string): PetMemory[] {
  const all = read<PetMemory[]>(MEMORIES_KEY, []);
  return petId ? all.filter((m) => m.petId === petId) : all;
}

export function addMemory(memory: PetMemory) {
  write(MEMORIES_KEY, [memory, ...loadMemories()].slice(0, MAX_MEMORIES));
}
