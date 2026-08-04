# ⚡ CodeBase X-Ray v3.0 — Static Analysis & Architecture Refactoring Platform

**CodeBase X-Ray** is a professional, AST-driven source code analysis and architecture visualization platform. It parses local repositories or GitHub URLs to generate evidence-based **System Design Topologies**, **Architecture Diffing & Time-Travel Commit Tracking**, **Blast Radius Radar**, **Interactive Refactoring Simulations**, **Code Story Guides**, and exportable **Mermaid.js Architecture Documentation**.

---

## 🚀 Key Features

### 1. 🔀 Architecture Diffing & Time-Travel Commit Scrubber
* **Branch & Commit Visual Diff:** Compare architecture diagrams between any two branches (e.g. `main` ↔ `dev`) or commits. Visual highlights indicate **+Added (Green)**, **-Removed (Red)**, and **~Modified (Amber)** components.
* **Time-Travel Commit Scrubber:** Scrub chronologically through recent commit history to observe architectural evolution over time.
* **Circular Dependency Detection:** Instantly detects newly introduced circular dependency cycles and alerts developers during architecture reviews.

### 2. 🏗️ Dynamic Evidence-Driven System Design Topology
* **Repo-Tailored Mapping:** Automatically detects and builds tailored architecture views for **Frontend SPAs** (`Web Browser` $\rightarrow$ `CDN`), **Backend REST APIs** (`API Gateway` $\rightarrow$ `Auth` $\rightarrow$ `Database`), **Fullstack Apps**, or **CLI Tools & Libraries**.
* **Zero-Noise Pruning:** Automatically hides unmapped components with 0 source files.

### 3. 🎮 Interactive "What-If" Refactoring Simulator & Blast Radius
* **Refactoring Simulator:** Interactively disable or modify components to calculate predicted broken imports and ripple effects across the codebase in real-time before writing code.
* **Blast Radius Radar:** Visualizes exact dependency cascade chains and safety scores when updating or deleting files.

### 4. ⚡ 1-Click Codebase Auto-Fixer Engine
* Automatically detects missing `process.env` references and appends missing keys into `.env.example` with a single click in the File Detail panel.

### 5. 📄 Exportable Architecture Documentation (`Mermaid.js`)
* One-click export of connected `Mermaid.js` diagram syntax wrapped in Markdown fences (` ```mermaid ... ``` `) for instant rendering in GitHub `README.md` pages, Notion, and Confluence.

### 6. 🤖 GitHub PR Architecture Guard
* Generates `.github/workflows/codebase-xray-guard.yml` to automatically run static AST checks in GitHub Actions CI/CD and block Pull Requests that introduce circular dependencies or missing environment variables.

### 7. 🔒 Automated SaaS Subscription & Anti-Bypass Security
* **Automated Entitlements:** Integrated Razorpay checkout with instant automated tier upgrades (`Pro $29/mo`, `Team $99/mo`, `Owner Unlimited`).
* **Server-Side Anti-Bypass Rate Limiting:** IP + Device Fingerprint rate limiting prevents free tier bypasses via Incognito mode or multi-browser abuse.

### 8. ✨ Clean Professional Design System & Full Responsiveness
* High-contrast Pure White (`#FFFFFF`) & Sunset Orange (`#FF5E1A`) design system with crisp vector SVG icon badges, smooth micro-animations, and full mobile/tablet/desktop responsiveness.

---

## 🛠️ Local Setup & Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Palash-oss/Codebase.git
   cd Codebase
   ```

2. **Install dependencies & build frontend:**
   ```bash
   npm run build
   ```

3. **Start the application server:**
   ```bash
   npm run dev
   ```
   * Open `http://localhost:3001` in your browser.

---

## ☁️ Deploying to Vercel

The repository includes a pre-configured `vercel.json` for seamless Vercel deployment:

1. Push the repository to GitHub.
2. Import the repository into **Vercel**.
3. Vercel automatically runs `cd frontend && npm install && npm run build` and routes API requests to `server.js` and frontend routes to `/index.html`.

---

## 📄 License
[MIT](https://choosealicense.com/licenses/mit/)
