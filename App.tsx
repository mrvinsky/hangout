import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { ARScreen } from './src/screens/ARScreen';
import { PetUploadScreen } from './src/screens/PetUploadScreen';
import { MemorialScreen } from './src/screens/MemorialScreen';
import { loadActivePet, savePet, setActivePet } from './src/services/petStorage';
import { PetProfile } from './src/types/pet';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<'ar' | 'upload' | 'memorial'>('ar');

  // Son seçilen kayıtlı pet; yoksa varsayılan Lord Boban (British Shorthair)
  const [petProfile, setPetProfile] = useState<PetProfile>(() => loadActivePet() || {
    id: 'boban_01',
    name: 'Boban',
    breed: 'British Shorthair (British Blue)',
    species: 'cat',
    eyeColorHex: '#ffb703',
    furColorHex: '#6b7280',
    secondaryColorHex: '#9ca3af',
    coatPattern: 'solid',
    personality: 'Asil, Sakin ve Koruyucu Muhafız',
    patronusTitle: 'Lord Boban the Silver Guardian',
    mode: 'patronus',
    modelUrl: '/models/boban/boban.glb',
    createdAt: Date.now(),
  });

  const activatePet = (profile: PetProfile) => {
    setActivePet(profile.id);
    setPetProfile(profile);
    setCurrentScreen('ar');
  };

  const handlePetCreated = (newProfile: PetProfile) => {
    savePet(newProfile);
    activatePet(newProfile);
  };

  return (
    <View style={[styles.container, currentScreen === 'ar' && { backgroundColor: 'transparent' }]}>
      <StatusBar style="light" />
      {currentScreen === 'ar' && (
        <ARScreen
          profile={petProfile}
          onOpenUpload={() => setCurrentScreen('upload')}
          onOpenMemorial={() => setCurrentScreen('memorial')}
        />
      )}

      {currentScreen === 'upload' && (
        <PetUploadScreen
          onPetCreated={handlePetCreated}
          onCancel={() => setCurrentScreen('ar')}
        />
      )}

      {currentScreen === 'memorial' && (
        <MemorialScreen
          activePetId={petProfile.id}
          onSelectPet={activatePet}
          onClose={() => setCurrentScreen('ar')}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0c0814',
  },
});
