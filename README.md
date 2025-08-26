# MacroCount — Dining Hall Macronutrient Calculator

[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Vercel](https://img.shields.io/badge/Deploy-Vercel-000000?logo=vercel)](https://vercel.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**MacroCount** is a full-stack web app that connects directly to LSU Dining’s public API to provide real-time menus and nutrition data. Students and athletes can select foods, adjust serving sizes (including partials), and instantly see calories, protein, carbs, fat, and distribution charts.

---

## ✨ Features
- 🔎 **Search & Filter** — Quickly find menu items by name or station (e.g. Deli, The Roux).
- 📅 **Meal Periods** — Breakfast, Lunch, Dinner, Everyday, Late Night.
- ✅ **Food Selection** — Add/remove items with serving sizes (supports partial servings).
- 📊 **Macro Tracking** — Real-time totals + interactive pie chart visualization.
- ⚔️ **Head-to-Head Comparison** — Compare two items side-by-side with highlights.
- 🥇 **Top Protein Rankings** — Auto-rank best protein options by per-serving or protein density (per 100 kcal).
- ⏱️ **Auto Refresh** — Menu data refreshes every 5 minutes.

---

## 🛠️ Tech Stack
- **Frontend**: [Next.js 15](https://nextjs.org/) (App Router) + [React](https://react.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **UI Components**: [shadcn/ui](https://ui.shadcn.com/) + Tailwind CSS
- **Data Visualization**: [Recharts](https://recharts.org/)
- **Backend/API**: Next.js API routes for LSU Dining API integration
- **Deployment**: [Vercel](https://vercel.com/)
