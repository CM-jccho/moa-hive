#!/bin/bash
# MOA Hive — macOS 원클릭 실행
# 더블클릭하면 서버를 켜고 브라우저를 엽니다. 창을 닫으면 서버도 종료됩니다.
cd "$(dirname "$0")" || exit 1

if ! command -v node >/dev/null 2>&1; then
  echo ""
  echo "  Node.js가 필요합니다 (v18 이상)."
  echo "  https://nodejs.org 에서 설치한 뒤 다시 실행해 주세요."
  echo ""
  read -r -p "  Enter 키를 누르면 닫힙니다..."
  exit 1
fi

PORT="${PORT:-3847}"
echo ""
echo "  MOA Hive 시작 — http://127.0.0.1:$PORT"
echo "  이 창을 닫으면 서버가 종료됩니다."
echo ""

# 1초 뒤 브라우저 열기 (서버가 뜨는 시간 확보)
( sleep 1; open "http://127.0.0.1:$PORT" >/dev/null 2>&1 ) &

exec env PORT="$PORT" node server.js
