#!/usr/bin/env python3
"""MOA Hive — GitHub Pages 웹/모바일(PWA) 테스트

정적 문서(docs/)를 로컬 HTTP 서버로 서빙한 뒤 Playwright 헤드리스 Chromium으로 검증합니다.
  cd moa-hive/docs && python3 -m http.server 8080
  cd moa-hive && python3 tests/web_test.py
기준: 데스크톱 1440×900 · 모바일 390×844 · 콘솔/페이지 에러 0건 · 가로 오버플로 0건
"""
import json
import os
import sys
import urllib.request

from playwright.sync_api import sync_playwright

BASE = os.environ.get("MOA_WEB", "http://127.0.0.1:8080")
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


def attach_logs(page, errors):
    page.on("console", lambda m: errors.append(f"console.{m.type}: {m.text}") if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))


def overflow(page):
    return page.evaluate("() => document.documentElement.scrollWidth - window.innerWidth")


def wait_chief(page, timeout=20000):
    page.wait_for_function(
        "() => { const m = document.querySelector('#demoMessages');"
        " return m && m.getAttribute('data-busy') === '0'"
        " && document.querySelectorAll('.d-step.done').length >= 3"
        " && document.querySelector('.d-summary'); }",
        timeout=timeout,
    )
    page.wait_for_timeout(250)


def fetch_json(url):
    with urllib.request.urlopen(url, timeout=10) as r:
        return r.status, json.loads(r.read().decode())


def desktop(pw):
    print("\n[데스크톱 1440×900]")
    browser = pw.chromium.launch()
    ctx = browser.new_context(viewport={"width": 1440, "height": 900}, locale="ko-KR")
    page = ctx.new_page()
    errors = []
    attach_logs(page, errors)
    page.goto(BASE, wait_until="networkidle")

    # 랜딩
    check("브랜드 표시", "MOA Hive" in page.inner_text(".site-head"))
    hero = page.inner_text(".hero")
    check("로컬 프라이버시 강조", "내 컴퓨터 안에만 저장" in hero and "AI 팀이 알아서" in page.inner_text("h1"))
    check("3단계 설치 안내", page.locator(".quick-steps li").count() == 3, str(page.locator(".quick-steps li").count()))
    check("macOS·Windows 다운로드 카드", page.locator(".dl-card.mac").count() == 1 and page.locator(".dl-card.win").count() == 1)
    mac = page.get_attribute('[data-dl="mac-universal"]', "href")
    win = page.get_attribute('[data-dl="win-setup"]', "href")
    check("mac .dmg 자산 링크", "/releases/download/v0.3.2/" in mac and ".dmg" in mac, str(mac))
    check("win .exe 자산 링크", "/releases/download/v0.3.2/" in win and ".exe" in win, str(win))
    check("start.command 링크", "start.command" in page.get_attribute('[data-dl="mac-script"]', "href"))
    check("start.bat 링크", "start.bat" in page.get_attribute('[data-dl="win-script"]', "href"))

    # 설치 탭
    page.click('[data-guide="win"]')
    check("Windows 설치 안내", "MOA-Hive-Setup-0.3.2.exe" in page.inner_text('[data-pane="win"]'))
    page.click('[data-guide="mac"]')
    check("개발자용 안내 접이식", page.locator("details.pro").count() >= 1 and "node server.js" in page.locator("details.pro").first.text_content())

    # PWA
    href = page.get_attribute('link[rel="manifest"]', "href")
    status, manifest = fetch_json(BASE.rstrip("/") + "/" + href.lstrip("./"))
    check("manifest 200", status == 200)
    check("manifest 이름", manifest.get("name", "").startswith("MOA Hive"), manifest.get("name"))
    check("manifest standalone", manifest.get("display") == "standalone")
    check("manifest 아이콘 3종", len(manifest.get("icons", [])) >= 3, str(len(manifest.get("icons", []))))
    reg = page.evaluate(
        "async () => { if (!('serviceWorker' in navigator)) return 'none';"
        " const r = await navigator.serviceWorker.getRegistration(); return r ? 'ok' : 'none'; }"
    )
    check("서비스 워커 등록", reg == "ok", reg)
    check("모바일 뷰포트 메타", "width=device-width" in page.get_attribute('meta[name="viewport"]', "content"))

    # 데모 초기 상태 — 일반 모드에서는 관리자 도구 숨김, 가상 오피스 표시
    check("일반 모드 STG/PROD 숨김", page.is_hidden(".d-env"))
    check("일반 모드 Release 탭 숨김", page.is_hidden("#tabRelease"))
    check("가상 오피스 표시", page.is_visible("#officeFloor"))
    check("오피스 캐릭터 렌더", page.locator("[data-testid=office-char]").count() >= 4,
          str(page.locator("[data-testid=office-char]").count()))
    page.locator("[data-testid=office-char]").first.click()
    page.wait_for_timeout(300)
    check("오피스 캐릭터 → 인스펙터", page.is_visible("#contextPane") and page.inner_text("#inspName") != "")

    # 관리자 모드 켜기
    page.click("#adminToggle")
    page.wait_for_timeout(300)
    check("관리자 모드 STG/PROD 표시", page.is_visible(".d-env"))
    check("관리자 모드 Release 탭 표시", page.is_visible("#tabRelease"))
    check("기본 채널 #전체-팀", page.inner_text("#demoChannelName") == "#전체-팀")
    check("봇 인스펙터 기본값", "MOA Chief" in page.inner_text("#inspName"))

    # 자유 목적 컨설팅
    page.click("#wizardBtn")
    page.wait_for_selector("#wizardSheet:not([hidden])")
    check("업종 카드 4개", page.locator("[data-role]").count() == 4, str(page.locator("[data-role]").count()))
    page.fill("#purposeInput", "중소기업 대표인데 거래처 제안서랑 매출 정산 자동화하고 싶어요")
    page.click("#designBtn")
    design = page.inner_text("#designCard")
    check("설계안: MOA Chief", "MOA Chief" in design, design[:120])
    check("설계안: 제안서 에이전트", "제안서" in design)
    check("설계안: 정산 에이전트", "정산" in design)
    check("설계안: 채널", "영업-오케스트라" in design)
    page.screenshot(path=os.path.join(SHOTS, "web-desktop-wizard.png"))
    page.click("#applyDesignBtn")
    page.wait_for_timeout(400)
    check("팀 생성 후 채널 전환", page.inner_text("#demoChannelName") == "#영업-오케스트라", page.inner_text("#demoChannelName"))
    check("총괄 인스펙터", "MOA Chief" in page.inner_text("#inspName"))
    check("채널 목록에 오케스트라", "영업-오케스트라" in page.inner_text("#channelList"))

    # 채팅 · 위임 · 제안
    page.fill("#demoInput", "이번 주 거래처 제안서와 정산 마감을 정리해줘")
    page.click("#demoSend")
    wait_chief(page)
    check("사용자 메시지 표시", "정산 마감" in page.inner_text("#demoMessages"))
    check("위임 단계 3건 완료", page.locator(".d-step.done").count() == 3, str(page.locator(".d-step.done").count()))
    check("오피스 캐릭터 작업 완료", page.locator("[data-testid=office-char].working").count() == 0)
    check("취합 결과 표시", "취합 결과" in page.inner_text("#demoMessages"))
    check("인라인 제안 카드", page.locator(".d-proposal").count() == 1)
    bots_before = page.locator("#botList [data-bot]").count()
    page.click('[data-prop="ok"]')
    page.wait_for_timeout(300)
    bots_after = page.locator("#botList [data-bot]").count()
    check("제안 OK → 팀 반영", bots_after >= bots_before, f"{bots_before}→{bots_after}")
    check("제안 처리 완료 문구", "반영" in page.inner_text(".d-proposal"))

    # 역할 인스펙터
    page.locator("#botList [data-bot]").nth(1).click()
    check("봇 선택 시 인스펙터 변경", page.inner_text("#inspName") not in ("", "—"))
    check("대표 업무 3가지", page.locator("[data-task]").count() == 3, str(page.locator("[data-task]").count()))
    page.locator("[data-task]").first.click()
    page.wait_for_timeout(1200)
    check("업무 클릭 → 요청 전송", "이번 주" in page.inner_text("#demoMessages") or "PRD" in page.inner_text("#demoMessages"))

    # STG / PROD
    page.click("#envProd")
    page.wait_for_timeout(200)
    check("PROD 읽기 전용 배너", page.is_visible("#demoReadonly"))
    check("PROD 입력 비활성", page.is_disabled("#demoInput"))
    check("PROD 배지 v0.1.0", "PROD v0.1.0" in page.inner_text("#envBadge"), page.inner_text("#envBadge"))
    page.click("#envStg")
    check("STG 복귀", page.is_enabled("#demoInput"))

    # 릴리스 승격
    page.click("#tabRelease")
    page.wait_for_selector("#releasePane:not([hidden])")
    check("STG/PROD 버전 표시", "0.3.0-rc" in page.inner_text("#relStg") and "0.1.0" in page.inner_text("#relProd"))
    check("승격 버튼 초기 비활성", page.is_disabled("#promoteBtn"))
    page.check("#promoteAck")
    check("확인 체크 후 활성", page.is_enabled("#promoteBtn"))
    page.screenshot(path=os.path.join(SHOTS, "web-desktop-release.png"))
    page.fill("#relNote", "웹 데모 · 오케스트레이터 반영")
    page.click("#promoteBtn")
    page.wait_for_timeout(400)
    check("PROD 승격 v0.3.0", "v0.3.0" in page.inner_text("#relProd"), page.inner_text("#relProd"))
    check("히스토리 기록", "웹 데모" in page.inner_text("#historyList"))

    # 반응형 · 콘솔
    check("데스크톱 가로 오버플로 없음", overflow(page) <= 0, str(overflow(page)))
    page.screenshot(path=os.path.join(SHOTS, "web-desktop-demo.png"), full_page=False)
    check("데스크톱 콘솔/페이지 에러 0건", len(errors) == 0, " | ".join(errors[:3]))
    ctx.close()
    browser.close()


def mobile(pw):
    print("\n[모바일 390×844]")
    browser = pw.chromium.launch()
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, locale="ko-KR", is_mobile=True, has_touch=True)
    page = ctx.new_page()
    errors = []
    attach_logs(page, errors)
    page.goto(BASE, wait_until="networkidle")

    check("모바일 히어로 표시", "AI 팀이 알아서" in page.inner_text("h1"))
    check("모바일 랜딩 가로 오버플로 없음", overflow(page) <= 0, str(overflow(page)))
    check("모바일 체험 CTA", page.locator('a[href="#demo"]').count() >= 1)
    check("모바일 가상 오피스", page.is_visible("#officeFloor"))
    page.locator("[data-testid=office-char]").first.click()
    page.wait_for_timeout(300)
    check("모바일 오피스 캐릭터 → 인스펙터", page.inner_text("#inspName") != "")

    # 업종 선택 컨설팅
    page.click("#wizardBtn")
    page.wait_for_selector("#wizardSheet:not([hidden])")
    check("모바일 업종 카드 4개", page.locator("[data-role]").count() == 4)
    page.locator("[data-role]").nth(2).click()
    page.click("#designBtn")
    check("모바일 설계안", "MOA Chief" in page.inner_text("#designCard"))
    page.click("#applyDesignBtn")
    page.wait_for_timeout(400)
    check("모바일 채널 생성", page.inner_text("#demoChannelName") == "#콘텐츠-기획", page.inner_text("#demoChannelName"))

    page.fill("#demoInput", "다음 주 발행 7편 기획해줘")
    page.click("#demoSend")
    wait_chief(page)
    check("모바일 위임 3건", page.locator(".d-step.done").count() == 3)
    check("모바일 제안 카드", page.locator(".d-proposal").count() == 1)
    check("모바일 인스펙터 표시", page.is_visible("#inspName") and "MOA Chief" in page.inner_text("#inspName"))
    check("모바일 업무 3가지", page.locator("[data-task]").count() == 3)
    check("모바일 전송 버튼 터치 영역", page.evaluate("() => { const r = document.querySelector('#demoSend').getBoundingClientRect(); return r.width >= 36 && r.height >= 36; }"))

    box = page.evaluate("() => { const r = document.querySelector('#demoInput').getBoundingClientRect(); return r.width > 0 && r.height > 0; }")
    check("모바일 입력창 표시", box)
    check("모바일 가로 오버플로 없음", overflow(page) <= 0, str(overflow(page)))
    page.screenshot(path=os.path.join(SHOTS, "web-mobile-demo.png"))
    check("모바일 콘솔/페이지 에러 0건", len(errors) == 0, " | ".join(errors[:3]))
    ctx.close()
    browser.close()


def main():
    print(f"\nMOA Hive 웹 테스트 — {BASE}")
    with sync_playwright() as pw:
        desktop(pw)
        mobile(pw)
    print(f"\n결과: {len(passed)} 통과 / {len(failed)} 실패")
    if failed:
        for f in failed:
            print(" -", f)
        sys.exit(1)


if __name__ == "__main__":
    main()
