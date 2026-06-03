#!/bin/bash
# MapPin Complete Test Script (Linux/Mac)
# Run all tests and checks

set -e  # Exit immediately on error

echo "======================================================================================================"
echo "MapPin Project Complete Test"
echo "======================================================================================================"
echo ""

echo "1. Run ESLint Code Check"
echo "======================================================================================================"
npm run lint
echo "[SUCCESS] ESLint check passed"
echo ""

echo "2. Run TypeScript Type Check"
echo "======================================================================================================"
npx tsc --noEmit
echo "[SUCCESS] TypeScript type check passed"
echo ""

echo "3. Run Unit Tests"
echo "======================================================================================================"
npm run test:run
echo "[SUCCESS] Unit tests passed"
echo ""

echo "4. Run Integration Tests"
echo "======================================================================================================"
npm run test:integration
echo "[SUCCESS] Integration tests passed"
echo ""

echo "5. Build Android (includes frontend build and sync)"
echo "======================================================================================================"
npm run build:android
echo "[SUCCESS] Android build completed"
echo ""

echo "======================================================================================================"
echo "All tests and checks completed!"
echo "======================================================================================================"
echo "Test coverage report: coverage/index.html (run 'npm run test:coverage' to generate)"
echo "Android build output: android/app/build/outputs/"
echo "======================================================================================================"
