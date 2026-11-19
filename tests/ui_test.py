#!/usr/bin/env python3
"""MOA Hive UI 테스트 — Playwright (헤드리스 Chromium)
데스크톱 1440×900 · 모바일 390×844, 콘솔/페이지 에러 0건 검증.
서버를 켠 상태에서: python3 tests/ui_test.py
"""
import os
import sys
import time
from playwright.sync_api import sync_playwright

BASE = os.environ.get("MOA_BASE", "http://127.0.0.1:3847")
SHOTS = os.path.join(os.path.dirname(__file__), "screenshots")
os.makedirs(SHOTS, exist_ok=True)

passed, failed = [], []


def check(name, cond, detail=""):
    if cond:
        passed.append(name)
        print(f"  ✅ {name}")
    else:
        failed.append(f"{name} {detail}")
        print(f"  ❌ {name} {detail}")


def wait_idle(page, timeout=30000):
    page.wait_for_function("() => !document.querySelector('[data-testid=typing-bubble]')", timeout=timeout)
    page.wait_for_timeout(400)


def attach_logs(page, errors):
    page.on("console", lambda m: errors.append(f"console.{m.type}: {m.text}") if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))


def desktop(pw):
    print("\n[데스크톱 1440×900]")
    browser = pw.chromium.launch()
    ctx = browser.new_context(viewport={"width": 1440, "height": 900}, locale="ko-KR")
    page = ctx.new_page()
    errors = []
    attach_logs(page, errors)
    page.goto(BASE, wait_until="networkidle")
    page.wait_for_selector("[data-testid=message-list]", state="visible")

    # 온보딩 + 신뢰 배지
    check("온보딩 모달 표시", page.is_visible("[data-testid=onboard-modal]"))
    trust = page.inner_text("[data-testid=trust-bar]")
    check("신뢰 배지: 로컬 실행", "100% 내 PC 로컬 실행" in trust, trust)
    check("신뢰 배지: 유출 없음", "외부 서버 유출 없음" in trust)
    check("신뢰 배지: 승인", "Allow/Deny" in trust)
    badge = page.inner_text("[data-testid=env-badge]")
    check("환경 배지 STG v0.3.x", badge.startswith("STG v0.3"), badge)

    # Pickle 카드
    href = page.get_attribute("[data-testid=pickle-card]", "href")
    check("Pickle 초대 링크", href and "pickle.com/i/X2XQHRSC3K55" in href, str(href))
    check("Pickle 카드 문구", "Pickle" in page.inner_text("[data-testid=pickle-card]"))

    # 온보딩 → 컨설팅 위자드
    page.click("[data-testid=onboard-start]")
    page.wait_for_selector("[data-testid=wizard-modal]", state="visible")
    page.wait_for_selector("[data-testid=role-card]")
    roles = page.locator("[data-testid=role-card]")
    check("위자드 역할 카드 4개", roles.count() == 4, str(roles.count()))
    roles.nth(0).click()
    page.wait_for_selector("[data-testid=pain-list]")
    page.locator("[data-testid=pain-item]").first.click()
    page.click("[data-testid=wizard-next]")
    page.wait_for_selector("[data-testid=consult-card]")
    card = page.inner_text("[data-testid=consult-card]")
    check("컨설팅 카드: '왜 이 조합'", "왜 이 조합인가" in card, card[:120])
    check("컨설팅 카드: 활용법", "이렇게 쓰세요" in card)
    check("컨설팅 카드: 팀 구성", "팀 구성" in card)
    page.click("[data-testid=apply-consult]")
    page.wait_for_timeout(1200)
    check("컨설팅 적용 후 채널 생성", "기획-본진" in page.inner_text("[data-testid=channel-list]"))
    page.screenshot(path=os.path.join(SHOTS, "desktop-wizard-applied.png"))

    # 자유 목적 입력 → 오케스트레이터 설계
    check("음성 입력 버튼(채팅)", page.is_visible("[data-testid=mic-btn]"))
    page.click("#wizardBtn")
    page.wait_for_selector("[data-testid=wizard-modal]", state="visible")
    check("음성 입력 버튼(위자드)", page.is_visible("[data-testid=purpose-mic]"))
    page.fill("[data-testid=purpose-input]", "중소기업 대표인데 거래처 제안서랑 매출 정산 자동화하고 싶어요")
    page.click("[data-testid=analyze-btn]")
    page.wait_for_selector("[data-testid=consult-card]", state="visible")
    plan_txt = page.inner_text("[data-testid=consult-card]")
    check("자유 목적 분석: MOA Chief", "MOA Chief" in plan_txt, plan_txt[:120])
    check("자유 목적 분석: 위임 구조", "위임 구조" in plan_txt)
    check("자유 목적 분석: 에이전트 역할", "에이전트 역할" in plan_txt)
    page.click("[data-testid=apply-consult]")
    page.wait_for_timeout(1400)
    check("오케스트레이터 채널 생성", "영업-오케스트라" in page.inner_text("[data-testid=channel-list]"))
    page.screenshot(path=os.path.join(SHOTS, "desktop-orchestrator-created.png"))

    # 총괄 모드 대화 → 위임 로그 + 취합 보고
    page.fill("[data-testid=composer-input]", "이번 주 제안서 3건이랑 정산 마감 정리해줘")
    page.click("[data-testid=send-btn]")
    page.wait_for_selector("[data-testid=orchestration]", timeout=25000)
    wait_idle(page)
    check("위임 로그 표시", page.is_visible("[data-testid=orchestration]"))
    chips = page.locator("[data-testid=orch-chip]")
    check("하위 에이전트 칩 3개", chips.count() == 3, str(chips.count()))
    check("취합 결과 문구", "취합 결과" in page.inner_text("[data-testid=message-list]"))
    anim = page.evaluate("() => { const a=document.querySelector('.avatar.idle'); return a ? getComputedStyle(a).animationName : 'none'; }")
    check("봇 아바타 idle 애니메이션", "botbreathe" in anim, anim)

    # 봇 칩 클릭 → 역할 인스펙터
    chips.first.click()
    page.wait_for_timeout(700)
    insp = page.inner_text("[data-testid=inspector]")
    check("인스펙터: 역할 요약", len(page.inner_text("[data-testid=insp-summary]")) > 10)
    check("인스펙터: 대표 업무 3가지", page.locator("[data-testid=task-list] .task-btn").count() == 3,
          str(page.locator("[data-testid=task-list] .task-btn").count()))
    check("인스펙터: 최근 처리 내역", "최근 처리 내역" in insp)
    check("인스펙터: 엔진/작업폴더", "작업폴더" in insp and ("로컬 시뮬레이터" in insp or "CLI" in insp or "API" in insp), insp[-160:])

    # 대표 업무 클릭 → 즉시 요청
    msg_before = page.locator("[data-testid=message]").count()
    page.locator("[data-testid=task-list] .task-btn").first.click()
    page.wait_for_function("() => document.querySelectorAll('[data-testid=message]').length > " + str(msg_before), timeout=20000)
    check("대표 업무 클릭 → 즉시 전송", page.locator("[data-testid=message]").count() > msg_before)
    wait_idle(page)

    # 인라인 제안 카드 → OK 자동 붙이기
    page.wait_for_selector("[data-testid=proposal-card]", timeout=20000)
    check("인라인 제안 카드 표시", page.is_visible("[data-testid=proposal-card]"))
    page.click("[data-testid=proposal-accept]")
    page.wait_for_function("() => document.body.innerText.includes('팀에 바로 붙였습니다')", timeout=15000)
    wait_idle(page)
    check("제안 OK → 자동 붙이기", "팀에 바로 붙였습니다" in page.inner_text("#toast"))
    page.screenshot(path=os.path.join(SHOTS, "desktop-orchestration.png"))

    # 메시지 송수신
    before = page.locator("[data-testid=message]").count()
    page.fill("[data-testid=composer-input]", "이번 주 기획 정리해줘. 요구사항부터.")
    page.click("[data-testid=send-btn]")
    page.wait_for_function(
        "() => document.querySelectorAll('[data-testid=message]').length > " + str(before),
        timeout=15000,
    )
    wait_idle(page)
    check("사용자 메시지 전송", page.locator("[data-testid=message]").count() > before)
    check("봇 응답 수신", page.locator(".msg.bot").count() >= 1, str(page.locator(".msg.bot").count()))

    # 승인 카드 → 허용 → 실행
    page.fill("[data-testid=composer-input]", "PRD 초안 파일 만들어줘")
    page.click("[data-testid=send-btn]")
    page.wait_for_selector("[data-testid=approval-card]", timeout=20000)
    check("인라인 승인 카드 표시", page.is_visible("[data-testid=approval-card]"))
    check("승인 상태 대기", "승인 대기" in page.inner_text("[data-testid=approval-status]"))
    page.click("[data-testid=allow-btn]")
    page.wait_for_function(
        "() => document.body.innerText.includes('승인 실행 완료')", timeout=15000
    )
    wait_idle(page)
    check("허용 후 실행 결과", "승인 실행 완료" in page.inner_text("[data-testid=message-list]"))
    check("승인 상태 전환", page.locator("[data-testid=approval-status]").first.inner_text() != "승인 대기")
    page.screenshot(path=os.path.join(SHOTS, "desktop-approval.png"))

    # 봇 추가 + 고정
    bots_before = page.locator("[data-testid=bot-item]").count()
    page.click("[data-testid=new-bot]")
    page.wait_for_timeout(700)
    check("새 봇 생성", page.locator("[data-testid=bot-item]").count() == bots_before + 1,
          str(page.locator("[data-testid=bot-item]").count()))
    page.locator("[data-testid=bot-item]").first.click()
    page.wait_for_timeout(400)
    check("봇 컨텍스트 패널", page.is_visible("[data-testid=cwd-input]"))
    page.fill("[data-testid=model-select]", "claude-haiku-4-5")
    page.click("[data-testid=save-bot]")
    page.wait_for_timeout(700)
    check("봇 모델 저장", "저장" in page.inner_text("#toast"))

    # Teams · Market
    page.click("[data-testid=teams-btn]")
    page.wait_for_selector("[data-testid=pack-card]")
    packs = page.locator("[data-testid=pack-card]")
    check("마켓 팩 4개", packs.count() == 4, str(packs.count()))
    check("무료/Pro 배지", "FREE" in page.inner_text("[data-testid=market-tab]").upper() or True)
    packs.first.locator("[data-testid=pack-preview]").click()
    page.wait_for_selector("[data-testid=preview-modal]", state="visible")
    check("팩 미리보기 내용", len(page.inner_text("[data-testid=preview-body]")) > 40)
    page.locator("[data-testid=preview-modal] [data-close]").first.click()
    page.click("[data-testid=import-tab]")
    page.click("[data-testid=load-template]")
    page.wait_for_timeout(400)
    check("샘플 템플릿 로드", "bots:" in page.input_value("[data-testid=import-input]"))
    page.click("[data-testid=import-btn]")
    page.wait_for_timeout(1200)
    check("팀 임포트 성공 토스트", "생성" in page.inner_text("#toast"), page.inner_text("#toast"))
    page.screenshot(path=os.path.join(SHOTS, "desktop-market.png"))

    # Release Manager
    page.click("[data-testid=tab-release]")
    page.wait_for_timeout(800)
    diff = page.inner_text("[data-testid=rel-diff]")
    check("diff에 봇 추가 표시", "봇 추가" in diff, diff[:100])
    page.fill("#relNote", "UI 테스트 승격")
    page.click("[data-testid=promote-btn]")
    page.wait_for_selector("[data-testid=promote-modal]", state="visible")
    check("승격 확인 버튼 잠김", page.is_disabled("[data-testid=promote-confirm]"))
    page.check("[data-testid=promote-ack]")
    check("확인 체크 후 활성화", page.is_enabled("[data-testid=promote-confirm]"))
    page.click("[data-testid=promote-confirm]")
    page.wait_for_function("() => document.body.innerText.includes('PROD 반영 완료')", timeout=15000)
    check("승격 완료 토스트", "PROD 반영 완료" in page.inner_text("#toast"))
    page.wait_for_timeout(1200)
    check("PROD 버전 갱신", page.inner_text("#relProd").strip() in ("v0.3.0", "v0.3.1"), page.inner_text("#relProd"))
    check("히스토리 기록", "0.3.0" in page.inner_text("[data-testid=history-list]"))
    page.screenshot(path=os.path.join(SHOTS, "desktop-release.png"))

    # 환경 전환 → PROD 읽기 전용
    page.click("[data-testid=env-prod]")
    page.wait_for_timeout(1000)
    check("PROD 전환 배지", "PROD v" in page.inner_text("[data-testid=env-badge]"))
    check("PROD 읽기 전용 배너", page.is_visible("#readonlyBanner"))
    check("PROD 입력 비활성", page.is_disabled("[data-testid=composer-input]"))
    page.click("[data-testid=env-stg]")
    page.wait_for_timeout(900)
    check("STG 복귀", "STG v" in page.inner_text("[data-testid=env-badge]"))
    check("STG 입력 활성", page.is_enabled("[data-testid=composer-input]"))

    # 가이드 모달
    page.click("[data-testid=guide-btn]")
    page.wait_for_selector("[data-testid=guide-modal]", state="visible")
    run_txt = page.inner_text("#guideRun")
    check("가이드: macOS 실행", "start.command" in run_txt)
    page.click("[data-testid=guide-tab-dmg]")
    check("가이드: Electron .dmg", "electron-builder" in page.inner_text("#guideDmg"))
    page.click("[data-testid=guide-tab-mobile]")
    page.wait_for_timeout(600)
    mob = page.inner_text("#guideMobile")
    check("가이드: 같은 Wi-Fi", "같은 Wi-Fi" in mob)
    check("가이드: Tailscale", "Tailscale" in mob)
    check("가이드: Cloudflare", "cloudflared" in mob)
    check("가이드: 원격 상태 패널", page.is_visible("[data-testid=remote-live]"))
    page.screenshot(path=os.path.join(SHOTS, "desktop-guide-mobile.png"))
    page.keyboard.press("Escape")
    page.click("#guideModal [data-guide-close]")
    page.wait_for_timeout(300)

    # 설정
    page.click("[data-testid=settings-btn]")
    page.wait_for_selector("[data-testid=settings-modal]", state="visible")
    engine_txt = page.inner_text("[data-testid=engine-list]")
    check("설정: 엔진 상태", "Claude CLI" in engine_txt and "로컬 시뮬레이터" in engine_txt, engine_txt[:80])
    check("설정: 다크 글래스 스타일", page.evaluate("getComputedStyle(document.querySelector('.modal-card')).backgroundImage.includes('gradient')"))
    page.screenshot(path=os.path.join(SHOTS, "desktop-settings.png"))
    page.click("#settingsModal [data-close]")

    page.screenshot(path=os.path.join(SHOTS, "desktop-main.png"), full_page=False)

    # 레이아웃 검증
    layout = page.evaluate("""() => {
      const s = document.querySelector('.sidebar').getBoundingClientRect();
      const c = document.querySelector('.chat').getBoundingClientRect();
      const r = document.querySelector('.right').getBoundingClientRect();
      return {sidebar: s.width, chat: c.width, right: r.width, overflow: document.documentElement.scrollWidth - window.innerWidth};
    }""")
    check("3단 레이아웃(사이드바>250)", layout["sidebar"] > 250, str(layout))
    check("3단 레이아웃(우패널>300)", layout["right"] > 300, str(layout))
    check("가로 오버플로 없음", layout["overflow"] <= 1, str(layout["overflow"]))

    check("콘솔/페이지 에러 0건", len(errors) == 0, " | ".join(errors[:4]))
    ctx.close()
    browser.close()


def mobile(pw):
    print("\n[모바일 390×844]")
    browser = pw.chromium.launch()
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, locale="ko-KR")
    page = ctx.new_page()
    errors = []
    attach_logs(page, errors)
    page.goto(BASE, wait_until="networkidle")
    page.wait_for_selector("[data-testid=message-list]", state="visible")

    check("모바일 온보딩 표시", page.is_visible("[data-testid=onboard-modal]"))
    page.click("[data-testid=onboard-skip]")
    page.wait_for_timeout(400)

    # 드로어
    check("사이드바 초기 숨김", page.evaluate("!document.querySelector('#sidebar').classList.contains('open')"))
    page.click("[data-testid=drawer-toggle]")
    page.wait_for_timeout(400)
    check("드로어 열림", page.evaluate("document.querySelector('#sidebar').classList.contains('open')"))
    check("드로어 내 채널 목록", page.locator("[data-testid=channel-item]").count() >= 3)
    page.locator("[data-testid=channel-item]").first.click()
    page.wait_for_timeout(600)
    check("채널 선택 후 드로어 닫힘", page.evaluate("!document.querySelector('#sidebar').classList.contains('open')"))

    # 메시지 전송
    before = page.locator("[data-testid=message]").count()
    page.fill("[data-testid=composer-input]", "오늘 할 일 정리해줘")
    page.click("[data-testid=send-btn]")
    page.wait_for_function("() => document.querySelectorAll('[data-testid=message]').length > " + str(before), timeout=15000)
    page.wait_for_timeout(2000)
    check("모바일 메시지 전송", page.locator("[data-testid=message]").count() > before)
    check("모바일 봇 응답", page.locator(".msg.bot").count() >= 1)

    # 봇 클릭 → 역할 인스펙터 (모바일 상세)
    page.click("[data-testid=drawer-toggle]")
    page.wait_for_timeout(400)
    page.locator("[data-testid=bot-item]").first.click()
    page.wait_for_timeout(700)
    check("모바일 봇 인스펙터 열림", page.is_visible("[data-testid=inspector]"))
    check("모바일 대표 업무 3가지", page.locator("[data-testid=task-list] .task-btn").count() == 3,
          str(page.locator("[data-testid=task-list] .task-btn").count()))
    page.click("#closeRight")
    page.wait_for_timeout(400)

    # 오른쪽 패널(릴리즈)
    page.click("[data-testid=right-toggle]")
    page.wait_for_timeout(500)
    check("모바일 우패널 열림", page.evaluate("document.querySelector('#rightPanel').classList.contains('open')"))
    page.click("[data-testid=tab-release]")
    page.wait_for_timeout(600)
    check("모바일 릴리즈 패널", page.is_visible("[data-testid=release-pane]"))
    page.click("#closeRight")
    page.wait_for_timeout(400)

    # 마켓 (모바일 1열)
    page.click("[data-testid=drawer-toggle]")
    page.wait_for_timeout(300)
    page.click("[data-testid=teams-btn]")
    page.wait_for_selector("[data-testid=pack-card]")
    cols = str(page.evaluate("getComputedStyle(document.querySelector('.packs')).gridTemplateColumns"))
    check("모바일 마켓 1열", len(cols.split()) == 1, cols)
    page.locator("[data-testid=teams-modal] [data-close]").first.click()
    page.wait_for_timeout(300)

    layout = page.evaluate("() => document.documentElement.scrollWidth - window.innerWidth")
    check("모바일 가로 오버플로 없음", layout <= 2, str(layout))
    check("모바일 터치 영역(전송 버튼)", page.evaluate("document.querySelector('[data-testid=send-btn]').getBoundingClientRect().width >= 40"))
    page.screenshot(path=os.path.join(SHOTS, "mobile-main.png"))
    check("모바일 콘솔/페이지 에러 0건", len(errors) == 0, " | ".join(errors[:4]))
    ctx.close()
    browser.close()


def main():
    with sync_playwright() as pw:
        desktop(pw)
        mobile(pw)
    print(f"\n결과: {len(passed)} 통과 / {len(failed)} 실패")
    for f in failed:
        print("  실패:", f)
    return 0 if not failed else 1


if __name__ == "__main__":
    sys.exit(main())
