# ⚡ CodeBase X-Ray — Static Analysis & Architecture Platform

**CodeBase X-Ray** is an advanced, 100% private, AST-driven source code analysis and architecture refactoring platform. It parses any local repository or public GitHub URL to generate evidence-based **System Design Topologies**, **Layer Mappings**, **Blast Radius Radar**, **Interactive Refactoring Simulations**, and **Mermaid.js Architecture Documentation**.

---

## 🚀 Key Features

### 1. 🏗️ Dynamic Evidence-Driven System Design Topology
* **Repo-Tailored Mapping:** Automatically detects and builds tailored architecture views for **Frontend SPAs** (`Web Browser` $\rightarrow$ `CDN`), **Backend REST APIs** (`API Gateway` $\rightarrow$ `Auth` $\rightarrow$ `Database`), **Fullstack Apps**, or **CLI Tools / Libraries**.
* **Zero-Noise Pruning:** Automatically hides unmapped components with 0 source files.

### 2. 🎮 Interactive "What-If" Refactoring Simulator
* Click **`Refactoring Simulator`** to interactively disable components and calculate predicted broken imports and ripple effects across the codebase in real-time before writing code.

### 3. ⚡ 1-Click Codebase Auto-Fixer Engine
* Automatically detects missing `process.env` references and appends missing keys into `.env.example` with a single click in the File Detail panel.

### 4. 📄 Exportable Architecture Documentation (`Mermaid.js`)
* One-click export of connected `Mermaid.js` diagram syntax wrapped in Markdown fences (` ```mermaid ... ``` `) for instant rendering in GitHub `README.md` pages, Notion, and Confluence.

### 5. 🤖 GitHub PR Architecture Guard
* Generates `.github/workflows/codebase-xray-guard.yml` to automatically run static AST checks in GitHub Actions CI/CD and block Pull Requests that introduce circular dependencies or missing environment variables.

### 6. 🛡️ 100% Private Local AST Analysis
* Operates completely offline without requesting live cloud credentials (AWS IAM keys or Kubeconfig certificates).

### 7. 🌊 Smooth Liquid Wave Animations & Vector SVG UI
* High-contrast design system featuring fluid liquid wave hover fills, click pop expansion ripples, and crisp SVG vector icons.

### 8. 📱 Full-Site Responsiveness
* Mobile, tablet, and desktop adaptive layouts for seamless architecture exploration on any screen size.

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
