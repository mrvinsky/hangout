# 🐾 EternalPaws AR (Sonsuz Patiler)
### *AI Destekli Fotoğraftan 3D Evcil Hayvan Canlandırma & Gerçek Dünya AR Deneyimi*

[![Platform](https://img.shields.io/badge/Platforms-Web%20%7C%20iOS%20%7C%20Android-blue.svg)](https://github.com/mrvinsky/hangout)
[![Tech Stack](https://img.shields.io/badge/Stack-React%20Native%20%2F%20Expo%20%7C%20Three.js%20%7C%20Gemini%20AI-orange.svg)](https://github.com/mrvinsky/hangout)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## 📖 1. Misyon & Problem Tanımı

Dünya genelinde evcil hayvanını kaybetmiş ya da üniversite, iş, göç gibi sebeplerle ondan yüzlerce kilometre uzakta yaşayan **milyonlarca insan** var. Bu insanların hissettiği özlem, tüketici teknolojisindeki en güçlü duygusal bağlardan biridir.

**EternalPaws AR**, kullanıcıların kaybettikleri veya uzaktaki evcil hayvanlarının fotoğraflarını yükleyerek:
1. Yapay zeka ile birebir **3D kemikli (rigged) modelini** çıkaran,
2. Hem **Web** hem **Mobil (iOS & Android)** üzerinde kamerayı açtıklarında evcil hayvanlarını odanın zemininde, parkta veya yanlarında adımlarken görmelerini sağlayan,
3. Onlarla sesle, dokunuşla ve oyunla gerçek zamanlı etkileşime girebilecekleri **büyülü bir AR yol arkadaşı (Companion)** ekosistemidir.

---

## ✨ 2. Temel Modlar & Deneyimler

### 🛡️ A. Patronus / Kutsal Muhafız Modu (Spirit Guardian)
* Harry Potter "Expecto Patronum" estetiğinde, gümüş ve altın ışıltılı parçacıklardan oluşan kutsal form.
* Başının üzerinde süzülen altın taç / hale.
* Gövdesinden havaya yavaşça süzülen ilahi ışık buharı.
* Karanlık ruhları ve kötü enerjileri uzaklaştıran koruyucu kalkan rolü.

### 🐾 B. Gerçekçi Yaşam Modu (Living Companion)
* Hayvanın orijinal kürk dokusu, göz rengi ve pati desenleri.
* Nefes alma, esneme, mırlama ve doğal adımlama fiziği.
* Ekrana dokunarak başını okşama ve sevme (haptic feedback & sesli mırlama tepkisi).

### 🌍 C. Gerçek Dünya Etkileşimi
* **Zemin ve Düzlem Algılama (Plane Detection):** Kedi/köpek havada uçmaz; halıya, parkeye veya çimene basar.
* **Birlikte Yürüme (AR Pedometer):** Dışarıda yürürken kullanıcının adımlarıyla birlikte yanında ilerler.
* **Fotoğraf & Video Anı Defteri:** Gerçek dünyada onunla yan yana fotoğraflar çekip anı defterine (Memory Vault) kaydetme.
* **Sesli İletişim (Gemini Voice):** İsmiyle seslenildiğinde kulaklarını dikip sana doğru bakması.

---

## 🏗️ 3. Sistem Mimarisi

Sistem, tek bir kod tabanı üzerinden **Web, iOS ve Android** ortamlarını aynı anda besleyen birleştirilmiş bir mimariye sahiptir.

```mermaid
flowchart TD
    subgraph Client Layer [1. İstemci Katmanı (Cross-Platform)]
        W[Web Uygulaması - WebGL / Three.js]
        M_IOS[iOS App - Expo / ARKit]
        M_AND[Android App - Expo / ARCore]
    end

    subgraph Core Engine [2. Çekirdek AR & 3D Motoru]
        GL[Three.js + Expo-GL]
        AR[Zemin Algılama & Gölgelendirme]
        PHYS[4 Ayaklı Yürüyüş Fiziği & İskelet]
    end

    subgraph AI Pipeline [3. Çok Katmanlı Yapay Zeka Hattı]
        G_VIS[Gemini Vision: Irk, Doku & Göz Analizi]
        GEN_3D[Trellis / Tripo3D API: Fotoğraftan 3D Mesh]
        RIG[Auto-Rigging: İskelet & Kemik Giydirme]
        G_CHAT[Gemini Brain: Karakter, Ses & Duygusal Yanıt]
    end

    subgraph Backend [4. Bulut & Veri Katmanı]
        API[Node.js / Next.js Serverless API]
        S3[Cloudflare R2 / AWS S3: 3D Model Deposu]
        DB[PostgreSQL / Supabase: Kullanıcı & Hayvan Profilleri]
    end

    Client Layer --> Core Engine
    Client Layer --> Backend
    Backend --> AI Pipeline
    AI Pipeline --> S3
    S3 --> Core Engine
```

---

## 🧬 4. Fotoğraftan 3D'ye: AI İşlem Hattı (Pipeline)

Kullanıcı 1 adet fotoğraf yüklediğinde arkada gerçekleşen 4 adımlı süreç:

| Adım | Servis | Görev | Süre | Maliyet |
| :--- | :--- | :--- | :--- | :--- |
| **1. Görsel Analiz** | **Gemini 2.0 Flash Vision** | Fotoğraftan hayvanın cinsini, tüy dağılımını, renk kodlarını (HEX) ve göz rengini JSON olarak çıkarır. | ~0.5 sn | ~\$0.0001 |
| **2. 3D Model Üretimi** | **Trellis / Tripo3D API** | Fotoğraftan 3 boyutlu `.glb` dosyasını üretir. | ~15 sn | ~\$0.03 |
| **3. Kemikleme (Rigging)** | **Parametrik Rig / Auto-Rig** | Dört ayaklı yürüyüş için 29 kemikli standart iskeleti modele iliştirir. | ~2 sn | Ücretsiz |
| **4. AR Optimizasyonu** | **gltf-transform / Draco** | Poligon sayısını mobil cihazlarda 60 FPS akacak şekilde küçültür (< 3 MB). | ~0.8 sn | Ücretsiz |

---

## 💻 5. Teknoloji Yığını (Tech Stack)

### İstemci & 3D
* **Framework:** React Native + Expo (Tek kod ile Web + iOS + Android)
* **3D Motoru:** Three.js (r128+) & `@react-three/fiber`
* **WebGL Köprüsü:** `expo-gl` (Mobil için donanım hızlandırmalı WebGL)
* **Kamera & Sensörler:** Expo Camera + WebRTC `getUserMedia` + DeviceOrientation Gyroscope

### Yapay Zeka & Backend
* **Vision & NLP:** Google Gemini 2.0 API (Flash & Pro)
* **3D Generation API:** Tripo3D OpenAPI / Replicate Trellis API
* **Backend:** Next.js 14 API Routes (Edge Runtime)
* **Depolama:** Cloudflare R2 / AWS S3 (GLB modelleri ve optimize dokular için CDN)
* **Veritabanı:** Supabase (Kullanıcı hesapları, anılar, kayıtlı hayvanlar)

---

## 📂 6. Proje Dizin Yapısı

```
eternalpaws-ar/
├── assets/                  # 3D modeller, dokular ve ses efektleri
│   ├── models/             # Temel şablon GLB modelleri (Cat, Dog)
│   ├── textures/           # Kürk ve zemin kontak gölgeleri
│   └── audio/              # Mırlama, adım ve büyü ses efektleri
├── src/
│   ├── components/         # Ortak UI bileşenleri (Web & Mobile)
│   │   ├── CameraView.tsx  # Kamera arka planı katmanı
│   │   ├── HUD.tsx         # Can, süre, büyü ve kontrol arayüzü
│   │   └── UploadModal.tsx # Fotoğraf yükleme ve analiz modalı
│   ├── engine3d/           # Three.js 3D ve AR Çekirdeği
│   │   ├── SceneManager.ts # WebGL sahnesi, ışıklar ve kamera
│   │   ├── PetEntity.ts    # 3D Evcil hayvan sınıfı (yürüyüş, kemikler)
│   │   ├── ParticleSystem.ts # Patronus ve duman parçacık sistemleri
│   │   └── GroundPlane.ts  # Zemin gölgesi ve ışık havuzu
│   ├── services/           # Dış API servisleri
│   │   ├── geminiVision.ts # Fotoğraf analiz ve renk çıkarma
│   │   ├── modelGenerator.ts # Tripo/Trellis 3D üretim köprüsü
│   │   └── petBrain.ts     # Hayvan kişiliği ve konuşma servisi
│   └── screens/            # Ekranlar
│       ├── ARScreen.tsx    # Ana AR etkileşim ekranı
│       └── MemorialScreen.tsx # Anı ve fotoğraf galerisi
├── app.json                # Expo mobil yapılandırması
├── package.json            # Bağımlılıklar
└── README.md               # Detaylı proje dokümantasyonu
```

---

## 🚀 7. Kurulum & Yerel Çalıştırma

### Gereksinimler
* Node.js v18+ 
* npm veya pnpm
* (Mobil test için) Telefonda **Expo Go** uygulaması

### Adım 1: Depoyu Klonlayın
```bash
git clone https://github.com/mrvinsky/hangout.git
cd hangout
```

### Adım 2: Bağımlılıkları Yükleyin
```bash
npm install
```

### Adım 3: Ortam Değişkenlerini Ayarlayın
`.env.example` dosyasını `.env` olarak kopyalayın:
```bash
cp .env.example .env
```
Gerekli API anahtarlarını girin:
```env
GEMINI_API_KEY="AIzaSy..."
TRIPO_API_KEY="tripo_..."
NEXT_PUBLIC_APP_URL="http://localhost:8080"
```

### Adım 4: Geliştirme Sunucusunu Başlatın
```bash
# Web sürümünü test etmek için:
npm run web

# Mobil sürümü (Expo) test etmek için:
npx expo start
```
* Tarayıcıda: `http://localhost:8080`
* Mobilde: Terminalde çıkan QR kodu telefonun kamerasıyla okutun.

---

## 📅 8. Geliştirme Yol Haritası (Roadmap)

### Faz 1: Çekirdek & MVP (Şu Anki Aşama) ✅
- [x] Three.js WebGL ortamında 3D kedi iskeleti ve yürüyüş fiziği.
- [x] Kutsal Patronus parçacık birleşme (Convergence) efekti.
- [x] Kehribar gözler, zemin kontak gölgesi ve kutsal aura.
- [x] Mobil uyumlu relative gyro ve dokunmatik kamera kontrolleri.

### Faz 2: AI Entegrasyonu & Fotoğraftan Canlandırma 🔄
- [ ] Gemini Vision ile fotoğraftan kürk rengi, desen ve göz çıkarma servisi.
- [ ] Tripo3D / Trellis API ile fotoğraftan `.glb` model üretim hattı.
- [ ] Fotoğraf yükleme ve 15 saniyede canlı 3D önizleme arayüzü.

### Faz 3: Mobil AR & Zemin Algılama 📱
- [ ] Expo + ARKit / ARCore zemin algılama (Plane Detection).
- [ ] Dokunarak sevme, mırlama ve çağrıldığında yanına gelme animasyonları.
- [ ] Hayvanla fotoğraf çekme ve sosyal medyada paylaşma özelliği.

### Faz 4: Ruh & Ses (AI Pet Brain) 🎙️
- [ ] Kullanıcının sesini algılayıp tepki verme (Miyavlama / Havlama / Baş eğme).
- [ ] Kullanıcıyla duygusal bağ kuran anı defteri ve sohbet özelliği.

---

## 🤝 Katkıda Bulunma & İletişim

Bu proje, sevdiklerimizin hatırasını en ileri teknolojiyle yaşatmak için geliştirilmektedir. Öneri, hata bildirimi ve katkılarınız için Issue ve Pull Request açabilirsiniz.

* **Lisans:** MIT License
* **Geliştirici:** Antigravity & Wingman Team ⚡
