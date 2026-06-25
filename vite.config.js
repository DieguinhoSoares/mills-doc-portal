import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/mills-doc-portal/", // ajuste se o nome do repo no GitHub for diferente
});
