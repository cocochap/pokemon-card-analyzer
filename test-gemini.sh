#!/bin/bash
# Usage: GEMINI_API_KEY=xxx bash test-gemini.sh

KEY="${GEMINI_API_KEY:-$1}"
if [ -z "$KEY" ]; then echo "Usage: GEMINI_API_KEY=xxx bash test-gemini.sh"; exit 1; fi

BODY='{"contents":[{"parts":[{"text":"Reply with only the word: OK"}]}]}'

for MODEL in "gemini-1.5-flash" "gemini-1.5-flash-8b" "gemini-1.5-pro" "gemini-2.0-flash" "gemini-pro"; do
  echo -n "Testing $MODEL ... "
  STATUS=$(curl -s -o /tmp/gemini_test.json -w "%{http_code}" \
    -X POST "https://generativelanguage.googleapis.com/v1/models/${MODEL}:generateContent?key=${KEY}" \
    -H "Content-Type: application/json" \
    -d "$BODY")
  if [ "$STATUS" = "200" ]; then
    echo "✅ OK (HTTP 200)"
  else
    ERR=$(python3 -c "import json,sys; d=json.load(open('/tmp/gemini_test.json')); print(d.get('error',{}).get('message','?')[:80])" 2>/dev/null || cat /tmp/gemini_test.json | head -1)
    echo "❌ HTTP $STATUS — $ERR"
  fi
done
