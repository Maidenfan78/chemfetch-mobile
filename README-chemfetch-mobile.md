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

* EAN-8 and EAN-13 barcode scanning via `expo-barcode-scanner`
* OCR integration with Python microservice (PaddleOCR)
* Bing web scraping fallback for product name & size
* SDS URL detection and auto-association
* Manual entry support when data is ambiguous
* Zustand global store for crop/photo state
* NativeWind (Tailwind) styling with custom color palette

---

## 🛠️ Tech Stack

* React Native + [Expo Router](https://expo.github.io/router/)
* [NativeWind](https://www.nativewind.dev/) (Tailwind CSS for RN)
* Zustand for global state management
* `@supabase/supabase-js` client SDK
* `expo-barcode-scanner`, `expo-camera`, `expo-file-system`
* TypeScript for type safety

---

## 📁 Project Structure

```
chemfetch-mobile/
├── app/                         # Expo Router-based screens
│   ├── index.tsx                # Home screen
│   ├── barcode.tsx              # Barcode scanning screen
│   ├── confirm.tsx              # OCR confirmation screen
│   ├── results.tsx              # Product & SDS lookup results
│   └── sds-viewer.tsx           # SDS PDF viewer screen
├── components/                  # Reusable UI components
│   ├── CropOverlay.tsx          # Interactive crop handles using PanResponder
│   └── SizePromptModal.tsx      # Manual input modal for size
├── lib/                         # Shared libraries and global state
│   ├── constants.ts             # App-wide constants (e.g. BACKEND_API_URL)
│   ├── ocr.ts                   # OCR request helper
│   ├── store.ts                 # Zustand store for photo/crop state
│   └── supabase.ts              # Supabase client initialization
├── app/_layout.tsx             # Tab layout config with hidden routes
├── tailwind.config.js          # NativeWind config with custom colors
├── global.css                  # Tailwind base styles
├── tsconfig.json               # TypeScript config
├── .env                        # Environment variables (not committed)
├── babel.config.js             # Babel config
├── metro.config.js             # Metro + NativeWind config
├── package.json                # NPM scripts & dependencies
└── README.md                   # You are here
```

---

## ⚙️ Setup Instructions

### 1. Prerequisites

* Node.js 18+ & npm
* Expo CLI: `npm install -g expo-cli`

### 2. Clone & Install

```bash
git clone https://github.com/YOUR_ORG/chemfetch-mobile.git
cd chemfetch-mobile
npm install
```

### 3. Environment Variables

Create a `.env` file at project root:

```env
SUPABASE_URL=https://your-supabase-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_BACKEND_API_URL=http://<your-backend-host>:3000
```

### 4. Running the App

```bash
npx expo start --clear
```

* Scan QR code with Expo Go (Android/iOS)
* Or press `a`/`i` to launch emulator/device

### 5. Development Tips

* **Type checks:** `npx tsc --noEmit`
* **Linting:** integrate your preferred ESLint config
* Clear Metro cache if encountering stale builds: `npx expo start --clear`

---

## 🚀 Deployment

* **Mobile App:** Publish via EAS or use Expo Go for testing

---
### The Schema
CREATE TABLE product (
  id SERIAL PRIMARY KEY,
  barcode TEXT NOT NULL,
  name TEXT,
  contents_size_weight TEXT,
  sds_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
  CONSTRAINT unique_barcode UNIQUE (barcode)
);
user_chemical_watch_list
Tracks product usage per user (inventory, SDS status, risk info, etc.).

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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);
🔐 Row-Level Security (RLS)
RLS is enabled for user_chemical_watch_list to ensure users can only access their own chemical records.
---

## 🪪 License

MIT (or custom license as needed)

---

## 🙋 Support

For issues or onboarding, contact the project maintainer.
