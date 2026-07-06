# Musyawarah

A decentralized social platform built on wallet-based identity, inspired by the spirit of *musyawarah* (deliberation and consensus). Musyawarah enables open, transparent, and community-driven discussions powered by blockchain wallets.

---

## ✨ Features

- **Wallet Authentication** via Sphere (Extension, Iframe, or Popup)
- **Create & Browse Posts** with image support
- **Tipping System** using UCT (Unicity Token)
- **Repost** functionality with notifications
- **Tiered Verification** (Free → Verified → Verified Pro → Verified Max)
  - Higher post limits
  - Longer post length
  - Image attachments
  - Post editing (Max tier)
- **Private Messaging** between wallets
- **Real-time Notifications** (follows, reposts, tips)
- **User Search & Profiles**
- **Dark Mode** with elegant monochrome design
- **Direct Monetization** through on-chain tipping

---

## 🛠️ Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS + Custom Design System
- **Backend**: Supabase (PostgreSQL, RLS, Edge Functions)
- **Wallet Integration**: [@unicitylabs/sphere-sdk](https://www.npmjs.com/package/@unicitylabs/sphere-sdk)
- **Fonts**: Fraunces (Display) + Plus Jakarta Sans (Body)

---

## 📋 Prerequisites

- Node.js 20 or higher
- A Supabase project
- Sphere Wallet (recommended)

---

## 🚀 Getting Started

### 1. Clone the repository
```bash
git clone <repository-url>
cd musyawarah
```

### 2. Install dependencies
```bash
npm install
```

### 3. Environment Setup

Copy the example environment file:
```bash
cp .env.example .env.local
```

Fill in your credentials in `.env.local`:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

VITE_SPHERE_WALLET_URL=https://sphere.unicity.network

# Required for verification purchases
VITE_VERIFICATION_TREASURY_WALLET=0x...
```

### 4. Run the development server
```bash
npm run dev
```

---

## 📁 Project Structure

```
src/
├── components/          # Reusable UI components
├── contexts/            # React Contexts (Wallet, Profile, Theme)
├── hooks/               # Custom hooks (posts, notifications, etc.)
├── lib/                 # Core logic & utilities
├── utils/               # Helper functions
├── types/               # TypeScript definitions
└── supabaseClient.ts
```

---

## 🔐 Security Model

Musyawarah uses a **secure-by-design** approach:

- All write operations go through **Supabase RPC functions** (`SECURITY DEFINER`)
- Direct table mutations are disabled for client roles
- Ownership validation and tier checks are enforced server-side
- Atomic operations for tips, reposts, and notifications

See `supabase/migrations/` for hardened write functions.

---

## 🏷️ Verification Tiers

| Tier            | Badge     | Daily Posts | Max Length | Images | Editing |
|-----------------|-----------|-------------|------------|--------|---------|
| Free            | None      | 5           | 280        | No     | No      |
| Verified        | Blue      | Higher      | Longer     | Yes    | No      |
| Verified Pro    | Gold      | Much Higher | Very Long  | Yes    | No      |
| Verified Max    | Indigo    | Unlimited   | Very Long  | Yes    | Yes     |

Payments are one-time (not recurring) using UCT tokens.

---

## 🎨 Design

- Monochrome aesthetic with violet/blue accent
- Warm serif font (`Fraunces`) for headings
- Clean, modern, and highly responsive UI
- First-class dark mode support

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a pull request.

1. Fork the project
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

Distributed under the **MIT License**. See `LICENSE` for more information.

---

## 🌍 About Musyawarah

**Musyawarah** is a social platform that brings the traditional values of deliberation, respect, and consensus into the digital age using wallet-based identity and transparent on-chain interactions.

Built with ❤️ for the Unicity & Sphere ecosystem.

---

**Ready for deployment on Vercel, Netlify, or Cloudflare Pages.**
```
