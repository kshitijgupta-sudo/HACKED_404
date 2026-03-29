#!/bin/sh

ROOT_DIR="/Users/priyanshukumar/Documents/pk/hackthonprototype4"
BACKEND_URL="http://127.0.0.1:8000/api/health"
FRONTEND_URL="http://127.0.0.1:5173"

cleanup() {
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null
}

wait_for_backend() {
  ATTEMPT=0
  while [ "$ATTEMPT" -lt 20 ]; do
    if curl -sf "$BACKEND_URL" >/dev/null 2>&1; then
      return 0
    fi
    ATTEMPT=$((ATTEMPT + 1))
    sleep 1
  done
  return 1
}

cd "$ROOT_DIR/backend" || exit 1
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000 &
BACKEND_PID=$!

cd "$ROOT_DIR/frontend" || exit 1
npm run dev -- --host 127.0.0.1 &
FRONTEND_PID=$!

trap cleanup INT TERM EXIT

if wait_for_backend; then
  printf "\nBackend is ready at %s\n" "$BACKEND_URL"
  printf "Frontend is starting at %s\n\n" "$FRONTEND_URL"
else
  printf "\nBackend did not become ready on port 8000. Check the logs above.\n\n"
fi

wait "$BACKEND_PID" "$FRONTEND_PID"
