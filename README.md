# 🌌 GitVerse

> **Explore GitHub as a living, breathing 3D Universe.**

🔗 **Live Demo:** https://git-verse-nine.vercel.app/

GitVerse transforms GitHub users and their repositories into an interactive 3D space — every country is a **Galaxy**, every developer is a **Star**, every repository is a **Planet**, and every programming language is a **Moon**.

![GitVerse Banner](https://img.shields.io/badge/GitVerse-3D%20GitHub%20Explorer-blueviolet?style=for-the-badge&logo=github)
![React](https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react)
![Three.js](https://img.shields.io/badge/Three.js-0.184-black?style=flat-square&logo=threedotjs)
![Vite](https://img.shields.io/badge/Vite-8-646cff?style=flat-square&logo=vite)

---

## ✨ Features

- 🌍 **Country Galaxies** — Every country with GitHub users forms its own galaxy
- ⭐ **Developer Stars** — Each GitHub user is a uniquely colored star inside their native galaxy
- 🪐 **Repository Planets** — A developer's repos orbit around them as glowing planets
- 🌙 **Language Moons** — Each repo's programming languages orbit as tiny moons (click a planet to reveal)
- 🚀 **Warp Portal** — A special outer-rim planet that links directly to the developer's GitHub profile
- 🔍 **Smart Search** — Search any GitHub username and warp directly to their solar system
- 🎨 **Language Colors** — Every planet and moon glows with the real color of its programming language
- 📡 **Live GitHub Data** — Fetches real user info, repos, and language stats from the GitHub API

---

## 🧭 How to Navigate

| Action | Result |
|--------|--------|
| **Load the app** | Starts at Universe view — all country galaxies visible |
| **Click a Galaxy** | Zooms into that country's developer stars |
| **Click a Star** | Zooms into that developer's solar system |
| **Click a Planet** | Focuses on that repository, reveals language moons |
| **Click focused Planet again** | Opens the repository on GitHub |
| **Click the Warp Portal banner** | Zooms to the edge portal planet |
| **Click the Warp Portal planet** | Opens the developer's GitHub profile |
| **Search bar** | Type any GitHub username and press Enter |
| **Back button (←)** | Goes up one level in the hierarchy |

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | [React 19](https://react.dev/) |
| **3D Engine** | [Three.js](https://threejs.org/) via [@react-three/fiber](https://docs.pmnd.rs/react-three-fiber) |
| **3D Helpers** | [@react-three/drei](https://github.com/pmndrs/drei) |
| **State Management** | [Zustand](https://zustand.docs.pmnd.rs/) |
| **Animations** | [maath](https://github.com/pmndrs/maath) |
| **Icons** | [Lucide React](https://lucide.dev/) |
| **Build Tool** | [Vite](https://vitejs.dev/) |
| **API** | [GitHub REST API v3](https://docs.github.com/en/rest) |

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- A GitHub account (optional, but recommended for higher API limits)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/your-username/gitverse.git
cd gitverse

# 2. Install dependencies
npm install

# 3. Start the development server
npm run dev
```

Open **http://localhost:5173** in your browser.

---

## 🔑 GitHub API Token (Recommended)

Without a token, the GitHub API allows **60 requests/hour** per IP. This is enough for casual browsing, but you'll hit it quickly.

With a Personal Access Token (PAT), the limit increases to **5,000 requests/hour**.

### Setting up your token

1. Go to [GitHub Settings → Developer Settings → Personal Access Tokens](https://github.com/settings/tokens)
2. Click **"Generate new token (classic)"**
3. Give it a name (e.g., `GitVerse`) and select **no scopes** (public data only)
4. Copy the generated token
5. Create a `.env.local` file in the project root:

```bash
# .env.local
VITE_GITHUB_TOKEN=ghp_your_token_here
```

6. Restart the dev server — GitVerse will automatically use your token.

> ⚠️ **Never commit `.env.local` to Git.** It is already listed in `.gitignore`.

---

## 📁 Project Structure

```
gitverse/
├── src/
│   ├── components/
│   │   ├── SpaceScene.jsx   # All 3D objects: galaxies, stars, planets, moons, portals
│   │   └── HUD.jsx          # Heads-Up Display: search bar, breadcrumbs, user info panel
│   ├── lib/
│   │   └── github.js        # GitHub API fetching, language colors, mock data fallbacks
│   ├── store.js             # Zustand global state: view levels, camera, selected entities
│   ├── App.jsx              # Root component, Canvas setup
│   ├── index.css            # Global styles, CSS variables, neon design system
│   └── main.jsx             # React entry point
├── public/
├── index.html
├── vite.config.js
└── package.json
```

---

## 🏗️ Architecture Overview

```
App.jsx
└── Canvas (react-three-fiber)
    └── SpaceScene.jsx
        ├── CameraController      ← Smooth camera transitions
        ├── UniverseStars         ← Background star field (non-interactive)
        ├── DeveloperStars        ← Instanced mesh of all user stars in a galaxy
        ├── Galaxy (×N)          ← Each country galaxy (particle cloud)
        ├── SolarSystem          ← Active developer's solar system
        │   ├── Sun              ← The developer (size = follower count)
        │   ├── Planet (×N)     ← Each repository (color = primary language)
        │   │   └── Moon (×N)   ← Each language in the repo (on focus)
        │   └── ProfilePlanet   ← Outer-rim warp portal to GitHub profile
        └── HUD.jsx (HTML overlay)
            ├── Search bar
            ├── Breadcrumb navigation
            ├── User info panel
            └── Error messages
```

---

## 🌐 State Management

GitVerse uses **Zustand** for all global state. The store (`src/store.js`) manages:

| State | Description |
|-------|-------------|
| `viewLevel` | `UNIVERSE` → `GALAXY` → `SYSTEM` → `PLANET` |
| `selectedGalaxy` | Currently active country galaxy name |
| `selectedUser` | Currently focused GitHub username |
| `selectedPlanet` | Currently focused repository name |
| `galaxies` | All country galaxy positions, colors, sizes |
| `cameraTarget` / `cameraPosition` | Smooth camera animation targets |
| `systemPosition` | World position of the current solar system |

---

## 🤝 Contributing

Contributions are very welcome! Here's how to get involved:

### 1. Fork & Clone

```bash
git clone https://github.com/your-username/gitverse.git
cd gitverse
npm install
```

### 2. Create a Branch

```bash
git checkout -b feature/my-awesome-feature
# or
git checkout -b fix/some-bug
```

### 3. Make Your Changes

- Keep components focused and reusable
- Follow the existing code style (no TypeScript, plain JSX)
- Add comments for complex 3D math or camera logic
- Test with both a token and without (rate-limited fallback must work)

### 4. Test Your Changes

```bash
npm run dev     # Run dev server
npm run build   # Verify production build works
npm run lint    # Check for lint errors
```

### 5. Open a Pull Request

Push your branch and open a PR with a clear description of what you changed and why.

---

## 🐛 Known Issues & Limitations

- **User Location**: Developers who haven't set a GitHub location are assigned a country procedurally based on their username hash.

---

## 💡 Ideas for Contributions

Looking for something to work on? Here are some great starting points:

- [ ] **Organization Support** — Visualize GitHub organizations as star clusters
- [ ] **Repo Connections** — Draw lines between forked repositories
- [ ] **Commit Activity** — Animate planets based on recent commit frequency
- [ ] **Followers Network** — Show follower/following connections as gravitational links
- [ ] **Mobile Support** — Improve touch controls for mobile devices
- [ ] **Search History** — Remember recently visited developers
- [ ] **Performance Mode** — Reduce particle counts for lower-end hardware

---

## 📜 License

This project is licensed under the **MIT License** — see the [LICENSE](./LICENSE) file for full details.

MIT © [Arp1it](https://github.com/Arp1it)

---

<div align="center">
  <strong>Built with ❤️ and Three.js</strong><br/>
  <em>Explore the universe of open source, one star at a time.</em><br/>
  <sub>First Antigravity Project • Prompt Engineering 🙃</sub>
</div>
