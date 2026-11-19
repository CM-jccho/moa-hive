#!/usr/bin/env python3
"""MOA Hive — GitHub Pages 웹/모바일(PWA) 테스트 (3단계 체험판 + 2D 가상 사무실)

정적 문서(docs/)를 로컬 HTTP 서버로 서빙한 뒤 Playwright 헤드리스 Chromium으로 검증합니다.
  cd moa-hive/docs && python3 -m http.server 8080
  cd moa-hive && python3 tests/web_test.py
기준: 데스크톱 1440×900 · 모바일 390×844 · 콘솔/페이지 에러 0건 · 가로 오버플로 0건
"""
import json
import os
import re
import sys
import urllib.request

from playwright.sync_api import sync_playwright

BASE = os.environ.get("MOA_WEB", "http://127.0.0.1:8080")
SHOTS = os.path.join(os.path.dirname(__file__), "screenshots")
os.makedirs(SHOTS, exist_ok=True)

passed, failed = [], []

JARGON = ["오케스트레이션", "승인 카드", "컨설팅", "인스펙터", "STG", "PROD"]


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


def wait_chief(page, timeout=25000):
    page.wait_for_function(
        "() => { const m = document.querySelector('#demoMessages');"
        " return m && m.getAttribute('data-busy') === '0'"
        " && document.querySelectorAll('.d-deleg .d-step.done').length >= 3"
        " && document.querySelector('.d-summary'); }",
        timeout=timeout,
    )
    page.wait_for_timeout(300)


def fetch_json(url):
    with urllib.request.urlopen(url, timeout=10) as r:
        return r.status, json.loads(r.read().decode())


CANVAS_INFO = """() => {
  const c = document.querySelector('#officeCanvas');
  const r = c.getBoundingClientRect();
  return { w: c.width, h: c.height, cw: Math.round(r.width), ch: Math.round(r.height), dpr: devicePixelRatio };
}"""

CANVAS_STATS = """() => {
  const c = document.querySelector('#officeCanvas');
  const g = c.getContext('2d');
  const d = g.getImageData(0, 0, c.width, c.height).data;
  let sum = 0, n = 0, min = 255, max = 0;
  const colors = new Set();
  for (let i = 0; i < d.length; i += 4 * 97) {
    const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    sum += l; n++;
    if (l < min) min = l;
    if (l > max) max = l;
    colors.add((d[i] >> 3) + ',' + (d[i + 1] >> 3) + ',' + (d[i + 2] >> 3));
  }
  return { luma: sum / n, min: min, max: max, colors: colors.size };
}"""


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
    check("한국어 3단계 안내", "내 업종 고르기" in page.inner_text("#demoSteps")
          and "ChatGPT에 붙여넣기" in page.inner_text("#demoSteps"))
    check("한국어 업종 카드 6개", page.locator("[data-testid=case-tile]").count() == 6,
          str(page.locator("[data-testid=case-tile]").count()))
    check("한국어 업종 카드 이름", "동네 매장" in page.inner_text("#caseGallery"))
    check("한국어 오피스 제목", "내 AI 사무실" in page.inner_text(".d-office-head"))
    check("한국어 퀵 버튼 3개", page.locator(".d-quick-btn").count() == 3)

    # EN
    page.click('.lang-switch [data-lang="en"]')
    page.wait_for_timeout(500)
    check("EN 히어로 전환", "No install" in page.inner_text("h1"), page.inner_text("h1"))
    check("EN 3단계 라벨", "Pick your business" in page.inner_text("#demoSteps"), page.inner_text("#demoSteps"))
    check("EN 업종 카드", "Local shop" in page.inner_text("#caseGallery"))
    check("EN 오피스 제목", "My AI office" in page.inner_text(".d-office-head"))
    check("EN 퀵 버튼", "Sort this week" in page.inner_text("#quickTasks"), page.inner_text("#quickTasks"))
    check("EN 시간대 배지", page.inner_text("#officePhase") in ("Day", "Sunset", "Night"),
          page.inner_text("#officePhase"))
    check("EN URL 파라미터", "lang=en" in page.url, page.url)
    check("EN localStorage", page.evaluate("() => localStorage.getItem('moa_lang')") == "en")
    page.locator("#officeStage").screenshot(path=os.path.join(SHOTS, "web-en-office.png"))

    # 中文
    page.click('.lang-switch [data-lang="zh"]')
    page.wait_for_timeout(500)
    zh_h1 = page.inner_text("h1")
    check("中文 히어로 전환", "无需安装" in zh_h1, zh_h1)
    check("中文 업종 카드", "小店" in page.inner_text("#caseGallery"))
    check("中文 오피스 제목", "我的 AI 办公室" in page.inner_text(".d-office-head"))
    check("中文 html lang", page.get_attribute("html", "lang") == "zh-CN", page.get_attribute("html", "lang"))

    # 日本語
    page.click('.lang-switch [data-lang="ja"]')
    page.wait_for_timeout(500)
    ja_h1 = page.inner_text("h1")
    check("日本語 히어로 전환", "インストール不要" in ja_h1, ja_h1)
    check("日本語 업종 카드", "個人店" in page.inner_text("#caseGallery"))
    check("日本語 오피스 제목", "私のAIオフィス" in page.inner_text(".d-office-head"))

    # 직접 링크 (?lang=zh — 새 방문)
    page2 = ctx.new_page()
    page2.goto(BASE + "/?lang=zh", wait_until="networkidle")
    check("?lang=zh 직접 접속", "无需安装" in page2.inner_text("h1"), page2.inner_text("h1"))
    page2.close()

    # 한국어 복귀
    page.click('.lang-switch [data-lang="ko"]')
    page.wait_for_timeout(500)
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

    # 랜딩
    check("브랜드 표시", "MOA Hive" in page.inner_text(".site-head"))
    check("웹 중심 히어로", "설치 없이" in page.inner_text("h1") and "내 AI 사무실" in page.inner_text("h1"))
    check("메인 CTA → 체험", page.get_attribute('.hero-actions a[href="#demo"]', "href") == "#demo")
    check("메인 CTA → 팩", page.get_attribute('.hero-actions a[href="#pack"]', "href") == "#pack")
    check("히어로 무료 배지", "설치 0분" in page.inner_text(".hero-meta") and "서버비 0원" in page.inner_text(".hero-meta"))
    check("중복 안내 섹션 없음", page.locator(".quick-steps").count() == 0)

    # 3단계 안내 바
    check("3단계 안내 3개", page.locator("#demoSteps .d-gstep").count() == 3,
          str(page.locator("#demoSteps .d-gstep").count()))
    check("1단계 활성", page.get_attribute(".d-gstep[data-step='1']", "class").find("is-active") >= 0)
    check("진행 단계 data 속성", page.get_attribute("#demoSteps", "data-current") == "1",
          page.get_attribute("#demoSteps", "data-current"))
    check("안내 바 상단 고정", page.evaluate("() => getComputedStyle(document.querySelector('#demoSteps')).position") == "sticky")

    # 1단계 업종
    check("업종 카드 6개", page.locator("[data-testid=case-tile]").count() == 6)
    check("업종 카드 접근성", page.locator("[data-testid=case-tile][aria-pressed]").count() == 6)
    check("기본 팀 칩", "내 AI 팀" in page.inner_text("#currentTeam"), page.inner_text("#currentTeam"))
    check("기본 퀵 버튼 3개", page.locator(".d-quick-btn").count() == 3)

    # 2D 사무실 캔버스
    check("가상 사무실 표시", page.is_visible("#officeFloor"))
    info = page.evaluate(CANVAS_INFO)
    check("캔버스 크기", info["cw"] > 300 and info["ch"] >= 190, str(info))
    check("캔버스 고해상도 DPR", info["w"] == round(info["cw"] * info["dpr"]) and info["h"] == round(info["ch"] * info["dpr"]), str(info))
    stats = page.evaluate(CANVAS_STATS)
    check("캔버스 실제 렌더", stats["colors"] > 24 and stats["max"] - stats["min"] > 60, str(stats))
    check("오피스 캐릭터 렌더", page.locator("[data-testid=office-char]").count() >= 5,
          str(page.locator("[data-testid=office-char]").count()))
    check("실시간 시계", re.match(r"^\d{2}:\d{2}$", page.inner_text("#officeClock")) is not None,
          page.inner_text("#officeClock"))
    check("시간대 배지", page.inner_text("#officePhase") in ("낮", "노을", "밤"), page.inner_text("#officePhase"))
    check("시간대 토글 4개", page.locator("#officeTimes [data-office-time]").count() == 4)
    page.screenshot(path=os.path.join(SHOTS, "web-desktop-top.png"))

    # 시간대 미리보기 — 낮/밤 밝기 차이
    page.click('[data-office-time="day"]')
    page.wait_for_timeout(350)
    day = page.evaluate(CANVAS_STATS)
    check("낮 미리보기", page.get_attribute("#officeStage", "data-phase") == "day"
          and page.inner_text("#officePhase") == "낮", page.inner_text("#officePhase"))
    page.locator("#officeStage").screenshot(path=os.path.join(SHOTS, "office-day.png"))
    page.click('[data-office-time="night"]')
    page.wait_for_timeout(350)
    night = page.evaluate(CANVAS_STATS)
    check("밤 미리보기", page.get_attribute("#officeStage", "data-phase") == "night"
          and page.inner_text("#officePhase") == "밤", page.inner_text("#officePhase"))
    check("밤은 실제로 어둡게 렌더", night["luma"] < day["luma"] * 0.85, f"{day['luma']:.1f} → {night['luma']:.1f}")
    page.locator("#officeStage").screenshot(path=os.path.join(SHOTS, "office-night.png"))
    page.click('[data-office-time="auto"]')
    page.wait_for_timeout(250)
    check("자동 시간대 복귀", page.inner_text("#officePhase") in ("낮", "노을", "밤"))

    # 1단계 — 업종 적용
    page.click('[data-apply-case="store"]')
    page.wait_for_timeout(700)
    check("업종 적용 → 2단계", "is-active" in (page.get_attribute(".d-gstep[data-step='2']", "class") or ""))
    check("업종 적용 → 팀 칩", "동네 매장" in page.inner_text("#currentTeam"), page.inner_text("#currentTeam"))
    check("업종 적용 → 카드 선택 표시", page.get_attribute('[data-apply-case="store"]', "aria-pressed") == "true")
    check("업종 적용 → 사무실 인원", page.locator("[data-testid=office-char]").count() == 5,
          str(page.locator("[data-testid=office-char]").count()))
    check("업종 적용 → 팀장 힌트", "MOA Chief" in page.inner_text("#officeHint"), page.inner_text("#officeHint"))
    check("업종 적용 → 퀵 버튼 교체", "단골 이벤트" in page.inner_text("#quickTasks"), page.inner_text("#quickTasks"))

    # 캐릭터 클릭 → 역할 카드
    page.locator("[data-testid=office-char]").first.click()
    page.wait_for_timeout(350)
    check("캐릭터 클릭 → 역할 카드", page.is_visible("#botSheet"), str(page.is_visible("#botSheet")))
    check("역할 카드 이름", page.inner_text("#inspName") != "", page.inner_text("#inspName"))
    check("역할 카드 업무 3개", page.locator("[data-task]").count() == 3, str(page.locator("[data-task]").count()))
    page.screenshot(path=os.path.join(SHOTS, "web-desktop-botcard.png"))
    page.click("#closeBot")
    page.wait_for_timeout(200)
    check("역할 카드 닫기", page.is_hidden("#botSheet"))

    # 2단계 — 큰 버튼으로 시키기
    check("한 줄 입력창", page.is_visible("#demoInput") and page.is_visible("#demoSend"))
    page.locator(".d-quick-btn").first.click()
    page.wait_for_timeout(900)
    check("버튼 → 내 메시지", "단골 이벤트" in page.inner_text("#demoMessages"), page.inner_text("#demoMessages")[:120])
    check("버튼 → 봇 작업 표시", page.locator("[data-testid=office-char].working").count() >= 1,
          str(page.locator("[data-testid=office-char].working").count()))
    bubbles = page.locator(".office-hit.has-bubble .office-bubble").all_inner_texts()
    check("버튼 → 상태 말풍선", any(b.strip() for b in bubbles), str(bubbles))
    page.locator("#officeStage").screenshot(path=os.path.join(SHOTS, "office-working.png"))

    wait_chief(page)
    check("위임 단계 3건 완료", page.locator(".d-deleg .d-step.done").count() == 3,
          str(page.locator(".d-deleg .d-step.done").count()))
    check("작업 종료 후 working 0", page.locator("[data-testid=office-char].working").count() == 0)
    check("정리 결과 표시", "정리 결과" in page.inner_text("#demoMessages"))
    check("제안 카드 1개", page.locator(".d-proposal").count() == 1)
    page.click('[data-prop="ok"]')
    page.wait_for_timeout(400)
    check("제안 수락 → 팀 반영", "붙였습니다" in page.inner_text("#demoMessages"), page.inner_text("#demoMessages")[-160:])

    # 3단계 — ChatGPT · Claude
    page.click("#packCta")
    page.wait_for_selector("#packSheet:not([hidden])")
    check("3단계 → 세팅 팩 모달", page.is_visible("#packSheet"))
    check("3단계 활성 표시", "is-active" in (page.get_attribute(".d-gstep[data-step='3']", "class") or ""))
    check("팩 모달 팀 구성", page.locator("#packTeam .pack-chip").count() >= 3,
          str(page.locator("#packTeam .pack-chip").count()))
    check("팩 모달 래피드 링크", "latpeed.com" in (page.get_attribute("#packBuy", "href") or ""))
    page.screenshot(path=os.path.join(SHOTS, "web-desktop-pack.png"))
    page.click("#closePack")
    page.wait_for_timeout(200)
    check("팩 모달 닫기", page.is_hidden("#packSheet"))

    # 초보자 용어 (딱딱한 말 제거)
    demo_text = page.inner_text("#demo")
    found = [w for w in JARGON if w in demo_text]
    check("어려운 용어 없음", not found, str(found))

    # 초기화
    page.click("#resetDemo")
    page.wait_for_timeout(500)
    check("처음부터 → 1단계", "is-active" in (page.get_attribute(".d-gstep[data-step='1']", "class") or ""))
    check("처음부터 → 기본 팀", "내 AI 팀" in page.inner_text("#currentTeam"), page.inner_text("#currentTeam"))
    check("처음부터 → 퀵 버튼 3개", page.locator(".d-quick-btn").count() == 3)

    # PWA · 반응형 · 콘솔
    href = page.get_attribute('link[rel="manifest"]', "href")
    status, manifest = fetch_json(BASE.rstrip("/") + "/" + href.lstrip("./"))
    check("manifest 200", status == 200)
    check("manifest standalone", manifest.get("display") == "standalone")
    check("manifest 아이콘 3종", len(manifest.get("icons", [])) >= 3, str(len(manifest.get("icons", []))))
    reg = page.evaluate(
        "async () => { if (!('serviceWorker' in navigator)) return 'none';"
        " const r = await navigator.serviceWorker.getRegistration(); return r ? 'ok' : 'none'; }"
    )
    check("서비스 워커 등록", reg == "ok", reg)
    check("모바일 뷰포트 메타", "width=device-width" in page.get_attribute('meta[name="viewport"]', "content"))
    check("데스크톱 가로 오버플로 없음", overflow(page) <= 0, str(overflow(page)))
    page.screenshot(path=os.path.join(SHOTS, "web-desktop-demo.png"), full_page=True)
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
    check("모바일 언어 선택기", page.locator(".lang-switch [data-lang]").count() == 4)
    check("모바일 3단계 안내", page.locator("#demoSteps .d-gstep").count() == 3)
    box = page.evaluate("""() => { const r = document.querySelector('#demoSteps').getBoundingClientRect();
      return [r.left, r.right, window.innerWidth]; }""")
    check("모바일 안내 바 화면 안", box[0] >= 0 and box[1] <= box[2] + 0.5, str(box))
    check("모바일 업종 카드 6개", page.locator("[data-testid=case-tile]").count() == 6)
    check("모바일 가상 사무실", page.is_visible("#officeFloor"))
    check("모바일 오피스 캐릭터", page.locator("[data-testid=office-char]").count() >= 5,
          str(page.locator("[data-testid=office-char]").count()))
    cinfo = page.evaluate(CANVAS_INFO)
    check("모바일 캔버스 DPR", cinfo["w"] == round(cinfo["cw"] * cinfo["dpr"]), str(cinfo))

    page.locator("[data-testid=office-char]").first.tap()
    page.wait_for_timeout(400)
    check("모바일 캐릭터 탭 → 역할 카드", page.is_visible("#botSheet"))
    check("모바일 역할 카드 오버플로 없음", overflow(page) <= 0, str(overflow(page)))
    page.tap("#closeBot")
    page.wait_for_timeout(200)

    page.locator('[data-apply-case="office"]').tap()
    page.wait_for_timeout(600)
    check("모바일 업종 적용 → 팀 칩", "직장인" in page.inner_text("#currentTeam"), page.inner_text("#currentTeam"))
    check("모바일 퀵 버튼 3개", page.locator(".d-quick-btn").count() == 3)
    page.locator(".d-quick-btn").first.tap()
    wait_chief(page)
    check("모바일 위임 3건 완료", page.locator(".d-deleg .d-step.done").count() == 3)
    check("모바일 정리 결과", "정리 결과" in page.inner_text("#demoMessages"))
    check("모바일 전송 버튼 터치 영역", page.evaluate(
        "() => { const r = document.querySelector('#demoSend').getBoundingClientRect(); return r.width >= 36 && r.height >= 36; }"))

    page.tap("#packCta")
    page.wait_for_selector("#packSheet:not([hidden])")
    check("모바일 팩 모달", page.is_visible("#packSheet"))
    check("모바일 팩 모달 오버플로 없음", overflow(page) <= 0, str(overflow(page)))
    page.tap("#closePack")

    check("모바일 입력창 표시", page.evaluate(
        "() => { const r = document.querySelector('#demoInput').getBoundingClientRect(); return r.width > 0 && r.height > 0; }"))
    check("모바일 가로 오버플로 없음", overflow(page) <= 0, str(overflow(page)))
    page.screenshot(path=os.path.join(SHOTS, "web-mobile-demo.png"), full_page=False)
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
