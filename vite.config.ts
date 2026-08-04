import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Nom du dépôt GitHub — nécessaire pour que les chemins des assets
  // fonctionnent une fois déployés sur https://thierrysiko.github.io/varadl-studio-ecom/
  // (sans ce "base", index.html référence les fichiers depuis la racine du
  // domaine, d'où l'erreur 404 sur les fichiers .js générés).
  base: "/varadl-studio-ecom/",
});
