import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, Platform } from 'react-native';
import { PetCompanionEngine } from '../engine3d/PetCompanionEngine';
import { PetProfile } from '../types/pet';
import { generatePetMessage } from '../services/geminiService';

interface ARScreenProps {
  profile: PetProfile;
  onOpenUpload: () => void;
  onOpenMemorial: () => void;
}

export const ARScreen: React.FC<ARScreenProps> = ({ profile, onOpenUpload, onOpenMemorial }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const engineRef = useRef<PetCompanionEngine | null>(null);

  const [mode, setMode] = useState<'patronus' | 'living'>(profile.mode);
  const [chatVisible, setChatVisible] = useState(false);
  const [userSpeech, setUserSpeech] = useState('');
  const [petReply, setPetReply] = useState('');
  const [isReplying, setIsReplying] = useState(false);

  useEffect(() => {
    // 1. Kamera Akışını Başlat
    if (typeof navigator !== 'undefined' && navigator?.mediaDevices?.getUserMedia && videoRef.current) {
      navigator.mediaDevices
        .getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        })
        .then((stream) => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play();
          }
        })
        .catch((err) => console.warn('Kamera açılamadı, simüle oda aktif:', err));
    }

    // 2. Three.js AR Motorunu Başlat
    if (canvasRef.current && !engineRef.current) {
      engineRef.current = new PetCompanionEngine(canvasRef.current, profile);
      engineRef.current.start();
    }

    return () => {
      if (engineRef.current) {
        engineRef.current.stop();
        engineRef.current = null;
      }
    };
  }, []);

  // Profil değiştiğinde 3D Motoru canlı güncelle
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.updateProfile(profile);
      setMode(profile.mode);
    }
  }, [profile]);

  const toggleMode = () => {
    const nextMode = mode === 'patronus' ? 'living' : 'patronus';
    setMode(nextMode);
    if (engineRef.current) {
      engineRef.current.setMode(nextMode);
    }
  };

  const handlePet = () => {
    if (engineRef.current) {
      engineRef.current.petPet();
    }
  };

  const handleSendSpeech = async () => {
    if (!userSpeech.trim()) return;
    setIsReplying(true);
    const reply = await generatePetMessage(profile.name, userSpeech);
    setPetReply(reply);
    setIsReplying(false);
    setUserSpeech('');
  };

  return (
    <View style={styles.container}>
      {/* Kamera Arka Planı (Web) */}
      <video
        ref={videoRef}
        playsInline
        autoPlay
        muted
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          zIndex: 1,
          transform: 'scaleX(-1)',
        }}
      />

      {/* 3D WebGL Canvas */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 5,
          touchAction: 'none',
        }}
      />

      {/* HUD Üst Bar (Mobil Çentik & Güvenli Alan Uyumlu) */}
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <Text style={styles.petTitle} numberOfLines={1}>
            {mode === 'patronus' ? '✨ ' + profile.patronusTitle : '🐾 ' + profile.name}
          </Text>
          <Text style={styles.petSubtitle} numberOfLines={1}>
            {profile.breed}
          </Text>
        </View>
        <TouchableOpacity style={styles.modeBadge} onPress={toggleMode}>
          <Text style={styles.modeBadgeText}>
            {mode === 'patronus' ? '👑 Patronus' : '🐾 Canlı'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Alt Kontrol Barı (Responsive Esnek Flexbox) */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.glassButton} onPress={handlePet}>
          <Text style={styles.btnIcon}>🖐️</Text>
          <Text style={styles.btnLabel} numberOfLines={1}>Okşa</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.mainSpellBtn}
          onPress={() => engineRef.current?.summon()}
        >
          <Text style={styles.spellBtnIcon}>🪄</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.glassButton} onPress={() => setChatVisible(true)}>
          <Text style={styles.btnIcon}>💬</Text>
          <Text style={styles.btnLabel} numberOfLines={1}>Seslen</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.glassButton} onPress={onOpenUpload}>
          <Text style={styles.btnIcon}>📸</Text>
          <Text style={styles.btnLabel} numberOfLines={1}>Yeni Hayvan</Text>
        </TouchableOpacity>
      </View>

      {/* Konuşma / Ruhani Bağ Modalı */}
      <Modal visible={chatVisible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>💬 {profile.name} ile İletişim</Text>
            {petReply ? (
              <View style={styles.replyBox}>
                <Text style={styles.replyText}>{petReply}</Text>
              </View>
            ) : null}
            <TextInput
              style={styles.chatInput}
              placeholder={`${profile.name}'e bir şeyler söyle...`}
              placeholderTextColor="#94a3b8"
              value={userSpeech}
              onChangeText={setUserSpeech}
            />
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={[styles.modalActionBtn, { backgroundColor: '#ffd166' }]}
                onPress={handleSendSpeech}
                disabled={isReplying}
              >
                <Text style={styles.actionBtnText}>{isReplying ? 'Dinliyor...' : 'Söyle'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalActionBtn, { backgroundColor: 'rgba(255,255,255,0.15)' }]}
                onPress={() => { setChatVisible(false); setPetReply(''); }}
              >
                <Text style={[styles.actionBtnText, { color: '#fff' }]}>Kapat</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    position: 'relative',
    overflow: 'hidden',
    width: '100%',
    height: '100%',
  },
  topBar: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 12 : 44,
    left: 10,
    right: 10,
    zIndex: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(18, 14, 26, 0.85)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.35)',
  },
  topBarLeft: {
    flex: 1,
    marginRight: 8,
  },
  petTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ffd166',
  },
  petSubtitle: {
    fontSize: 11,
    color: '#cbd5e1',
    marginTop: 2,
  },
  modeBadge: {
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    borderWidth: 1,
    borderColor: '#ffd166',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  modeBadgeText: {
    color: '#ffd166',
    fontSize: 11,
    fontWeight: 'bold',
  },
  bottomBar: {
    position: 'absolute',
    bottom: Platform.OS === 'web' ? 16 : 30,
    left: 10,
    right: 10,
    zIndex: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 6,
  },
  glassButton: {
    flex: 1,
    maxWidth: 82,
    backgroundColor: 'rgba(18, 14, 26, 0.85)',
    paddingVertical: 8,
    paddingHorizontal: 2,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  btnIcon: {
    fontSize: 18,
  },
  btnLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#e2e8f0',
    marginTop: 3,
    textAlign: 'center',
  },
  mainSpellBtn: {
    backgroundColor: '#ffd166',
    width: 58,
    height: 58,
    borderRadius: 29,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 2,
    boxShadow: '0 0 20px rgba(255, 209, 102, 0.8)' as any,
  },
  spellBtnIcon: {
    fontSize: 26,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#1b1429',
    width: '100%',
    maxWidth: 380,
    borderRadius: 22,
    padding: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 215, 0, 0.4)',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#ffd166',
    marginBottom: 14,
  },
  replyBox: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    padding: 12,
    borderRadius: 12,
    marginBottom: 14,
    borderLeftWidth: 3,
    borderLeftColor: '#ffd166',
  },
  replyText: {
    color: '#e2e8f0',
    fontSize: 13,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  chatInput: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    marginBottom: 14,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modalActionBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: 'center',
  },
  actionBtnText: {
    fontWeight: 'bold',
    fontSize: 13,
    color: '#0b0712',
  },
});
