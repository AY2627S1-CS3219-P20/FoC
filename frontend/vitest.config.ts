import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
    resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
    test: {
        environment: "jsdom",
        setupFiles: ["./src/test/setup.ts"],
        clearMocks: true,
        env: {
            VITE_AUTH_API_BASE_URL: "http://localhost:3001/api",
            VITE_CREDIT_API_BASE_URL: "http://localhost:3004/api",
            VITE_SUPPLIER_API_BASE_URL: "http://localhost:3002/api",
        },
    },
});
