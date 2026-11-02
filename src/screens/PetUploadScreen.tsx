import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Platform,
} from 'react-native';
import { analyzePetPhoto } from '../services/geminiService';
import { PetAnalysisResult, PetProfile } from '../types/pet';

interface PetUploadScreenProps {
  onPetCreated: (profile: PetProfile) => void;
  onCancel: () => void;
}

const FUR_PRESETS = [
  { label: 'Duman Grisi', hex: '#6b7280' },
  { label: 'Sarman Turuncu', hex: '#e76f51' },
  { label: 'Gece Siyahı', hex: '#212529' },
  { label: 'Kar Beyazı', hex: '#f8f9fa' },
  { label: 'Krem / Bal', hex: '#fde047' },
  { label: 'Çikolata', hex: '#582f0e' },
];

const EYE_PRESETS = [
  { label: 'Kehribar', hex: '#ffb703' },
  { label: 'Zümrüt', hex: '#22c55e' },
  { label: 'Safir Mavi', hex: '#3b82f6' },
  { label: 'Bakır', hex: '#ea580c' },
];

export const PetUploadScreen: React.FC<PetUploadScreenProps> = ({ onPetCreated, onCancel }) => {
  const [photoUri, setPhotoUri] = useState<string>('ozzy_frame.jpg');
  const [base64Data, setBase64Data] = useState<string>('');
  const [petName, setPetName] = useState<string>('Boban');
  const [apiKey, setApiKey] = useState<string>('');
  const [showKeyInput, setShowKeyInput] = useState<boolean>(false);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [selectedFur, setSelectedFur] = useState<string>('#6b7280');
  const [selectedEye, setSelectedEye] = useState<string>('#ffb703');
  const [analysis, setAnalysis] = useState<PetAnalysisResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Web / Mobil dosya seçici tetikle
  const handlePickImage = () => {
    if (Platform.OS === 'web' && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: any) => {
    const file = e.target?.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        setPhotoUri(result);
        setBase64Data(result);
        sampleImageColor(result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Yüklenen görselin piksellerinden otomatik renk tespiti
  const sampleImageColor = (imageSrc: string) => {
    if (typeof window === 'undefined') return;
    const img = new (window as any).Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, 32, 32);
          const data = ctx.getImageData(0, 0, 32, 32).data;
          let r = 0, g = 0, b = 0, count = 0;
          for (let i = 0; i < data.length; i += 16) {
            r += data[i];
            g += data[i + 1];
            b += data[i + 2];
            count++;
          }
          const avgR = Math.round(r / count);
          const avgG = Math.round(g / count);
          const avgB = Math.round(b / count);
          const hex = `#${((1 << 24) + (avgR << 16) + (avgG << 8) + avgB).toString(16).slice(1)}`;
          setSelectedFur(hex);
        }
      } catch (err) {
        console.warn('Renk analizi hatası:', err);
      }
    };
    img.src = imageSrc;
  };

  const handleStartAnalysis = async () => {
    setIsAnalyzing(true);
    const result = await analyzePetPhoto(base64Data || 'mock_data', apiKey || undefined);
    setAnalysis(result);
    setSelectedFur(result.furColorHex || selectedFur);
    setSelectedEye(result.eyeColorHex || selectedEye);
    if (!petName || petName === 'Boban') {
      const inferredName = result.patronusTitle.split(' ')[0] || 'Dost';
      setPetName(inferredName);
    }
    setIsAnalyzing(false);
  };

  const handleConfirm = () => {
    const finalProfile: PetProfile = {
      id: 'pet_' + Date.now(),
      name: petName.trim() || 'Boban',
      breed: analysis?.breed || 'British Shorthair (British Blue)',
      species: analysis?.species || 'cat',
      eyeColorHex: selectedEye,
      furColorHex: selectedFur,
      secondaryColorHex: analysis?.secondaryColorHex || '#9ca3af',
      coatPattern: analysis?.coatPattern || 'solid',
      personality: analysis?.personality || 'Asil ve Sevgi Dolu Muhafız',
      patronusTitle: analysis?.patronusTitle || `Lord ${petName || 'Boban'} the Guardian`,
      mode: 'patronus',
      photoUri: photoUri,
      createdAt: Date.now(),
    };
    onPetCreated(finalProfile);
  };

  return (
    <View style={styles.container}>
      {/* Gizli Web Dosya Seçici */}
      {Platform.OS === 'web' && (
        <input
          ref={fileInputRef as any}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      )}

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>🐾 Yeni Hayvan Canlandır</Text>
        <Text style={styles.subtitle}>
          Fotoğrafını yükle, yapay zeka ve renk motoru onun 3D formunu ve ruhani Patronus'unu hazırlasın.
        </Text>

        {/* Fotoğraf Yükleme & Önizleme Alanı */}
        <TouchableOpacity style={styles.photoContainer} onPress={handlePickImage} activeOpacity={0.85}>
          <Image source={{ uri: photoUri }} style={styles.petImage} resizeMode="cover" />
          <View style={styles.photoOverlayBadge}>
            <Text style={styles.badgeText}>📸 Fotoğraf Değiştir (Tıkla)</Text>
          </View>
        </TouchableOpacity>

        {/* İsim Girişi */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Hayvanının İsmi:</Text>
          <TextInput
            style={styles.textInput}
            value={petName}
            onChangeText={setPetName}
            placeholder="Örn: Boban, Pamuk, Şila, Duman..."
            placeholderTextColor="#64748b"
          />
        </View>

        {/* Kürk Rengi Paleti */}
        <View style={styles.paletteSection}>
          <Text style={styles.sectionTitle}>Kürk Tonu Seçimi:</Text>
          <View style={styles.swatchRow}>
            {FUR_PRESETS.map((p) => {
              const isSelected = selectedFur.toLowerCase() === p.hex.toLowerCase();
              return (
                <TouchableOpacity
                  key={p.hex}
                  style={[
                    styles.swatchBtn,
                    { backgroundColor: p.hex },
                    isSelected && styles.swatchSelected,
                  ]}
                  onPress={() => setSelectedFur(p.hex)}
                >
                  {isSelected && <Text style={styles.checkIcon}>✓</Text>}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Göz Rengi Paleti */}
        <View style={styles.paletteSection}>
          <Text style={styles.sectionTitle}>Göz Rengi Seçimi:</Text>
          <View style={styles.swatchRow}>
            {EYE_PRESETS.map((p) => {
              const isSelected = selectedEye.toLowerCase() === p.hex.toLowerCase();
              return (
                <TouchableOpacity
                  key={p.hex}
                  style={[
                    styles.swatchBtn,
                    { backgroundColor: p.hex },
                    isSelected && styles.swatchSelected,
                  ]}
                  onPress={() => setSelectedEye(p.hex)}
                >
                  {isSelected && <Text style={styles.checkIcon}>✓</Text>}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* İsteğe Bağlı Gemini API Key Butonu */}
        <TouchableOpacity
          style={styles.keyToggleBtn}
          onPress={() => setShowKeyInput(!showKeyInput)}
        >
          <Text style={styles.keyToggleText}>
            {showKeyInput ? '▲ API Anahtarı Kutusunu Gizle' : '⚙️ Kendi Gemini API Anahtarını Kullan (Opsiyonel)'}
          </Text>
        </TouchableOpacity>

        {showKeyInput && (
          <View style={styles.inputGroup}>
            <TextInput
              style={styles.textInput}
              value={apiKey}
              onChangeText={setApiKey}
              placeholder="AIzaSy... (Gemini API Key)"
              placeholderTextColor="#64748b"
              secureTextEntry
            />
          </View>
        )}

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
              <Text style={styles.traitLabel}>Patronus Ünvanı:</Text>
              <Text style={[styles.traitValue, { color: '#ffd166', fontWeight: 'bold' }]}>
                {analysis.patronusTitle}
              </Text>
            </View>

            <Text style={styles.summaryText}>"{analysis.summary}"</Text>
          </View>
        )}

        {/* 3D Canlandır Butonu */}
        <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
          <Text style={styles.confirmButtonText}>⚡ 3D Modelini Canlandır & AR'da Gör</Text>
        </TouchableOpacity>

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
    padding: 16,
    paddingTop: Platform.OS === 'web' ? 24 : 48,
    paddingBottom: 40,
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffd166',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 12,
    color: '#cbd5e1',
    textAlign: 'center',
    marginBottom: 18,
    lineHeight: 16,
    maxWidth: 340,
  },
  photoContainer: {
    width: '100%',
    maxWidth: 260,
    height: 240,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255, 215, 0, 0.45)',
    position: 'relative',
    marginBottom: 16,
  },
  petImage: {
    width: '100%',
    height: '100%',
  },
  photoOverlayBadge: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  badgeText: {
    color: '#ffd166',
    fontSize: 11,
    fontWeight: '700',
  },
  inputGroup: {
    width: '100%',
    maxWidth: 340,
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 12,
    color: '#e2e8f0',
    fontWeight: '600',
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  paletteSection: {
    width: '100%',
    maxWidth: 340,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 12,
    color: '#cbd5e1',
    marginBottom: 6,
    fontWeight: '600',
  },
  swatchRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  swatchBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  swatchSelected: {
    borderColor: '#ffd166',
    borderWidth: 3,
    transform: [{ scale: 1.08 }],
  },
  checkIcon: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  keyToggleBtn: {
    paddingVertical: 8,
    marginBottom: 6,
  },
  keyToggleText: {
    color: '#94a3b8',
    fontSize: 11,
    textDecorationLine: 'underline',
  },
  analyzeButton: {
    backgroundColor: '#ffd166',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 14,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    marginBottom: 14,
  },
  analyzeButtonText: {
    fontWeight: 'bold',
    fontSize: 14,
    color: '#0b0712',
  },
  resultCard: {
    backgroundColor: '#1b1429',
    width: '100%',
    maxWidth: 340,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
    marginBottom: 14,
  },
  resultHeader: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#ffd166',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    paddingBottom: 6,
  },
  traitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  traitLabel: {
    fontSize: 12,
    color: '#94a3b8',
  },
  traitValue: {
    fontSize: 12,
    color: '#f8fafc',
    fontWeight: '600',
  },
  summaryText: {
    fontSize: 11,
    color: '#cbd5e1',
    fontStyle: 'italic',
    lineHeight: 16,
    marginTop: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: 8,
    borderRadius: 8,
  },
  confirmButton: {
    backgroundColor: '#00f5d4',
    paddingVertical: 13,
    borderRadius: 14,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    marginBottom: 10,
  },
  confirmButtonText: {
    fontWeight: 'bold',
    fontSize: 14,
    color: '#0b0712',
  },
  cancelButton: {
    paddingVertical: 8,
  },
  cancelButtonText: {
    color: '#94a3b8',
    fontSize: 12,
  },
});
