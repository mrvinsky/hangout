export type PetMode = 'patronus' | 'living';

export interface PetProfile {
  id: string;
  name: string;
  breed: string;
  species: 'cat' | 'dog';
  eyeColorHex: string;
  furColorHex: string;
  secondaryColorHex?: string;
  coatPattern: 'solid' | 'tabby' | 'bicolor' | 'calico' | 'points';
  personality: string;
  patronusTitle: string;
  mode: PetMode;
  photoUri?: string;
  modelUrl?: string;
  createdAt: number;
}

export interface PetAnalysisResult {
  species: 'cat' | 'dog';
  breed: string;
  coatPattern: 'solid' | 'tabby' | 'bicolor' | 'calico' | 'points';
  furColorHex: string;
  secondaryColorHex: string;
  eyeColorHex: string;
  personality: string;
  patronusTitle: string;
  patronusAuraColor: string;
  summary: string;
}
