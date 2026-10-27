import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/hosted",
  workers: 1,
  use: {
    baseURL: process.env.E2E_BASE_URL,
    httpCredentials: {
      username: process.env.E2E_USERNAME || "sentinel-test",
      password: process.env.E2E_PASSWORD || "synthetic-hosted-password-for-tests-only",
    },
  },
  reporter: "list",
});
