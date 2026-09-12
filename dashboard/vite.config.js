import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    // districts.json is imported from ../../server/data so the coverage panel
    // is bundled rather than fetched, which lets the board run with the Express
    // server switched off. Vite will not serve outside its root without this.
    fs: { allow: [".."] },
  },
});
