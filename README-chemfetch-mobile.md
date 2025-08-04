# ChemFetch Mobile

**Expo + React Native** mobile app for barcode scanning, OCR, and SDS lookup, part of the ChemFetch platform.

---

## 🔗 Related Repositories

| Repo                 | Purpose                                                     |
| -------------------- | ----------------------------------------------------------- |
| **chemfetch-mobile** | **(This repo)** Expo app for barcode scanning & SDS capture |
| chemfetch-client-hub | Web dashboard for chemical register management              |
| chemfetch-admin-hub  | Internal admin panel for support                            |
| chemfetch-backend    | Node.js API server for OCR, scraping, and SDS logic         |
| chemfetch-supabase   | Supabase migrations, schema, and SQL types                  |

---

## ✨ Features

* EAN-8 and EAN-13 barcode scanning via `expo-camera` (CameraView)
* Manual region cropping for OCR with interactive handles (CropOverlay component)
* OCR integration through PaddleOCR microservice (via backend proxy)
* Bing web scraping fallback for product name & size lookup
* SDS URL detection and auto-association
* Manual entry support when data is ambiguous
* Zustand global store for photo & crop state
* NativeWind (Tailwind) styling with custom color palette
* SDS viewing in-app via `react-native-webview`

---

## 🛠️ Tech Stack

* React Native + [Expo Router](https://expo.github.io/router/)
* [NativeWind](https://www.nativewind.dev/) (Tailwind CSS for RN)
* Zustand for global state management
* `@supabase/supabase-js` client SDK
* `expo-camera` for barcode scanning and capture
* `expo-router`, `react-native-safe-area-context`, and `@react-navigation/native` for navigation
* `react-native-webview` for SDS PDF viewing
* TypeScript for type safety

---

## 📁 Project Structure

```
chemfetch-mobile/
├── app/                         # Expo Router-based screens
│   ├── index.tsx                # Home screen
│   ├── barcode.tsx              # Barcode scanning screen
│   ├── confirm.tsx              # OCR confirmation & manual edit screen
│   ├── results.tsx              # Product & SDS lookup results screen
│   ├── register.tsx             # Chemical watch list screen
│   ├── sds-viewer.tsx           # SDS PDF viewer screen
│   └── _layout.tsx              # Auth check & bottom tab layout
├── components/                  # Reusable UI components
│   ├── CropOverlay.tsx          # Interactive crop handles using PanResponder
│   └── SizePromptModal.tsx      # Manual input modal for size/weight
├── lib/                         # Shared libraries and global state
│   ├── constants.ts             # Backend & OCR URLs and host detection
│   ├── ocr.ts                   # OCR request helper
│   ├── store.ts                 # Zustand store for photo/crop state
│   └── supabase.ts              # Supabase client initialization
├── tailwind.config.js           # NativeWind config with custom colors
├── global.css                   # Tailwind base styles
├── tsconfig.json                # TypeScript config
├── babel.config.js              # Babel + Expo Metro config
├── metro.config.js              # Metro + NativeWind integration
├── package.json                 # NPM scripts & dependencies
├── .env                         # Environment variables (not committed)
└── README.md                    # You are here
```

---

## ⚙️ Setup Instructions

### 1. Prerequisites

* Node.js 18+ & npm
* Expo CLI: `npm install -g expo-cli`

### 2. Clone & Install

```bash
git clone https://github.com/Maidenfan78/chemfetch-mobile.git
cd chemfetch-mobile
npm install
```

### 3. Environment Variables

Create a `.env` file at the project root:

```env
# Supabase (must be prefixed EXPO_PUBLIC_ to be exposed to the app)
EXPO_PUBLIC_SUPABASE_URL=https://your-supabase-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Backend API (used for /scan, /confirm, /sds-by-name endpoints)
EXPO_PUBLIC_BACKEND_API_URL=http://<your-backend-host>:3000

# OCR API (optional; falls back to BACKEND API proxy)
EXPO_PUBLIC_OCR_API_URL=http://<your-backend-host>:3000

# Dev host override (optional)
EXPO_PUBLIC_DEV_HOST=<your-local-ip-or-host>
```

> **Note:** `EXPO_PUBLIC_OCR_API_URL` defaults to `EXPO_PUBLIC_BACKEND_API_URL` if not set.

---

## 🗄️ Database Schema (Supabase)

```sql
-- Products master table
CREATE TABLE product (
  id SERIAL PRIMARY KEY,
  barcode TEXT NOT NULL UNIQUE,
  name TEXT,
  manufacturer TEXT,
  contents_size_weight TEXT,
  sds_url TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

-- Per-user inventory & risk info
CREATE TABLE user_chemical_watch_list (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES product(id) ON DELETE CASCADE,
  quantity_on_hand INTEGER,
  location TEXT,
  sds_available BOOLEAN,
  sds_issue_date DATE,
  hazardous_substance BOOLEAN,
  dangerous_good BOOLEAN,
  dangerous_goods_class TEXT,
  description TEXT,
  packing_group TEXT,
  subsidiary_risks TEXT,
  consequence TEXT,
  likelihood TEXT,
  risk_rating TEXT,
  swp_required BOOLEAN,
  comments_swp TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

ALTER TABLE user_chemical_watch_list ENABLE ROW LEVEL SECURITY;
```

### 4. Running the App

```bash
npx expo start --clear
```

* Scan the QR code with Expo Go (Android/iOS)
* Or press `a`/`i` to launch on emulator/device

### 5. Development Tips

* **Type checks:** `npx tsc --noEmit`
* **Linting:** integrate your preferred ESLint config
* Clear Metro cache if encountering stale builds: `npx expo start --clear`

---

## 🚀 Deployment

* **Mobile App:** Publish via EAS or use Expo Go for internal testing

---

## 🪪 License

MIT (or custom license as needed)

---

## 🙋 Support

For issues or onboarding, contact the project maintainer.
