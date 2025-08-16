# 📱 ChemFetch Mobile

**Expo + React Native** mobile app for barcode scanning, OCR, and chemical safety management. Part of the ChemFetch platform for field workers and safety personnel.

This mobile application enables on-site chemical identification, Safety Data Sheet verification, and inventory management through an intuitive touch interface optimized for industrial environments.

---

## ✨ Features

### Core Functionality
- **📸 Barcode Scanning**: EAN-8, EAN-13, and other standard barcode formats
- **🔍 OCR Text Recognition**: Extract product names and details from labels
- **📄 SDS Verification**: Confirm Safety Data Sheet associations and relevance
- **🏷️ Product Identification**: Smart product name and size detection
- **📊 Inventory Management**: Add chemicals to personal or company registers
- **🔗 Offline Capability**: Queue actions for sync when connection available

### User Experience
- **🎯 Intuitive Interface**: Simple, touch-friendly design for field use
- **🌙 Dark Mode Support**: Optimized for various lighting conditions
- **⚡ Fast Performance**: Optimized for quick scanning workflows
- **🔒 Secure Authentication**: User login with role-based permissions
- **📱 Cross-Platform**: Native iOS and Android support via Expo

---

## 🛠️ Tech Stack

### Core Framework
- **React Native 0.79** with Expo 53 for cross-platform development
- **Expo Router 5** for file-based navigation
- **TypeScript** for type safety and better development experience

### UI & Styling
- **NativeWind 4** (Tailwind CSS for React Native)
- **Expo Vector Icons** for consistent iconography
- **React Native Reanimated** for smooth animations
- **React Native Gesture Handler** for touch interactions

### Device Integration
- **Expo Camera 16** for barcode scanning and photo capture
- **Expo Barcode Scanner 13** for barcode recognition
- **Expo File System** for local file management
- **Expo Haptics** for tactile feedback

### State & Data Management
- **Zustand 5** for lightweight state management
- **Supabase** for authentication and data sync
- **React Native Blob Util** for file handling

---

## ⚙️ Quick Start

### Prerequisites
- Node.js 18+ and npm
- Expo CLI: `npm install -g expo-cli`
- iOS Simulator (macOS) or Android Emulator
- Physical device with Expo Go app (recommended)

### 1. Environment Setup

Create `.env` file in project root:
```env
# Supabase Configuration
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Backend API
EXPO_PUBLIC_BACKEND_API_URL=http://your-backend-host:3000
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Start Development Server

```bash
npx expo start
```

**Options:**
- Scan QR code with Expo Go app (iOS/Android)
- Press `i` to open iOS Simulator
- Press `a` to open Android Emulator

### 4. Build for Production

```bash
# Install EAS CLI
npm install -g @expo/eas-cli

# Configure build
eas build:configure

# Build for iOS/Android
eas build --platform all
```

---

## 🎯 Core Screens & Workflows

### Home Screen (`/`)
- **Quick Actions**: Direct access to barcode scanning and manual entry
- **Recent Activity**: Last scanned products and SDS updates
- **Status Overview**: Sync status and pending operations

### Barcode Scanning (`/barcode`)
- **Live Camera View**: Real-time barcode detection with overlay
- **Scan Feedback**: Visual and haptic confirmation of successful scans
- **Manual Entry**: Fallback when barcode cannot be read

### OCR Confirmation (`/confirm`)
- **Image Preview**: Show captured photo with crop overlay
- **Text Extraction**: Display recognized text with confidence scores
- **Manual Editing**: Allow user correction of OCR results

### Product Results (`/results`)
- **Product Information**: Display found product details
- **SDS Association**: Show linked Safety Data Sheet if available
- **Add to Inventory**: Save product to user's chemical register

### SDS Viewer (`/sds-viewer`)
- **PDF Display**: Native PDF viewing with zoom and scroll
- **Download Option**: Save SDS for offline access
- **Share Function**: Send SDS link to colleagues

---

## 🔧 Core Implementation

### Barcode Scanner Integration

```typescript
// app/barcode.tsx
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useState } from 'react';

export default function BarcodeScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    setScanned(true);
    processBarcode(data);
  };

  if (!permission?.granted) {
    return (
      <View className="flex-1 justify-center items-center">
        <Text>Camera permission required for barcode scanning</Text>
        <Button title="Grant Permission" onPress={requestPermission} />
      </View>
    );
  }

  return (
    <CameraView
      className="flex-1"
      onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
      barCodeScannerSettings={{
        barCodeTypes: ['ean13', 'ean8', 'upc_a', 'code128'],
      }}
    >
      <View className="absolute inset-0 justify-center items-center">
        <View className="w-64 h-64 border-2 border-white opacity-50" />
        <Text className="text-white mt-4 text-center">
          Position barcode within the frame
        </Text>
      </View>
    </CameraView>
  );
}
```

### State Management with Zustand

```typescript
// lib/store.ts
import { create } from 'zustand';

interface AppState {
  user: User | null;
  setUser: (user: User | null) => void;
  
  capturedImage: string | null;
  setCapturedImage: (uri: string | null) => void;
  
  currentProduct: Product | null;
  setCurrentProduct: (product: Product | null) => void;
  
  scanHistory: ScannedItem[];
  addToScanHistory: (item: ScannedItem) => void;
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  capturedImage: null,
  currentProduct: null,
  scanHistory: [],
  
  setUser: (user) => set({ user }),
  setCapturedImage: (uri) => set({ capturedImage: uri }),
  setCurrentProduct: (product) => set({ currentProduct: product }),
  
  addToScanHistory: (item) => set((state) => ({
    scanHistory: [item, ...state.scanHistory.slice(0, 49)]
  }))
}));
```

### API Integration

```typescript
// lib/api.ts
class ChemFetchAPI {
  private baseURL: string;
  
  constructor() {
    this.baseURL = process.env.EXPO_PUBLIC_BACKEND_API_URL || 'http://localhost:3000';
  }
  
  async scanBarcode(code: string): Promise<ScanResult> {
    const response = await fetch(`${this.baseURL}/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    });
    
    if (!response.ok) {
      throw new Error(`Scan failed: ${response.statusText}`);
    }
    
    return await response.json();
  }
  
  async processOCR(imageUri: string): Promise<OCRResult> {
    const formData = new FormData();
    formData.append('image', {
      uri: imageUri,
      type: 'image/jpeg',
      name: 'image.jpg'
    } as any);
    
    const response = await fetch(`${this.baseURL}/ocr`, {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      throw new Error(`OCR failed: ${response.statusText}`);
    }
    
    return await response.json();
  }
}

export const api = new ChemFetchAPI();
```

---

## 🔒 Authentication

### Supabase Integration

```typescript
// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  }
});

export const authHelpers = {
  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) throw error;
    return data;
  },
  
  async signUp(email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password
    });
    
    if (error) throw error;
    return data;
  },
  
  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }
};
```

---

## 🧪 Testing

### Unit Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm test -- --watch

# Generate coverage report
npm test -- --coverage
```

---

## 🚀 Deployment

### EAS Build Configuration

```json
// eas.json
{
  "cli": {
    "version": ">= 5.2.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {
      "ios": {
        "bundleIdentifier": "com.chemfetch.mobile"
      },
      "android": {
        "applicationId": "com.chemfetch.mobile"
      }
    }
  }
}
```

### Build Commands

```bash
# Development build
eas build --profile development --platform all

# Preview build for testing
eas build --profile preview --platform all

# Production build
eas build --profile production --platform all

# Submit to app stores
eas submit --profile production --platform all
```

---

## 🔄 Recent Updates

### Version 2024.12

**New Features:**
- ✅ **Enhanced OCR Processing**: Improved text recognition accuracy
- ✅ **Offline Support**: Queue actions when network unavailable
- ✅ **Better Error Handling**: Graceful fallbacks for failed operations
- ✅ **Performance Optimization**: Faster app startup and smoother animations

**UI/UX Improvements:**
- 🎨 **Redesigned Scanning Interface**: Cleaner barcode scanning overlay
- 🎨 **Improved Navigation**: More intuitive tab-based navigation
- 🎨 **Better Feedback**: Enhanced loading states and success indicators
- 🎨 **Dark Mode Refinements**: Better contrast and readability

**Bug Fixes:**
- 🔧 **Camera Permissions**: Fixed permission handling on Android 13+
- 🔧 **OCR Stability**: Resolved crashes with large images
- 🔧 **Memory Management**: Better cleanup of camera resources
- 🔧 **Authentication Flow**: Fixed login persistence issues

---

## 📄 License

This project is proprietary software. All rights reserved.

---

## 👥 Support

**Technical Issues:**
- Check device permissions for camera and storage
- Verify network connectivity for API calls
- Review app logs in development mode

**Device Compatibility:**
- iOS 13.0+ required
- Android API level 21+ (Android 5.0+)
- Camera required for barcode scanning
- Network connection for data sync

---

## 🗺️ Roadmap

### Q1 2025
- **Push Notifications**: Real-time alerts for SDS updates
- **Bulk Scanning**: Process multiple barcodes in sequence
- **Advanced Filters**: Enhanced search and filtering options
- **Export Functions**: Generate PDF reports from mobile

### Q2 2025
- **AR Integration**: Augmented reality chemical identification
- **Voice Commands**: Hands-free operation for industrial use
- **Wearable Support**: Apple Watch and Android Wear integration
- **Multi-language**: Localization for international markets