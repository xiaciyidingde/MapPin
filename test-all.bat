@echo off
REM MapPin Complete Test Script (Windows)
REM Run all tests and checks

echo ======================================================================================================
echo MapPin Project Complete Test
echo ======================================================================================================
echo.

echo 1. Run ESLint Code Check
echo ======================================================================================================
call npm run lint
if %errorlevel% neq 0 (
    echo [ERROR] ESLint check failed
    exit /b 1
)
echo [SUCCESS] ESLint check passed
echo.

echo 2. Run TypeScript Type Check
echo ======================================================================================================
call npx tsc --noEmit
if %errorlevel% neq 0 (
    echo [ERROR] TypeScript type check failed
    exit /b 1
)
echo [SUCCESS] TypeScript type check passed
echo.

echo 3. Run Unit Tests
echo ======================================================================================================
call npm run test:run
if %errorlevel% neq 0 (
    echo [ERROR] Unit tests failed
    exit /b 1
)
echo [SUCCESS] Unit tests passed
echo.

echo 4. Run Integration Tests
echo ======================================================================================================
call npm run test:integration
if %errorlevel% neq 0 (
    echo [ERROR] Integration tests failed
    exit /b 1
)
echo [SUCCESS] Integration tests passed
echo.

echo 5. Run Production Build
echo ======================================================================================================
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Production build failed
    exit /b 1
)
echo [SUCCESS] Production build completed
echo.

echo ======================================================================================================
echo All tests and checks completed!
echo ======================================================================================================
echo Test coverage report: coverage/index.html (run 'npm run test:coverage' to generate)
echo Build output directory: dist/
echo ======================================================================================================
