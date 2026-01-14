const { createDefaultPreset } = require("ts-jest");

const tsJestTransformCfg = createDefaultPreset().transform;

/** @type {import("jest").Config} **/
module.exports = {
  testEnvironment: "node",
  transform: {
    ...tsJestTransformCfg,
  },
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  testEnvironmentOptions: {
    customExportConditions: [""],
  },
  // Use jsdom for React component tests
  projects: [
    {
      displayName: "node",
      testEnvironment: "node",
      testMatch: [
        "<rootDir>/lib/**/*.test.ts",
        "<rootDir>/app/**/*.test.ts",
        "<rootDir>/__tests__/**/*.test.ts",
      ],
      transform: {
        ...tsJestTransformCfg,
      },
      moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/$1",
      },
    },
    {
      displayName: "jsdom",
      testEnvironment: "jsdom",
      testMatch: [
        "<rootDir>/components/**/*.test.tsx",
        "<rootDir>/app/**/*.test.tsx"
      ],
      transform: {
        ...tsJestTransformCfg,
      },
      moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/$1",
      },
      setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
    },
  ],
};