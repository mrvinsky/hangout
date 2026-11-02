import React from 'react';
import { View, StyleSheet, NativeModules, Text, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { PetProfile } from '../types/pet';

interface ARScreenProps {
  profile: PetProfile;
  onOpenUpload: () => void;
  onOpenMemorial: () => void;
}

export const ARScreen: React.FC<ARScreenProps> = () => {
  // Expo Go Metro dev server adresini dinamik al
  const scriptURL = (NativeModules as any)?.SourceCode?.scriptURL;
  const devHost = scriptURL?.match(/^https?:\/\/[^/]+/)?.[0] || 'http://192.168.1.100:8081';

  return (
    <View style={styles.container}>
      <WebView
        source={{ uri: devHost }}
        style={styles.webview}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={['*']}
        mixedContentMode="always"
        renderLoading={() => (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#ffd166" />
            <Text style={styles.loadingText}>✨ Patronus AR Yükleniyor...</Text>
          </View>
        )}
        startInLoadingState
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
    backgroundColor: '#000',
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
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
});
