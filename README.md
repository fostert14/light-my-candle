# 🕯️ Light My Candle

A real-time intimate partner signaling app. Light your candle to let your partner know you're in the mood — they can light theirs back, or blow yours out.

## Tech Stack

- **Frontend**: React Native + Expo (managed workflow)
- **Backend**: Supabase (auth, database, real-time)
- **Navigation**: Expo Router (file-based routing)
- **Animations**: React Native Reanimated
- **Testing**: Expo Go

---

## Project Structure

```
light-my-candle/
├── app/                        # Screens (Expo Router file-based routing)
│   ├── _layout.tsx             # Root layout — wraps everything in providers
│   ├── index.tsx               # Entry — redirects to auth or main app
│   ├── auth/
│   │   ├── _layout.tsx         # Auth stack layout
│   │   ├── login.tsx           # Login screen
│   │   └── register.tsx        # Registration screen
│   └── tabs/
│       ├── _layout.tsx         # Tab navigation layout
│       ├── index.tsx           # Main candle interaction screen
│       └── settings.tsx        # Pairing, account management
├── components/
│   └── Candle.tsx              # Animated candle component with flame
├── contexts/
│   ├── AuthContext.tsx          # Authentication state management
│   └── CandleContext.tsx        # Partnership + candle state + real-time
├── constants/
│   └── theme.ts                # Colors, spacing, typography
├── lib/
│   └── supabase.ts             # Supabase client configuration
├── supabase-setup.sql          # Database schema — run this in Supabase
├── package.json
├── app.json                    # Expo configuration
├── tsconfig.json
└── babel.config.js
```

---

## Setup Instructions

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Click **New Project** and give it a name (e.g., "light-my-candle")
3. Set a database password (save it somewhere safe)
4. Wait for the project to finish provisioning (~2 minutes)

### 2. Set Up the Database

1. In your Supabase dashboard, go to **SQL Editor**
2. Open the `supabase-setup.sql` file from this project
3. Paste the entire contents into the SQL editor
4. Click **Run** — this creates all tables, security policies, and triggers

### 3. Enable Realtime

1. In your Supabase dashboard, go to **Database → Replication**
2. Make sure `candle_status` is listed under "Tables broadcasting changes"
3. The SQL script should have done this, but verify it's enabled

### 4. Get Your API Keys

1. Go to **Settings → API** in your Supabase dashboard
2. Copy your **Project URL** (looks like `https://xxxx.supabase.co`)
3. Copy your **anon/public key** (the long string starting with `eyJ...`)

### 5. Configure the App

Open `lib/supabase.ts` and replace the placeholder values:

```typescript
const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';  // Your Project URL
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY_HERE';              // Your anon key
```

### 6. Install Dependencies & Run

```bash
# Install dependencies
npm install

# Start Expo development server
npx expo start
```

Scan the QR code with Expo Go on your phone to run the app.

---

## How It Works

### User Flow

1. **Sign up** — Create an account with email, password, and display name
2. **Pair up** — One partner generates a 6-character code, the other enters it
3. **Light your candle** — Tap your candle to signal your partner
4. **See partner's candle** — Their candle lights up in real-time on your screen
5. **Blow it out** — Tap your partner's candle to extinguish it

### Architecture

The app uses two React Context providers that wrap the entire app:

**AuthContext** manages login state. It uses Supabase Auth and stores session tokens securely using `expo-secure-store`. When the app opens, it checks for an existing session so users stay logged in.

**CandleContext** manages everything else — partnerships, candle states, and the real-time subscription. The key piece is the Supabase Realtime subscription: when either partner updates their candle in the database, Supabase pushes the change over a WebSocket connection, and the other partner's UI updates instantly.

### Database Tables

- **profiles** — User display names (auto-created on signup via trigger)
- **partnerships** — Links two users together with a pair code
- **candle_status** — One row per user per partnership, tracks lit/unlit state

### Security

Row Level Security (RLS) policies ensure:
- Users can only see partnerships they belong to
- Users can only see candle states within their own partnership
- Users can update any candle in their partnership (so you can blow out your partner's)
- Profiles are readable by any authenticated user (for displaying partner names)

---

## Testing with Two Devices

To test the real-time pairing and candle features:

1. Run `npx expo start` on your dev machine
2. Open Expo Go on **Phone A** — scan the QR code
3. Open Expo Go on **Phone B** (or a simulator) — scan the same QR code
4. Create an account on each phone
5. On Phone A: go to Settings → Generate Pair Code
6. On Phone B: go to Settings → Enter the code
7. Now light candles and watch them sync in real-time!

---

## Next Steps (Post-MVP)

Here are features to add once the core is working:

- **Push notifications** — Alert your partner when you light your candle (even if the app is closed)
- **Custom candle designs** — Premium candle skins (potential monetization)
- **Scheduled candles** — Set a time for your candle to auto-light
- **Mood history** — See a private log of candle activity
- **Custom fonts & polish** — Upgrade from system fonts to a warm serif/display font
- **App Store submission** — Switch from Expo Go to a development build for production
