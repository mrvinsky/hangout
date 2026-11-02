import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator, ScrollView } from 'react-native';
import { analyzePetPhoto } from '../services/geminiService';
import { PetAnalysisResult, PetProfile } from '../types/pet';

interface PetUploadScreenProps {
  onPetCreated: (profile: PetProfile) => void;
  onCancel: () => void;
}

export const PetUploadScreen: React.FC<PetUploadScreenProps> = ({ onPetCreated, onCancel }) => {
  const [photoUri, setPhotoUri] = useState<string | null>('ozzy_frame.jpg');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<PetAnalysisResult | null>(null);

  const handleStartAnalysis = async () => {
    setIsAnalyzing(true);
    // Fotoğrafı analiz et
    const result = await analyzePetPhoto('mock_base64_data');
    setAnalysis(result);
    setIsAnalyzing(false);
  };

  const handleConfirm = () => {
    if (!analysis) return;
    const newProfile: PetProfile = {
      id: 'pet_' + Date.now(),
      name: 'Boban',
      breed: analysis.breed,
      species: analysis.species,
      eyeColorHex: analysis.eyeColorHex,
      furColorHex: analysis.furColorHex,
      secondaryColorHex: analysis.secondaryColorHex,
      coatPattern: analysis.coatPattern,
      personality: analysis.personality,
      patronusTitle: analysis.patronusTitle,
      mode: 'patronus',
      photoUri: photoUri || undefined,
      createdAt: Date.now(),
    };
    onPetCreated(newProfile);
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>🐾 Evcil Hayvanını Canlandır</Text>
        <Text style={styles.subtitle}>
          Fotoğrafını yükle, yapay zeka onun 3D formunu ve ruhani Patronus'unu hazırlasın.
        </Text>

        {/* Fotoğraf Alanı */}
        <View style={styles.photoContainer}>
          <Image
            source={{ uri: photoUri || 'ozzy_frame.jpg' }}
            style={styles.petImage}
            resizeMode="cover"
          />
          <View style={styles.photoOverlayBadge}>
            <Text style={styles.badgeText}>📸 Lord Boban (Örnek Fotoğraf)</Text>
          </View>
        </View>

        {/* AI Analiz Butonu */}
        {!analysis && (
          <TouchableOpacity
            style={styles.analyzeButton}
            onPress={handleStartAnalysis}
            disabled={isAnalyzing}
          >
            {isAnalyzing ? (
              <ActivityIndicator color="#0b0712" />
            ) : (
              <Text style={styles.analyzeButtonText}>✨ Gemini AI ile Fotoğrafı Analiz Et</Text>
            )}
          </TouchableOpacity>
        )}

        {/* Analiz Sonuç Kartı */}
        {analysis && (
          <View style={styles.resultCard}>
            <Text style={styles.resultHeader}>🧬 AI Analiz Raporu</Text>
            
            <View style={styles.traitRow}>
              <Text style={styles.traitLabel}>Irk & Tür:</Text>
              <Text style={styles.traitValue}>{analysis.breed}</Text>
            </View>

            <View style={styles.traitRow}>
              <Text style={styles.traitLabel}>Karakter:</Text>
              <Text style={styles.traitValue}>{analysis.personality}</Text>
            </View>

            <View style={styles.traitRow}>
              <Text style={styles.traitLabel}>Kürk Rengi:</Text>
              <View style={styles.colorIndicatorRow}>
                <View style={[styles.colorDot, { backgroundColor: analysis.furColorHex }]} />
                <Text style={styles.traitValue}>{analysis.furColorHex} (British Slate Grey)</Text>
              </View>
            </View>

            <View style={styles.traitRow}>
              <Text style={styles.traitLabel}>Göz Rengi:</Text>
              <View style={styles.colorIndicatorRow}>
                <View style={[styles.colorDot, { backgroundColor: analysis.eyeColorHex }]} />
                <Text style={styles.traitValue}>{analysis.eyeColorHex} (Altın Kehribar)</Text>
              </View>
            </View>

            <View style={styles.traitRow}>
              <Text style={styles.traitLabel}>Patronus Ünvanı:</Text>
              <Text style={[styles.traitValue, { color: '#ffd166', fontWeight: 'bold' }]}>
                {analysis.patronusTitle}
              </Text>
            </View>

            <Text style={styles.summaryText}>"{analysis.summary}"</Text>

            <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
              <Text style={styles.confirmButtonText}>⚡ 3D Modelini Canlandır & AR'da Gör</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelButtonText}>Vazgeç / Geri Dön</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0c0814',
  },
  scrollContent: {
    padding: 24,
    paddingTop: 48,
    alignItems: 'center',
  },
  title: {
    fontFamily: 'Cinzel',
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffd166',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    color: '#cbd5e1',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 18,
  },
  photoContainer: {
    width: 280,
    height: 280,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255, 215, 0, 0.4)',
    position: 'relative',
    marginBottom: 24,
  },
  petImage: {
    width: '100%',
    height: '100%',
  },
  photoOverlayBadge: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  badgeText: {
    color: '#e2e8f0',
    fontSize: 11,
    fontWeight: '600',
  },
  analyzeButton: {
    backgroundColor: '#ffd166',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 16,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
    marginBottom: 16,
    boxShadow: '0 4px 20px rgba(255, 209, 102, 0.4)' as any,
  },
  analyzeButtonText: {
    fontWeight: 'bold',
    fontSize: 15,
    color: '#0b0712',
  },
  resultCard: {
    backgroundColor: '#1b1429',
    width: '100%',
    maxWidth: 340,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
    marginBottom: 20,
  },
  resultHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffd166',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    paddingBottom: 8,
  },
  traitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  traitLabel: {
    fontSize: 13,
    color: '#94a3b8',
  },
  traitValue: {
    fontSize: 13,
    color: '#f8fafc',
    fontWeight: '600',
  },
  colorIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  colorDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#fff',
  },
  summaryText: {
    fontSize: 12,
    color: '#cbd5e1',
    fontStyle: 'italic',
    lineHeight: 18,
    marginTop: 12,
    marginBottom: 18,
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: 10,
    borderRadius: 10,
  },
  confirmButton: {
    backgroundColor: '#00f5d4',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  confirmButtonText: {
    fontWeight: 'bold',
    fontSize: 14,
    color: '#0b0712',
  },
  cancelButton: {
    paddingVertical: 10,
  },
  cancelButtonText: {
    color: '#94a3b8',
    fontSize: 13,
  },
});
