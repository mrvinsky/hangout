import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput } from 'react-native';
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
    if (navigator?.mediaDevices?.getUserMedia && videoRef.current) {
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
          position: 'fixed' as any,
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          objectFit: 'cover',
          zIndex: 1,
          transform: 'scaleX(-1)',
        }}
      />
      <div
        id="simulatedRoom"
        style={{
          position: 'fixed' as any,
          inset: 0,
          background: 'radial-gradient(circle at center, #1b1627 0%, #08060e 100%)',
          zIndex: 1,
          display: 'none',
        }}
      />

      {/* 3D WebGL Canvas */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'fixed' as any,
          inset: 0,
          width: '100vw',
          height: '100vh',
          zIndex: 5,
        }}
      />

      {/* HUD Üst Bar */}
      <View style={styles.topBar}>
        <View>
          <Text style={styles.petTitle}>
            {mode === 'patronus' ? '✨ ' + profile.patronusTitle : '🐾 ' + profile.name}
          </Text>
          <Text style={styles.petSubtitle}>{profile.breed}</Text>
        </View>
        <TouchableOpacity style={styles.modeBadge} onPress={toggleMode}>
          <Text style={styles.modeBadgeText}>
            {mode === 'patronus' ? '👑 Patronus' : '🐾 Canlı Mod'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Alt Kontrol Barı */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.glassButton} onPress={handlePet}>
          <Text style={styles.btnIcon}>🖐️</Text>
          <Text style={styles.btnLabel}>Sev & Okşa</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.mainSpellBtn}
          onPress={() => engineRef.current?.summon()}
        >
          <Text style={styles.spellBtnIcon}>🪄</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.glassButton} onPress={() => setChatVisible(true)}>
          <Text style={styles.btnIcon}>💬</Text>
          <Text style={styles.btnLabel}>Seslen</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.glassButton} onPress={onOpenUpload}>
          <Text style={styles.btnIcon}>📸</Text>
          <Text style={styles.btnLabel}>Yeni Hayvan</Text>
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
  },
  topBar: {
    position: 'absolute',
    top: 20,
    left: 16,
    right: 16,
    zIndex: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(18, 14, 26, 0.75)',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  petTitle: {
    fontFamily: 'Cinzel',
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffd166',
  },
  petSubtitle: {
    fontSize: 12,
    color: '#cbd5e1',
    marginTop: 2,
  },
  modeBadge: {
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    borderWidth: 1,
    borderColor: '#ffd166',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  modeBadgeText: {
    color: '#ffd166',
    fontSize: 12,
    fontWeight: 'bold',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    zIndex: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  glassButton: {
    backgroundColor: 'rgba(18, 14, 26, 0.75)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  btnIcon: {
    fontSize: 20,
  },
  btnLabel: {
    fontSize: 11,
    color: '#e2e8f0',
    marginTop: 4,
  },
  mainSpellBtn: {
    backgroundColor: '#ffd166',
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: 'center',
    alignItems: 'center',
    boxShadow: '0 0 24px rgba(255, 209, 102, 0.7)' as any,
  },
  spellBtnIcon: {
    fontSize: 32,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#1b1429',
    width: '100%',
    maxWidth: 380,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 215, 0, 0.4)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffd166',
    marginBottom: 16,
  },
  replyBox: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    padding: 14,
    borderRadius: 14,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#ffd166',
  },
  replyText: {
    color: '#e2e8f0',
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  chatInput: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    marginBottom: 16,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 12,
  },
  modalActionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
  },
  actionBtnText: {
    fontWeight: 'bold',
    fontSize: 14,
    color: '#0b0712',
  },
});
