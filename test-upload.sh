#!/bin/bash
# Test script for POST /api/assets/upload endpoint
# Usage: ./test-upload.sh

echo "Testing POST /api/assets/upload endpoint"
echo "========================================"
echo ""

# Create a test image file (1x1 PNG)
# This is a base64 encoded 1x1 red pixel PNG
TEST_IMAGE="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
echo "$TEST_IMAGE" | base64 -D > /tmp/test-image.png

echo "Test 1: Successful upload"
echo "-------------------------"
curl -X POST http://localhost:3000/api/assets/upload \
  -F "assetFile=@/tmp/test-image.png" \
  -F "metaDescription=Test asset for upload endpoint" \
  -w "\nHTTP Status: %{http_code}\n" \
  | jq '.'
echo ""

echo "Test 2: Successful upload with custom date"
echo "------------------------------------------"
curl -X POST http://localhost:3000/api/assets/upload \
  -F "assetFile=@/tmp/test-image.png" \
  -F "metaDescription=Test asset with custom date" \
  -F "date=2026-01-15" \
  -w "\nHTTP Status: %{http_code}\n" \
  | jq '.'
echo ""

echo "Test 3: Invalid date format"
echo "---------------------------"
curl -X POST http://localhost:3000/api/assets/upload \
  -F "assetFile=@/tmp/test-image.png" \
  -F "metaDescription=Test asset with invalid date" \
  -F "date=01/15/2026" \
  -w "\nHTTP Status: %{http_code}\n" \
  | jq '.'
echo ""

echo "Test 4: Missing assetFile"
echo "------------------------"
curl -X POST http://localhost:3000/api/assets/upload \
  -F "metaDescription=Test without file" \
  -w "\nHTTP Status: %{http_code}\n" \
  | jq '.'
echo ""

echo "Test 5: Missing metaDescription"
echo "-------------------------------"
curl -X POST http://localhost:3000/api/assets/upload \
  -F "assetFile=@/tmp/test-image.png" \
  -w "\nHTTP Status: %{http_code}\n" \
  | jq '.'
echo ""

echo "Test 6: Invalid file format (create a text file)"
echo "------------------------------------------------"
echo "This is not an image" > /tmp/test.txt
curl -X POST http://localhost:3000/api/assets/upload \
  -F "assetFile=@/tmp/test.txt" \
  -F "metaDescription=Test with text file" \
  -w "\nHTTP Status: %{http_code}\n" \
  | jq '.'
echo ""

# Cleanup
rm -f /tmp/test-image.png /tmp/test.txt

echo "Tests completed!"
echo ""
echo "Note: Make sure the dev server is running with 'npm run dev'"
