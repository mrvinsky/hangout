export type PetMode = 'patronus' | 'living';
export type CoatPattern = 'solid' | 'tabby' | 'bicolor' | 'calico' | 'points';

export interface PetProfile {
  id: string;
  name: string;
  breed: string;
  species: 'cat' | 'dog';
  eyeColorHex: string;
  furColorHex: string;
  secondaryColorHex?: string;
  coatPattern: CoatPattern;
  personality: string;
  patronusTitle: string;
  auraColorHex?: string;
  mode: PetMode;
  photoUri?: string;
  modelUrl?: string;
  createdAt: number;
}

export interface PetAnalysisResult {
  species: 'cat' | 'dog';
  breed: string;
  coatPattern: CoatPattern;
  furColorHex: string;
  secondaryColorHex: string;
  eyeColorHex: string;
  personality: string;
  patronusTitle: string;
  patronusAuraColor: string;
  summary: string;
}

export interface PetMemory {
  id: string;
  petId: string;
  userText: string;
  petReply: string;
  createdAt: number;
}
