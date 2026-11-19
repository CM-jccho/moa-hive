// MOA Hive 설정 파일
// ---------------------------------------------------------------------------
// 이 파일의 값은 store.json이 만들어지기 전 기본값으로 쓰입니다.
// 앱 안의 [설정] 화면에서 바꾼 값이 store.json에 저장되면 그 값이 우선합니다.
// 초대 링크·판매 링크는 여기 한 줄만 바꿔도 바로 반영됩니다(서버 재시작 후).
// ---------------------------------------------------------------------------

module.exports = {
  port: Number(process.env.PORT || 3847),
  host: '127.0.0.1', // 보안: 항상 로컬 루프백에만 바인딩

  // Pickle 연동·초대 카드 — PC 밖(전화·예약·브라우저 자동화)은 Pickle로 넘깁니다.
  pickle: {
    enabled: true,
    title: 'PC 밖에서도 AI 팀이 필요할 땐 Pickle',
    body: '전화 한 통, 예약 한 건, 브라우저 로그인처럼 PC 안에서 끝나지 않는 일은 Pickle이 대신 처리합니다.',
    cta: 'Pickle 초대 링크 열기',
    url: 'https://pickle.com/i/X2XQHRSC3K55', // ← 새 초대 링크로 1줄 교체
  },

  // 팀 마켓(BotMRR형) — 무료 스타터 + 유료 Pro 팩 판매 링크
  market: {
    storeUrl: 'https://gumroad.com/l/maus-team-pro', // ← Gumroad/래피드 실제 판매 링크로 교체
    bundleUrl: 'https://gumroad.com/l/maus-team-bundle',
    currency: 'KRW',
    demoUnlock: false, // true면 잠금 해제(데모용). 기본은 구매 링크로만 열립니다.
  },

  // 봇이 작업할 수 있는 경로의 최상위(root). 이 밖의 경로는 API에서 차단됩니다.
  allowedRoot: '', // 비우면 홈 디렉터리(os.homedir())
};
