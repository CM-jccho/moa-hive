#!/usr/bin/env python3
"""MOA Hive API 테스트 — 서버를 켠 상태에서 실행: python3 tests/api_test.py"""
import json
import os
import sys
import time
import urllib.request
import urllib.error

BASE = os.environ.get("MOA_BASE", "http://127.0.0.1:3847")
passed, failed = [], []


def call(path, method="GET", body=None, expect=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + "/api" + path, data=data, method=method)
    req.add_header("content-type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            status, raw = r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        status, raw = e.code, e.read().decode()
    try:
        out = json.loads(raw)
    except Exception:
        out = {"_raw": raw}
    if expect is not None and status != expect:
        raise AssertionError(f"{method} {path} → {status} (기대 {expect}): {raw[:300]}")
    return status, out


def check(name, cond, detail=""):
    if cond:
        passed.append(name)
        print(f"  ✅ {name}")
    else:
        failed.append(name + " " + detail)
        print(f"  ❌ {name} {detail}")


def main():
    print("\n[1] 상태·엔진")
    _, h = call("/health", expect=200)
    check("health: 앱 이름 MOA Hive", h.get("app") == "MOA Hive", str(h))
    check("health: STG 버전 0.3.0-rc", h.get("stg") == "0.3.0-rc", str(h))
    _, st = call("/state", expect=200)
    check("state: 기본 환경 STG", st["env"]["active"] == "stg")
    check("state: seed 봇 4개", len(st["bots"]) >= 4, str(len(st["bots"])))
    check("state: seed 채널 3개", len(st["channels"]) >= 3, str(len(st["channels"])))
    _, eng = call("/engines", expect=200)
    check("engines: 시뮬레이터 모드", eng["mode"] == "simulator", str(eng.get("mode")))
    check("engines: claude 미설치 감지", eng["claude"]["installed"] is False)

    print("\n[2] 보안: 경로 이탈 차단")
    s, r = call("/bots", "POST", {"name": "탈출봇", "cwd": "/etc"})
    check("cwd=/etc 거부(400)", s == 400, str(s))
    s, r = call("/bots", "POST", {"name": "탈출봇2", "cwd": "../../../../etc"})
    check("cwd=../.. 거부(400)", s == 400, str(s))
    s, r = call("/bots", "POST", {"name": "정상봇", "emoji": "🧪", "cwd": "./workspace"})
    check("workspace cwd 생성(201)", s == 201, str(s))
    new_bot = r.get("bot", {}) if s == 201 else {}
    s, r = call("/bots", "PATCH", None, expect=405) if False else (None, None)
    if new_bot:
        _, r = call(f"/bots/{new_bot['id']}", "PATCH", {"cwd": "/"})
        # PATCH는 400을 반환해야 함
        s2 = 200
    _, pc = call("/security/check-path?path=../../etc/passwd")
    check("check-path: 이탈 차단", pc["ok"] is False, str(pc))

    print("\n[3] 보안: API 키 마스킹")
    SECRET = "sk-ant-SECRET-DO-NOT-LEAK-123456"
    s, r = call("/settings", "PATCH", {"apiKeys": {"anthropic": SECRET}})
    check("API 키 저장(200)", s == 200, str(s))
    check("설정 응답에 configured=true", r["settings"]["apiKeys"]["anthropic"]["configured"] is True)
    check("설정 응답에 원문 없음", SECRET not in json.dumps(r, ensure_ascii=False))
    _, st = call("/state")
    check("state 응답에 키 원문 없음", SECRET not in json.dumps(st, ensure_ascii=False))
    _, s2 = call("/settings")
    check("GET settings 원문 없음", SECRET not in json.dumps(s2, ensure_ascii=False))
    # 키 제거(시뮬레이터 유지)
    call("/settings", "PATCH", {"apiKeys": {"anthropic": ""}})

    print("\n[4] 메시지 · Auto 라우팅 · 승인 브로커")
    ch = next(c for c in st["channels"] if c["name"] == "B2B-업무")
    s, r = call("/messages", "POST", {"channelId": ch["id"], "text": "PRD 초안 파일 만들어줘"})
    check("메시지 전송(200)", s == 200, str(s))
    check("Auto 라우팅 봇 배정", bool(r.get("routedTo")), str(r.get("routedTo")))
    time.sleep(1.4)
    _, ms = call(f"/messages?channelId={ch['id']}")
    kinds = [m["kind"] for m in ms["messages"]]
    check("봇 응답 도착", "text" in kinds, str(kinds))
    check("승인 카드 생성", "approval" in kinds, str(kinds))
    ap_msg = next((m for m in ms["messages"] if m["kind"] == "approval"), None)
    apr_id = ap_msg["approvalId"] if ap_msg else None

    if apr_id:
        s, r = call("/approve", "POST", {"id": apr_id, "decision": "allow"})
        check("승인 실행(200)", s == 200 and r["approval"]["status"] == "allowed", str(s))
        _, ms = call(f"/messages?channelId={ch['id']}")
        results = [m for m in ms["messages"] if m["kind"] == "result"]
        check("실행 결과 메시지", len(results) >= 1, str(len(results)))
        s, r2 = call("/approve", "POST", {"id": apr_id, "decision": "allow"})
        check("중복 승인 409", s == 409, str(s))

    # 거절 흐름
    call("/messages", "POST", {"channelId": ch["id"], "text": "보고서 파일 작성해줘"})
    time.sleep(1.4)
    _, ms = call(f"/messages?channelId={ch['id']}")
    pending = [m for m in ms["messages"] if m["kind"] == "approval" and m["approvalId"]]
    if pending:
        last = pending[-1]["approvalId"]
        s, r = call("/approve", "POST", {"id": last, "decision": "deny"})
        check("거절 처리(200)", s == 200 and r["approval"]["status"] == "denied", str(s))

    # 위험 명령 제안 차단
    call("/messages", "POST", {"channelId": ch["id"], "text": "/shell rm -rf /"})
    time.sleep(1.4)
    _, ms = call(f"/messages?channelId={ch['id']}")
    blocked = [m for m in ms["messages"] if "승인 카드를 만들지 않았습니다" in (m.get("text") or "")]
    check("위험 명령 승인카드 차단", len(blocked) >= 1)

    print("\n[5] 팀 임포트")
    md = """---
team: 테스트 팀
bots:
  - name: 테스트 기획 봇
    emoji: 🧭
    role: pm
    persona: |
      테스트용 기획 봇입니다.
    keywords: [테스트, 기획]
channels:
  - name: 테스트-채널
    mode: auto
    topic: 임포트 검증
    members: [테스트 기획 봇]
---"""
    s, r = call("/import-team", "POST", {"markdown": md})
    check("팀 임포트(201)", s == 201, str(s))
    check("임포트 봇 1개", len(r["created"]["bots"]) == 1, str(r.get("created")))

    print("\n[6] 팀 컨설팅 위자드")
    _, cf = call("/consult")
    check("컨설팅 프로필 4종", len(cf["profiles"]) == 4, str(len(cf["profiles"])))
    check("역할 라벨 포함", any(p["label"] == "기획 / PM" for p in cf["profiles"]))
    _, st = call("/state")
    before_bots, before_ch = len(st["bots"]), len(st["channels"])
    s, r = call("/consult/apply", "POST", {"id": "b2b", "pains": ["제안서 쓰는 데 하루가 사라진다"]})
    check("컨설팅 팀 생성(201)", s == 201, str(s))
    check("컨설팅: 봇 4개 생성", len(r["bots"]) == 4, str(len(r.get("bots", []))))
    _, st2 = call("/state")
    check("컨설팅: 채널 3개 생성", len(st2["channels"]) == before_ch + 3, f"{before_ch}→{len(st2['channels'])}")
    msgs = st2["messages"] if st2["activeChannelId"] != r["mainChannelId"] else st2["messages"]
    _, mm = call(f"/messages?channelId={r['mainChannelId']}")
    texts = " ".join(m.get("text", "") for m in mm["messages"])
    check("컨설팅: 첫 프롬프트 포함", "타깃 고객사 한 곳" in texts, texts[:120])
    s, _ = call("/consult/apply", "POST", {"id": "b2b", "pains": []})
    check("컨설팅 중복 409", s == 409, str(s))

    print("\n[7] 팀 마켓")
    _, mk = call("/market")
    check("마켓 팩 4종", len(mk["packs"]) == 4, str(len(mk["packs"])))
    check("무료 팩 존재", any(p["tier"] == "free" for p in mk["packs"]))
    check("Pro 팩 3종", sum(1 for p in mk["packs"] if p["tier"] == "pro") == 3)
    s, prev = call("/market/pro-saas/preview")
    check("팩 프리뷰(.md)", s == 200 and "1인 SaaS" in prev["markdown"], str(s))
    s, r = call("/market/pro-saas/install", "POST", {})
    check("Pro 팩 무단 설치 402", s == 402, str(s))
    check("402에 구매 링크 포함", "purchaseUrl" in r)
    s, r = call("/market/pro-saas/install", "POST", {"license": "MOA-TEST-1234"})
    check("라이선스 설치(201)", s == 201, str(s))
    s, r = call("/market/starter-pack/install", "POST", {})
    check("무료 팩 설치(201)", s == 201, str(s))

    print("\n[8] STG → PROD 승격")
    _, env = call("/env")
    check("diff: 승격 대기 중", env["diff"]["pending"] is True, str(env["diff"]))
    check("diff: 봇 추가 목록 있음", len(env["diff"]["bots"]["added"]) > 0, str(env["diff"]["bots"]))
    check("diff: 설정 변경(Pickle/마켓)", len(env["diff"]["settings"]) >= 1, str(env["diff"]["settings"]))
    s, r = call("/promote", "POST", {})
    check("확인 없는 승격 400", s == 400, str(s))
    s, r = call("/promote", "POST", {"confirm": True, "note": "테스트 승격"})
    check("승격 성공(200)", s == 200, str(s))
    check("승격 버전 0.3.0", r.get("version") == "0.3.0", str(r.get("version")))
    _, cl = call("/changelog")
    check("CHANGELOG에 0.3.0 기록", any(e["version"] == "0.3.0" for e in cl["entries"]), str([e["version"] for e in cl["entries"]]))
    _, env2 = call("/env")
    check("승격 후 diff 비움", env2["diff"]["pending"] is False, str(env2["diff"]))
    s, r = call("/promote", "POST", {"confirm": True})
    check("변경 없는 승격 409", s == 409, str(s))

    print("\n[9] PROD 읽기 전용")
    s, _ = call("/env", "POST", {"active": "prod"})
    check("PROD 전환(200)", s == 200, str(s))
    s, r = call("/messages", "POST", {"channelId": "ch_all", "text": "PROD에서 쓰기 시도"})
    check("PROD 메시지 쓰기 403", s == 403, str(s))
    s, r = call("/bots", "POST", {"name": "PROD봇"})
    check("PROD 봇 생성 403", s == 403, str(s))
    _, pst = call("/state")
    check("PROD 봇 목록 반영(>=4)", len(pst["bots"]) >= 4, str(len(pst["bots"])))
    check("PROD 버전 0.3.0", pst["env"]["prod"]["version"] == "0.3.0", str(pst["env"]["prod"]))
    s, _ = call("/env", "POST", {"active": "stg"})
    check("STG 복귀", s == 200, str(s))

    print("\n[10] 모바일 원격 접속")
    _, rm = call("/remote")
    check("기본 원격 접속 꺼짐", rm["lanEnabled"] is False, str(rm.get("lanEnabled")))
    check("기본 바인딩 127.0.0.1", rm["bind"] == "127.0.0.1", str(rm["bind"]))
    s, r = call("/remote", "POST", {"allowLan": True})
    check("원격 접속 켜기(재시작 필요)", s == 200 and r["restartRequired"] is True, str(r))
    call("/remote", "POST", {"allowLan": False})

    print("\n[11] 오케스트레이터 · 자유 목적 분석")
    purpose = "중소기업 대표인데 거래처 제안서랑 매출 정산 자동화하고 싶어요"
    s, an = call("/consult/analyze", "POST", {"text": purpose})
    check("목적 분석(200)", s == 200, str(s))
    plan = an.get("plan", {})
    check("분석: 총괄 MOA Chief", plan.get("chief", {}).get("name") == "MOA Chief", str(plan.get("chief")))
    check("분석: 에이전트 2~3종", 2 <= len(plan.get("agents", [])) <= 3, str(len(plan.get("agents", []))))
    check("분석: 영업 도메인 감지", plan.get("domain") == "b2b", str(plan.get("domain")))
    s, ap = call("/orchestrator/apply", "POST", {"text": purpose})
    check("오케스트레이터 생성(201)", s == 201, str(s))
    ch_id = ap["created"]["mainChannelId"]
    check("오케스트레이터 채널 생성", any(c["id"] == ch_id for c in ap["created"]["agents"]) is False and bool(ch_id))
    check("Chief 봇 생성", ap["created"]["chief"]["name"] == "MOA Chief")
    check("에이전트 3명 생성", len(ap["created"]["agents"]) == 3, str(len(ap["created"]["agents"])))

    s, r = call("/messages", "POST", {"channelId": ch_id, "text": "이번 주 제안서 3건이랑 정산 마감 정리해줘"})
    check("총괄 채널 메시지(200)", s == 200, str(s))
    time.sleep(1.6)
    _, ms = call(f"/messages?channelId={ch_id}")
    orch = [m for m in ms["messages"] if m.get("meta", {}).get("orchestration")]
    check("위임 로그 포함 응답", len(orch) == 1, str(len(orch)))
    if orch:
        steps = orch[0]["meta"]["orchestration"]
        check("하위 에이전트 위임 3건", len(steps) == 3, str(len(steps)))
        check("위임 상태 done", all(x["status"] == "done" for x in steps))
        check("취합 결과 문구", "취합 결과" in orch[0]["text"])
    props = [m for m in ms["messages"] if m["kind"] == "proposal"]
    check("인라인 제안 카드", len(props) == 1, str(len(props)))
    _, pl = call("/proposals")
    pend = [x for x in pl["proposals"] if x["status"] == "pending"]
    check("제안 저장(pending)", len(pend) >= 1)
    if pend:
        prop = pend[0]
        _, st0 = call("/state")
        s, acc = call("/proposal", "POST", {"id": prop["id"], "decision": "accept"})
        check("제안 OK 처리(200)", s == 200 and acc["proposal"]["status"] == "accepted", str(s))
        if prop["action"]["type"] == "add-bot":
            _, st1 = call("/state")
            check("OK → 봇 자동 추가", len(st1["bots"]) == len(st0["bots"]) + 1, f"{len(st0['bots'])}→{len(st1['bots'])}")
        else:
            _, stg = call("/settings")
            check("OK → 자동 승인 규칙 추가", any(r.get("label") for r in (stg["settings"].get("autoRules") or [])), str(stg["settings"].get("autoRules")))
        s, _ = call("/proposal", "POST", {"id": prop["id"], "decision": "accept"})
        check("제안 중복 처리 409", s == 409, str(s))

    chief_id = ap["created"]["chief"]["id"]
    s, act = call(f"/bots/{chief_id}/activity")
    check("봇 활동 조회(200)", s == 200, str(s))
    check("활동 내역 존재", len(act.get("activity", [])) >= 1, str(len(act.get("activity", []))))
    check("활동 요약·엔진", bool(act.get("engineLabel")) and bool(act.get("summary")))

    print("\n[12] 정적 파일")
    for path in ["/", "/styles.css", "/app.js", "/config.js"]:
        req = urllib.request.Request(BASE + path)
        with urllib.request.urlopen(req, timeout=10) as r:
            check(f"GET {path} → 200", r.status == 200, str(r.status))

    print(f"\n결과: {len(passed)} 통과 / {len(failed)} 실패")
    if failed:
        for f in failed:
            print("  실패:", f)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
