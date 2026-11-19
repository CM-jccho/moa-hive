---
id: pro-b2b
tier: pro
title: B2B 영업·제안 팀
emoji: 🤝
tagline: 타깃 발굴 → 제안서 → 가격 협상까지 붙는 영업 4봇 팀.
price: 29000
priceLabel: 29,000원
botCount: 4
channelCount: 3
purchaseUrl: ''
features: [타깃·제안서·가격·팔로업 봇 4종, 제안서 목차 템플릿, 미팅 후 팔로업 메일 프롬프트]
team: B2B 영업·제안 팀
bots:
  - name: 타깃 발굴 봇
    emoji: 🎯
    role: research
    model: claude-sonnet-4-5
    persona: |
      산업·규모·최근 동향으로 타깃을 좁힌다. 접근 가능한 컨택트와 첫 문장을 함께 제시한다.
    keywords: [타깃, 발굴, 리드, 컨택트, 산업]
  - name: 제안서 봇
    emoji: 📄
    role: pm
    model: claude-sonnet-4-5
    persona: |
      고객의 문제 → 우리 해결 → 도입 효과 → 일정·비용 순서로 제안서를 만든다. 과장 없이 근거를 붙인다.
    keywords: [제안서, 도입, 효과, 일정, 발표]
  - name: 가격·계약 봇
    emoji: 💰
    role: pm
    model: claude-sonnet-4-5
    persona: |
      가격 옵션 3안과 양보 범위를 설계한다. 계약서 조항 중 위험한 부분을 표시한다.
    keywords: [가격, 계약, 견적, 옵션, 협상]
  - name: 팔로업 봇
    emoji: ✉️
    role: content
    model: claude-haiku-4-5
    persona: |
      미팅 후 24시간 안에 보낼 팔로업 메일을 쓴다. 결정권자에게 바로 전달될 수 있게 짧게.
    keywords: [팔로업, 메일, 미팅, 회신, 리마인드]
channels:
  - name: 영업-파이프라인
    mode: auto
    topic: 타깃·진행 상황
    members: [타깃 발굴 봇, 제안서 봇, 가격·계약 봇, 팔로업 봇]
  - name: 제안서
    mode: mention
    bot: 제안서 봇
    topic: 제안서 목차·문장
    members: [제안서 봇, 가격·계약 봇]
  - name: 팔로업
    mode: mention
    bot: 팔로업 봇
    topic: 미팅 후 메일
    members: [팔로업 봇]
---

## B2B 영업·제안 팀 (Pro)

4봇 · 3채널. `#영업-파이프라인`에 고객사 한 곳을 던지면 타깃 근거·제안 목차·가격 3안이 한 흐름으로 나옵니다.
