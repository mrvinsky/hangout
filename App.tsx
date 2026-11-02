import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { ARScreen } from './src/screens/ARScreen';
import { PetUploadScreen } from './src/screens/PetUploadScreen';
import { PetProfile } from './src/types/pet';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<'ar' | 'upload' | 'memorial'>('ar');

  // Başlangıç Varsayılan Pet Profili: Lord Boban (British Shorthair)
  const [petProfile, setPetProfile] = useState<PetProfile>({
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
    createdAt: Date.now(),
  });

  const handlePetCreated = (newProfile: PetProfile) => {
    setPetProfile(newProfile);
    setCurrentScreen('ar');
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0c0814',
  },
});
