import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, Platform } from 'react-native';
import { deletePet, loadMemories, loadPets } from '../services/petStorage';
import { PetProfile } from '../types/pet';

interface MemorialScreenProps {
  activePetId: string;
  onSelectPet: (profile: PetProfile) => void;
  onClose: () => void;
}

const PATTERN_LABELS: Record<PetProfile['coatPattern'], string> = {
  solid: 'Düz',
  tabby: 'Tekir',
  bicolor: 'İki Renk',
  calico: 'Calico',
  points: 'Siyam',
};

/** Anı Defteri: kayıtlı petler ve onlarla yapılan konuşmalar */
export const MemorialScreen: React.FC<MemorialScreenProps> = ({ activePetId, onSelectPet, onClose }) => {
  const [pets, setPets] = useState<PetProfile[]>(() => loadPets());
  const [memories, setMemories] = useState(() => loadMemories());

  const handleDelete = (id: string) => {
    deletePet(id);
    setPets(loadPets());
    setMemories(loadMemories());
  };

  const petName = (id: string) => pets.find((p) => p.id === id)?.name || 'Dost';

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>📖 Anı Defteri</Text>

        <Text style={styles.sectionTitle}>Kayıtlı Dostların</Text>
        {pets.length === 0 && (
          <Text style={styles.emptyText}>Henüz kayıtlı bir hayvan yok. "Yeni Hayvan" ile fotoğrafını yükleyebilirsin.</Text>
        )}
        {pets.map((pet) => {
          const isActive = pet.id === activePetId;
          return (
            <View key={pet.id} style={[styles.petCard, isActive && styles.petCardActive]}>
              {pet.photoUri ? (
                <Image source={{ uri: pet.photoUri }} style={styles.thumb} />
              ) : (
                <View style={[styles.thumb, { backgroundColor: pet.furColorHex }]} />
              )}
              <View style={styles.petInfo}>
                <Text style={styles.petName} numberOfLines={1}>{pet.name}</Text>
                <Text style={styles.petMeta} numberOfLines={1}>{pet.breed}</Text>
                <View style={styles.colorRow}>
                  <View style={[styles.dot, { backgroundColor: pet.furColorHex }]} />
                  {pet.secondaryColorHex && <View style={[styles.dot, { backgroundColor: pet.secondaryColorHex }]} />}
                  <View style={[styles.dot, { backgroundColor: pet.eyeColorHex }]} />
                  <Text style={styles.petMeta}>{PATTERN_LABELS[pet.coatPattern]}</Text>
                </View>
              </View>
              <View style={styles.actions}>
                {isActive ? (
                  <Text style={styles.activeLabel}>Aktif</Text>
                ) : (
                  <TouchableOpacity style={styles.selectBtn} onPress={() => onSelectPet(pet)}>
                    <Text style={styles.selectBtnText}>Çağır</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => handleDelete(pet.id)}>
                  <Text style={styles.deleteText}>Sil</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

        <Text style={[styles.sectionTitle, { marginTop: 22 }]}>Son Konuşmalar</Text>
        {memories.length === 0 && <Text style={styles.emptyText}>"Seslen" ile konuştuklarınız burada saklanır.</Text>}
        {memories.slice(0, 30).map((m) => (
          <View key={m.id} style={styles.memoryCard}>
            <Text style={styles.memoryDate}>
              {petName(m.petId)} · {new Date(m.createdAt).toLocaleString('tr-TR')}
            </Text>
            <Text style={styles.memoryUser}>Sen: {m.userText}</Text>
            <Text style={styles.memoryPet}>{m.petReply}</Text>
          </View>
        ))}

        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeButtonText}>AR'a Geri Dön</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0c0814' },
  scrollContent: {
    padding: 16,
    paddingTop: Platform.OS === 'web' ? 24 : 48,
    paddingBottom: 40,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },
  title: { fontSize: 20, fontWeight: 'bold', color: '#ffd166', textAlign: 'center', marginBottom: 18 },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', color: '#e2e8f0', marginBottom: 10 },
  emptyText: { fontSize: 12, color: '#94a3b8', lineHeight: 17 },
  petCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  petCardActive: { borderColor: '#ffd166' },
  thumb: { width: 54, height: 54, borderRadius: 12 },
  petInfo: { flex: 1, marginHorizontal: 12 },
  petName: { fontSize: 15, fontWeight: 'bold', color: '#ffd166' },
  petMeta: { fontSize: 11, color: '#cbd5e1', marginTop: 2 },
  colorRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  actions: { alignItems: 'center', gap: 8 },
  activeLabel: { fontSize: 11, color: '#ffd166', fontWeight: 'bold' },
  selectBtn: { backgroundColor: '#ffd166', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  selectBtnText: { color: '#0b0712', fontWeight: 'bold', fontSize: 12 },
  deleteText: { color: '#f87171', fontSize: 11 },
  memoryCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#ffd166',
  },
  memoryDate: { fontSize: 10, color: '#94a3b8', marginBottom: 4 },
  memoryUser: { fontSize: 12, color: '#e2e8f0', marginBottom: 4 },
  memoryPet: { fontSize: 12, color: '#cbd5e1', fontStyle: 'italic', lineHeight: 17 },
  closeButton: {
    marginTop: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
  },
  closeButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
});
