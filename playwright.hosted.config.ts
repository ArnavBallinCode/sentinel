import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/hosted",
  workers: 1,
  use: {
    baseURL: process.env.E2E_BASE_URL,
    httpCredentials: { username: "sentinel-test", password: "synthetic-hosted-password-for-tests-only" },
  },
  reporter: "list",
});
