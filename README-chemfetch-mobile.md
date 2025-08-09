# ChemFetch Mobile

**Expo + React Native** mobile app for barcode scanning, OCR, and SDS lookup, part of the ChemFetch platform.

---

## 🔗 Related Repositories

| Repo                 | Purpose                                                       |
| -------------------- | ------------------------------------------------------------- |
| **chemfetch-mobile** | **(This repo)** Expo app for barcode scanning & SDS capture   |
| chemfetch-client-hub | Web dashboard for chemical register management                |
| chemfetch-admin-hub  | Internal admin panel for support                              |
| chemfetch-backend    | Node.js API server for OCR, AU-biased scraping, and SDS logic |
| chemfetch-supabase   | Supabase migrations, schema, and SQL types                    |

---

## ✨ Features

* EAN-8 and EAN-13 barcode scanning via `expo-camera` (CameraView)
* AU-biased web scraping for product name/size lookup (`"Item {barcode}"`)
* OCR fallback via PaddleOCR microservice (backend proxy)
* Confirm Screen with **Web**, **OCR**, and **Manual** options
* SDS search (`"{name} sds"`) and verification for product name + SDS keywords
* Manual entry support when data is ambiguous
* Zustand global store for photo & crop state
* NativeWind (Tailwind) styling with custom color palette
* SDS viewing in-app via `react-native-webview`

---

## 📋 Workflow Overview (Mobile Perspective)

1. **Scan Barcode** → call `/scan`.
2. If DB hit → show product instantly.
3. If DB miss → backend runs AU-biased `"Item {barcode}"` search.
4. Backend may return Web candidate + request OCR capture in parallel.
5. Show Confirm Screen with Web, OCR, Manual options.
6. User selects one → `/confirm` is called.
7. If SDS missing → trigger `/sds-by-name` → `/verify-sds`.
8. Update chemical register with verified SDS URL.

---

## 📋 Confirm Screen Contract

The Confirm screen must:

1. Display **three options** side-by-side:

   * **Web Candidate**: name + size from AU-biased scrape
   * **OCR Candidate**: first lines from OCR text with confidence %
   * **Manual Entry**: empty name + size inputs
2. Allow the user to pick exactly one option.
3. On submission:

   * POST to `/confirm` with `barcode`, `name`, and optional `size`.
   * If SDS URL not yet known, trigger `/sds-by-name` → then `/verify-sds`.
4. Update local state and chemical register once backend confirms SDS URL.

---

## 🛠️ Tech Stack

* React Native + [Expo Router](https://expo.github.io/router/)
* [NativeWind](https://www.nativewind.dev/)
* Zustand for global state management
* `@supabase/supabase-js` client SDK
* `expo-camera` for barcode scanning and capture
* `react-native-webview` for SDS PDF viewing
* TypeScript for type safety

---

## 📁 Project Structure

```
chemfetch-mobile/
├── app/
│   ├── index.tsx
│   ├── barcode.tsx
│   ├── confirm.tsx
│   ├── results.tsx
│   ├── register.tsx
│   ├── sds-viewer.tsx
│   └── _layout.tsx
├── components/
│   ├── CropOverlay.tsx
│   └── SizePromptModal.tsx
├── lib/
│   ├── constants.ts
│   ├── ocr.ts
│   ├── store.ts
│   └── supabase.ts
├── tailwind.config.js
├── global.css
├── tsconfig.json
├── babel.config.js
├── metro.config.js
├── package.json
├── .env
└── README.md
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

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-supabase-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_BACKEND_API_URL=http://<your-backend-host>:3000
EXPO_PUBLIC_OCR_API_URL=http://<your-backend-host>:3000
EXPO_PUBLIC_DEV_HOST=<your-local-ip-or-host>
```

---

## 🗄️ Database Schema (Supabase)

```sql
CREATE TABLE product (...);
CREATE TABLE user_chemical_watch_list (...);
ALTER TABLE user_chemical_watch_list ENABLE ROW LEVEL SECURITY;
```

---

## 🚀 Running the App

```bash
npx expo start --clear
```

Scan QR with Expo Go or launch on emulator/device.

---

## 🪪 License

MIT (or custom)

---

## 🙋 Support

Contact project maintainer for issues or onboarding.
