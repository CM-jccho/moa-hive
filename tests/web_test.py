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


def languages(pw):
    print("\n[4개 국어 전환 KO · EN · 中文 · 日本語]")
    browser = pw.chromium.launch()
    ctx = browser.new_context(viewport={"width": 1440, "height": 900}, locale="ko-KR")
    page = ctx.new_page()
    errors = []
    attach_logs(page, errors)
    page.goto(BASE, wait_until="networkidle")

    check("언어 선택기 4개", page.locator(".lang-switch [data-lang]").count() == 4,
          str(page.locator(".lang-switch [data-lang]").count()))
    check("기본 언어 한국어", page.inner_text("h1").startswith("설치 없이"))
    check("한국어 업종 카드", "자영업·동네 매장" in page.inner_text("#caseGallery"))

    # EN
    page.click('.lang-switch [data-lang="en"]')
    page.wait_for_timeout(400)
    check("EN 히어로 전환", "No install" in page.inner_text("h1"), page.inner_text("h1"))
    check("EN 내비게이션", "Use cases" in page.inner_text(".site-nav") and "Pro pack" in page.inner_text(".site-nav"))
    check("EN 업종 카드", "Local shop" in page.inner_text("#caseGallery"))
    check("EN 가상 오피스", "Virtual office" in page.inner_text(".d-office"))
    check("EN 오피스 인원", "agents" in page.inner_text("#officeHint"), page.inner_text("#officeHint"))
    check("EN 인스펙터 버튼", "ChatGPT" in page.inner_text("#inspPackBtn"))
    check("EN URL 파라미터", "lang=en" in page.url, page.url)
    check("EN localStorage", page.evaluate("() => localStorage.getItem('moa_lang')") == "en")
    page.screenshot(path=os.path.join(SHOTS, "web-en-hero.png"))

    # 中文
    page.click('.lang-switch [data-lang="zh"]')
    page.wait_for_timeout(400)
    zh_h1 = page.inner_text("h1")
    check("中文 히어로 전환", "无需安装" in zh_h1, zh_h1)
    check("中文 업종 카드", "个体小店" in page.inner_text("#caseGallery"))
    check("中文 가상 오피스", "虚拟办公室" in page.inner_text(".d-office"))
    check("中文 인스펙터", "配置包" in page.inner_text("#inspPackBtn"), page.inner_text("#inspPackBtn"))
    check("中文 html lang", page.get_attribute("html", "lang") == "zh-CN", page.get_attribute("html", "lang"))

    # 日本語
    page.click('.lang-switch [data-lang="ja"]')
    page.wait_for_timeout(400)
    ja_h1 = page.inner_text("h1")
    check("日本語 히어로 전환", "インストール不要" in ja_h1, ja_h1)
    check("日本語 업종 카드", "個人店" in page.inner_text("#caseGallery"))
    check("日本語 가상 오피스", "バーチャルオフィス" in page.inner_text(".d-office"))
    check("日本語 인스펙터", "セットアップパック" in page.inner_text("#inspPackBtn"), page.inner_text("#inspPackBtn"))

    # 직접 링크 (?lang=zh — 새 방문)
    page2 = ctx.new_page()
    page2.goto(BASE + "/?lang=zh", wait_until="networkidle")
    check("?lang=zh 직접 접속", "无需安装" in page2.inner_text("h1"), page2.inner_text("h1"))
    page2.close()

    # 한국어 복귀
    page.click('.lang-switch [data-lang="ko"]')
    page.wait_for_timeout(400)
    check("한국어 복귀", page.inner_text("h1").startswith("설치 없이"), page.inner_text("h1"))
    check("언어 전환 콘솔/페이지 에러 0건", len(errors) == 0, " | ".join(errors[:3]))
    ctx.close()
    browser.close()


def desktop(pw):
    print("\n[데스크톱 1440×900]")
    browser = pw.chromium.launch()
    ctx = browser.new_context(viewport={"width": 1440, "height": 900}, locale="ko-KR")
    page = ctx.new_page()
    errors = []
    attach_logs(page, errors)
    page.goto(BASE, wait_until="networkidle")

    # 랜딩 — 웹 중심
    check("브랜드 표시", "MOA Hive" in page.inner_text(".site-head"))
    hero = page.inner_text(".hero")
    check("웹 중심 히어로", "설치 없이" in page.inner_text("h1") and "내 AI 사무실" in page.inner_text("h1"))
    check("히어로 무설치 문구", "웹에서 바로" in hero and "악성 경고 없음" in hero and "API 키 없음" in hero)
    check("메인 CTA 체험", "지금 바로 가상 사무실 체험하기" in page.inner_text(".hero-actions"))
    check("메인 CTA 프로 팩", "ChatGPT/Claude 프로 팩 보기" in page.inner_text(".hero-actions"))
    check("체험 CTA → #demo", page.get_attribute('.hero-actions a[href="#demo"]', "href") == "#demo")
    check("팩 CTA → #pack", page.get_attribute('.hero-actions a[href="#pack"]', "href") == "#pack")
    check("히어로 무료 배지", "설치 0분" in hero and "서버비 0원" in hero)
    check("웹 시작 3단계", page.locator(".quick-steps li").count() == 3)
    check("다운로드 섹션 없음", page.locator("#downloads").count() == 0)
    check("설치 파일은 고급 섹션 접이식", page.locator("#advanced [data-dl=\"mac-universal\"]").count() == 1 and page.is_hidden("text=Mac용 내려받기"))
    check("mac .dmg 자산 링크", "/releases/download/v0.3.4/" in page.get_attribute('[data-dl="mac-universal"]', "href")
          and ".dmg" in page.get_attribute('[data-dl="mac-universal"]', "href"))
    check("win .exe 자산 링크", "/releases/download/v0.3.4/" in page.get_attribute('[data-dl="win-setup"]', "href")
          and ".exe" in page.get_attribute('[data-dl="win-setup"]', "href"))
    check("start.command 링크", "start.command" in page.get_attribute('[data-dl="mac-script"]', "href"))

    # 고급 섹션 열기 — Sequoia 안내 · 설치 탭
    page.locator("#desktopApp summary").click()
    page.wait_for_timeout(300)
    advanced = page.inner_text("#desktopApp")
    check("macOS Sequoia 안내 최신화", "시스템 설정 > 개인정보 보호 및 보안" in advanced and "확인 없이 열기" in advanced, advanced[:160])
    check("Windows 경고 안내", "추가 정보 → 실행" in advanced)
    page.click('[data-guide="win"]')
    check("Windows 설치 안내", "MOA-Hive-Setup-0.3.4.exe" in page.inner_text('[data-pane="win"]'))
    page.click('[data-guide="mac"]')
    check("개발자용 안내 접이식", page.locator("details.pro").count() >= 2
          and "node server.js" in page.locator("#devSetup").text_content())

    # 프로 팩 섹션
    check("프로 팩 섹션", page.locator("#pack .pack-card").count() == 3)
    pack_href = page.get_attribute("#packBuyTop", "href")
    check("래피드 판매 링크", "latpeed.com" in pack_href, pack_href)
    check("팩 가격 표시", "14,900" in page.inner_text("#pack") and "24,900" in page.inner_text("#pack"))

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

    # 데모 초기 상태
    check("일반 모드 STG/PROD 숨김", page.is_hidden(".d-env"))
    check("일반 모드 Release 탭 숨김", page.is_hidden("#tabRelease"))
    check("가상 오피스 표시", page.is_visible("#officeFloor"))
    check("오피스 캐릭터 렌더", page.locator("[data-testid=office-char]").count() >= 4,
          str(page.locator("[data-testid=office-char]").count()))
    page.locator("[data-testid=office-char]").first.click()
    page.wait_for_timeout(300)
    check("오피스 캐릭터 → 인스펙터", page.is_visible("#contextPane") and page.inner_text("#inspName") != "")

    # 세팅 팩 퍼널 — 인스펙터
    page.click("#inspPackBtn")
    page.wait_for_selector("#packSheet:not([hidden])")
    check("인스펙터 → 팩 모달", page.is_visible("#packSheet"))
    check("모달 팀 구성", page.locator("#packTeam .pack-chip").count() >= 3,
          str(page.locator("#packTeam .pack-chip").count()))
    check("모달 래피드 링크", "latpeed.com" in page.get_attribute("#packBuy", "href"))
    page.screenshot(path=os.path.join(SHOTS, "web-desktop-pack.png"))
    page.click("#closePack")
    page.wait_for_timeout(200)
    check("팩 모달 닫기", page.is_hidden("#packSheet"))

    # 관리자 모드
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
    page.fill("#relNote", "웹 데모 · 오케스트레이터 반영")
    page.click("#promoteBtn")
    page.wait_for_timeout(400)
    check("PROD 승격 v0.3.0", "v0.3.0" in page.inner_text("#relProd"), page.inner_text("#relProd"))
    check("히스토리 기록", "웹 데모" in page.inner_text("#historyList"))

    # 활용 케이스 갤러리 → 1클릭 적용 · 팩 모달
    page.locator("#cases").scroll_into_view_if_needed()
    check("케이스 카드 6개", page.locator("[data-testid=case-tile]").count() == 6,
          str(page.locator("[data-testid=case-tile]").count()))
    check("케이스 적용 버튼", page.locator("[data-apply-case]").count() == 6)
    check("케이스 팩 버튼", page.locator("[data-pack-case]").count() == 6)
    page.click('[data-pack-case="office"]')
    page.wait_for_selector("#packSheet:not([hidden])")
    check("케이스 → 팩 모달", "직장인" in page.inner_text("#packTeam"), page.inner_text("#packTeam")[:80])
    page.click("#closePack")
    page.click('[data-apply-case="store"]')
    page.wait_for_timeout(600)
    check("케이스 적용 → 채널", page.inner_text("#demoChannelName") == "#매장-마케팅", page.inner_text("#demoChannelName"))
    check("케이스 예시 대화", "단골" in page.inner_text("#demoMessages"))
    check("케이스 팀 인스펙터", page.inner_text("#inspName") in ("이벤트 기획 봇", "리뷰 케어 봇", "홍보글 봇", "매출 정리 봇"), page.inner_text("#inspName"))
    check("케이스 오피스 반영", page.locator("[data-testid=office-char]").count() >= 4)

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

    check("모바일 히어로 표시", "내 AI 사무실" in page.inner_text("h1"))
    check("모바일 랜딩 가로 오버플로 없음", overflow(page) <= 0, str(overflow(page)))
    check("모바일 체험 CTA", page.locator('a[href="#demo"]').count() >= 1)
    check("모바일 언어 선택기", page.locator(".lang-switch [data-lang]").count() == 4)
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

    # 모바일 팩 모달
    page.click("#officePackBtn")
    page.wait_for_selector("#packSheet:not([hidden])")
    check("모바일 팩 모달", page.is_visible("#packSheet"))
    check("모바일 팩 모달 오버플로 없음", overflow(page) <= 0, str(overflow(page)))
    page.click("#closePack")

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
        languages(pw)
        desktop(pw)
        mobile(pw)
    print(f"\n결과: {len(passed)} 통과 / {len(failed)} 실패")
    if failed:
        for f in failed:
            print(" -", f)
        sys.exit(1)


if __name__ == "__main__":
    main()
