---
id: pro-instagram
tier: pro
title: 인스타·스레드 바이럴 팀
emoji: 📸
tagline: 훅·캡션·썸네일·발행 캘린더를 나눠 맡는 콘텐츠 4봇 팀.
price: 29000
priceLabel: 29,000원
botCount: 4
channelCount: 3
purchaseUrl: ''
features: [전략·카피·비주얼·분석 봇 4종, 7일 발행 캘린더, 릴스·스레드 교차 발행 프롬프트]
team: 인스타·스레드 바이럴 팀
bots:
  - name: 콘텐츠 전략 봇
    emoji: 🎯
    role: content
    model: claude-sonnet-4-5
    persona: |
      계정 포지셔닝과 주간 발행 캘린더를 설계한다. 저장·공유를 부르는 주제를 고른다.
    keywords: [포지셔닝, 캘린더, 주제, 릴스, 스레드]
  - name: 카피 봇
    emoji: ✍️
    role: content
    model: claude-haiku-4-5
    persona: |
      첫 3초 훅과 마지막 CTA를 쓴다. 같은 메시지를 인스타용·스레드용으로 다르게 쓴다.
    keywords: [캡션, 훅, 카피, 해시태그, CTA]
  - name: 비주얼 봇
    emoji: 🎨
    role: dev
    model: claude-sonnet-4-5
    persona: |
      썸네일·카드뉴스 레이아웃을 지시문으로 만든다. 9:16/4:5 규격과 텍스트 3단어 규칙을 지킨다.
    keywords: [썸네일, 카드뉴스, 디자인, 레이아웃, 이미지]
  - name: 분석 봇
    emoji: 📊
    role: research
    model: claude-sonnet-4-5
    persona: |
      도달·저장·팔로우 전환을 주간으로 비교하고 다음 주 실험 1개를 제안한다.
    keywords: [분석, 도달, 저장, 전환, 성과]
channels:
  - name: 콘텐츠
    mode: auto
    topic: 이번 주 발행 기획
    members: [콘텐츠 전략 봇, 카피 봇, 비주얼 봇, 분석 봇]
  - name: 카피
    mode: mention
    bot: 카피 봇
    topic: 캡션·훅 다듬기
    members: [카피 봇, 콘텐츠 전략 봇]
  - name: 성과
    mode: mention
    bot: 분석 봇
    topic: 주간 성과 리뷰
    members: [분석 봇]
---

## 인스타·스레드 바이럴 팀 (Pro)

4봇 · 3채널. `#콘텐츠`에 "다음 주 발행 7편"을 요청하면 훅·캡션·해시태그·썸네일 지시문까지 한 번에 나옵니다.
