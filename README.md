# CodeBaseX-Ray

**CodeBaseX-Ray** is an advanced, fully dynamic source code analysis and visualization platform. It parses any local directory or GitHub repository to instantly generate beautiful, interactive System Architecture Diagrams, layer mappings, code metrics, and dependency insights.

![System Architecture Canvas](https://raw.githubusercontent.com/Palash-oss/Codebase/main/public/demo.png)

## 🚀 Features

- **Dynamic System Architecture Canvas:** Automatically groups files into logical layers (`Gateway`, `Presentation`, `Persistence`, `Domain`, `Infrastructure`, `Foundation`) and builds a 1-to-1 interactive dependency map.
- **Deep AST Parsing:** Statically analyzes TypeScript, JavaScript, HTML, CSS, and configuration files to accurately resolve relative imports, absolute aliases (via `tsconfig.json`), and track component dependencies.
- **Integrated Whiteboard Tools:** Sketch directly on top of your system architecture! Includes tools for drawing bounding boxes, freehand lines (Pencil), and an Eraser. Toggle tools instantly using the `Spacebar`.
- **Intelligent Tech Stack Detection:** Identifies your framework (Next.js, Express, React, etc.), database (Prisma, Postgres, MongoDB), UI libraries (Tailwind, Framer), and more, generating detailed tech-stack cards.
- **File Explorer & Issue Tracking:** In-depth file explorer showing code insights, lines of code, imports, exports, and automatically detected warnings (e.g., circular dependencies, large files).
- **Dark Mode UI:** A gorgeous, hardware-accelerated dark theme built with GSAP and D3/Canvas graphics, designed specifically for a premium developer experience.

## 🛠️ Installation & Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/Palash-oss/Codebase.git
   cd Codebase
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Start the Analyzer Server**
   ```bash
   npm run dev
   ```
   > By default, the server will start on `http://localhost:3000`.

## 🖥️ Usage

1. Open `http://localhost:3000` in your browser.
2. Enter the absolute path to a local directory or paste a **GitHub Repository URL** (e.g., `https://github.com/user/repo`).
3. Click **Analyze**.
4. The backend will parse the AST, resolve all dependencies, and launch the dynamic visualization report!

### Diagram Drawing Tools (Shortcuts)
When in the Architecture Canvas view, you can draw directly on the screen to annotate data flows or boundary contexts:
- **`Spacebar`**: Cycle through the active tools (Cursor, Pencil, Box, Erase).
- **`Click` a block**: View detailed mappings, imports, exports, and line-counts directly in the right sidebar.

## 📁 Architecture Overview

- `/analyzer`: The backend AST parsing engine. Handles file scanning, dependency resolution (supporting path aliases), tech stack detection, and layer assignment.
- `/public`: The frontend UI application. Contains `report.html`, the GSAP/Canvas rendering engine, and the whiteboard logic.
- `server.js`: The Express server that coordinates the analysis phase and serves the frontend.

## 🤝 Contributing
Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## 📝 License
[MIT](https://choosealicense.com/licenses/mit/)
