// 테스트/데모 초기화 — data·workspace 삭제 후 version.json을 초기 상태로 되돌립니다.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
fs.rmSync(path.join(root, 'data'), { recursive: true, force: true });
fs.rmSync(path.join(root, 'workspace'), { recursive: true, force: true });
const version = {
  app: 'MOA Hive',
  stg: { version: '0.3.0-rc', updatedAt: new Date().toISOString() },
  prod: { version: '0.1.0', updatedAt: new Date().toISOString() },
  releases: [
    {
      version: '0.3.0-rc', env: 'stg', at: new Date().toISOString(),
      title: 'STG 후보 — 오케스트레이터 · 팀 컨설팅 · 신뢰 배지',
      changes: ['총괄 오케스트레이터(MOA Chief) + 자유 목적 분석', '음성 입력(ko-KR)', '봇 애니메이션 · 역할 인스펙터', 'STG→PROD 승격', 'Pickle 초대 · 팀 마켓'],
    },
    { version: '0.1.0', env: 'prod', at: new Date().toISOString(), title: '최초 운영 버전', changes: ['메신저형 봇 로스터', '로컬 하네스', 'Allow/Deny 승인 브로커'] },
  ],
};
fs.writeFileSync(path.join(root, 'version.json'), JSON.stringify(version, null, 2));
console.log('MOA Hive 상태 초기화 완료 (data/·workspace/ 삭제, version.json 0.3.0-rc)');
