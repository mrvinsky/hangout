import React, { useEffect } from 'react';
import { View, StyleSheet, NativeModules, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { PetProfile } from '../types/pet';

interface ARScreenProps {
  profile: PetProfile;
  onOpenUpload: () => void;
  onOpenMemorial: () => void;
}

export const ARScreen: React.FC<ARScreenProps> = () => {
  const [permission, requestPermission] = useCameraPermissions();

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission]);

  // Expo Go Metro dev server adresini al
  const scriptURL = (NativeModules as any)?.SourceCode?.scriptURL;
  const devHost = scriptURL?.match(/^https?:\/\/[^/]+/)?.[0] || 'http://192.168.1.100:8081';

  if (!permission) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ffd166" />
        <Text style={styles.loadingText}>Kamera başlatılıyor...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionIcon}>📸</Text>
        <Text style={styles.permissionTitle}>Kamera İzni Gerekli</Text>
        <Text style={styles.permissionMessage}>
          EternalPaws AR, evcil hayvanını gerçek odanda gezdirebilmen için kamerana ihtiyaç duyar.
        </Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Kamerayı Etkinleştir</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 1. Gerçek Donanımsal Arka Kamera (Native Camera Feed) */}
      <CameraView style={StyleSheet.absoluteFill} facing="back" />

      {/* 2. 3D WebGL Patronus Kedisi & Kontroller (Şeffaf Overlay) */}
      <WebView
        source={{ uri: devHost }}
        style={styles.webview}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={['*']}
        mixedContentMode="always"
        mediaCapturePermissionGrantType="grant"
        androidCameraPermissionOptions={{
          title: 'Kamera İzni',
          message: 'AR için kameraya erişim izni gerekiyor',
          buttonPositive: 'İzin Ver',
          buttonNegative: 'İptal',
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0c0814',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#ffd166',
    marginTop: 16,
    fontSize: 14,
    fontWeight: 'bold',
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: '#0c0814',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  permissionIcon: {
    fontSize: 54,
    marginBottom: 16,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffd166',
    marginBottom: 10,
    textAlign: 'center',
  },
  permissionMessage: {
    fontSize: 13,
    color: '#cbd5e1',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
  },
  permissionButton: {
    backgroundColor: '#ffd166',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 16,
  },
  permissionButtonText: {
    color: '#0b0712',
    fontWeight: 'bold',
    fontSize: 15,
  },
});
