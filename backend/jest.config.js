// Jest configuration for backend TypeScript tests
/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/../tests/backend'],
  moduleNameMapper: {
    '^../../backend/(.*)$': '<rootDir>/$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: '<rootDir>/../tests/backend/tsconfig.json',
    }],
  },
  moduleDirectories: ['node_modules', '<rootDir>/node_modules'],
};
