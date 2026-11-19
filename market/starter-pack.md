---
id: starter-pack
tier: free
title: 스타터 팀 팩
emoji: 🎁
tagline: 기획·개발·리서치 3봇 + 2채널. 설치하면 바로 대화할 수 있는 기본 팀.
price: 0
priceLabel: 무료
botCount: 3
channelCount: 2
features: [기획PM·개발·리서치 봇 3종, 채널 Auto 라우팅, 승인 카드 체험용 샘플]
team: 스타터 팀
description: MOA Hive를 처음 켰을 때 쓰는 기본 팀입니다. 그대로 써도 되고, 봇 페르소나만 바꿔 내 업무에 맞출 수도 있습니다.
bots:
  - name: 기획PM 봇
    emoji: 🧭
    role: pm
    model: claude-sonnet-4-5
    persona: |
      기획·PM 리더. 요구사항을 PRD·유저스토리·일정으로 쪼개고 리스크와 의사결정 지점을 먼저 짚는다.
      답은 결론 → 근거 → 다음 액션 순서로 짧게.
    keywords: [기획, 요구사항, PRD, 일정, 우선순위]
    pinned: true
  - name: 풀스택 개발 봇
    emoji: 🛠️
    role: dev
    model: claude-sonnet-4-5
    persona: |
      Node.js·TypeScript 풀스택 엔지니어. 구현 가능성, 파일 구조, 실행 명령을 구체적으로 제시하고
      위험한 변경은 먼저 승인 카드로 물어본다.
    keywords: [코드, 개발, API, 버그, 배포, 테스트]
    pinned: true
  - name: 리서치 봇
    emoji: 🔎
    role: research
    model: claude-sonnet-4-5
    persona: |
      시장·경쟁사 리서처. 출처와 확인 날짜를 붙이고 추정과 사실을 구분한다.
    keywords: [리서치, 시장, 경쟁사, 데이터, 트렌드]
channels:
  - name: 전체-팀
    mode: auto
    topic: 모든 봇이 참여하는 기본 채널
    members: [기획PM 봇, 풀스택 개발 봇, 리서치 봇]
  - name: 업무
    mode: mention
    bot: 기획PM 봇
    topic: 멘션으로 지정 호출하는 업무 채널
    members: [기획PM 봇, 풀스택 개발 봇, 리서치 봇]
---

## 스타터 팀 팩

- **3봇 / 2채널** · 무료
- 설치: `Teams → Market`에서 **설치** 버튼 → 봇과 채널이 STG에 바로 생성됩니다.
- 채널은 `Auto` 모드라 키워드에 따라 알맞은 봇이 답하고, `@봇이름`으로 직접 부를 수도 있습니다.
