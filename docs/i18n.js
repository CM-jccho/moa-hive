/* MOA Hive — 데모 콘텐츠 다국어 사전 (EN · 中文 · 日本語). 한국어는 app.js의 원문을 씁니다. */
window.MOA_I18N = {
  en: {
    channels: {
      "전체-팀": "all-team", "B2B-업무": "B2B-work", "사이드-수익화": "side-income",
      "매장-마케팅": "shop-marketing", "팀-업무": "team-ops", "스토어-운영": "store-ops",
      "콘텐츠-기획": "content-plan", "일-파이프라인": "work-pipeline", "프로덕트-스쿼드": "product-squad",
      "영업-오케스트라": "sales-squad", "콘텐츠-오케스트라": "content-squad", "빌드-오케스트라": "build-squad",
      "기획-오케스트라": "planning-squad", "총괄-오케스트라": "chief-squad", "런칭": "launch",
      "영업-파이프라인": "sales-pipeline"
    },
    seed: {
      system: "Demo ready. This conversation stays in this browser tab — nothing is uploaded.",
      greeting: "Hi, I’m **MOA Chief**, the team lead.\n\n1. Pick **your business** above\n2. Tap one **big button** below\n\nThe team splits the rest. You only read the result.",
      channelTopics: {
        ch_all: "The base channel for all six characters — say it and the work is divided",
        ch_b2b: "B2B planning, build and growth",
        ch_side: "Growth and revenue experiments — call a bot with @name"
      }
    },
    cases: {
      store: {
        label: "Local shop", short: "Local shop", quick: ["🎪 Plan a regulars’ event for this week", "📣 Write 3 promo posts for this week", "⭐ Draft replies to new reviews"], tagline: "Promo posts, review replies, regulars’ events, weekly sales",
        channel: "shop-marketing",
        names: ["Event planner", "Promo writer", "Review care", "Sales keeper"],
        starter: "Draft three promo posts for this week, a regulars’ event message and replies to new reviews.",
        examples: [
          { bot: 0, text: "**Bottom line** — “3pm, 1+1 for regulars only.” Mon–Thu 15:00–17:00 Americano 1+1, with two versions for SMS and stories." },
          { bot: 2, text: "Replies to this week’s four new reviews are drafted. Anything 3 stars or below is flagged for the owner to check before posting." }
        ]
      },
      office: {
        label: "Office team", short: "Office team", quick: ["📝 Summarize meeting notes in 3 lines", "📊 Draft the weekly report", "✉️ Draft 2 email replies"], tagline: "Meeting notes in three lines, weekly report, email drafts, calendar",
        channel: "team-ops",
        names: ["Notes bot", "Report bot", "Mail bot", "Calendar bot"],
        starter: "Summarize today’s meeting notes in three lines, then draft this week’s report and two email replies.",
        examples: [
          { bot: 0, text: "**3-line summary**\n1. This month’s goal is +5%p repurchase rate\n2. Fix payment-failure inquiries first\n3. Share drafts by Tuesday next week" },
          { bot: 1, text: "Weekly report draft is ready too — three metrics, two issues, two plans for next week." }
        ]
      },
      seller: {
        label: "Online store seller", short: "Online store", quick: ["🖼️ Write 3 product-page copy options", "💬 Create 5 CS reply templates", "🎁 Plan this week’s promotion"], tagline: "Product copy, CS replies, promotions, review analysis",
        channel: "store-ops",
        names: ["Product page", "CS replies", "Promotions", "Review analysis"],
        starter: "Plan this week’s promotion, then create five CS reply templates and three product-page copy options.",
        examples: [
          { bot: 0, text: "**Three copy options** — “Light, but solid” / “From commute to weekend” / “Why your bag stays organized”." },
          { bot: 1, text: "Five reply templates ready for shipping, exchange and size questions. Exchange wording follows your policy as written." }
        ]
      },
      creator: {
        label: "Solo creator", short: "Solo creator", quick: ["🔭 Give me 10 content ideas for next week", "🎞️ Write 3 Shorts scripts", "💌 Draft replies to comments"], tagline: "Ideas, Shorts scripts, comment replies, digital products",
        channel: "content-plan",
        names: ["Idea scout", "Script writer", "Comment care", "Digital products"],
        starter: "Give me ten content ideas for next week, three Shorts scripts, comment replies and three digital product ideas.",
        examples: [
          { bot: 0, text: "**Ten ideas** — picked for saves: “3-minute morning routine”, “5 things you never use”, “Skip the subscription”." },
          { bot: 1, text: "Three scripts in hook → problem → fix → CTA, each with its shot list." }
        ]
      },
      freelancer: {
        label: "Freelancer", short: "Freelancer", quick: ["📄 Draft a client proposal", "🧮 Build 3 quote options", "⏰ Write deadline reminder emails"], tagline: "Proposals, quotes, deadline reminders, portfolio",
        channel: "work-pipeline",
        names: ["Proposal bot", "Quote bot", "Reminder bot", "Portfolio bot"],
        starter: "Draft a proposal and three quote options for a new client this week, plus deadline reminders for work in progress.",
        examples: [
          { bot: 0, text: "**Proposal outline** — current problem → direction → scope → schedule → cost. Five slides." },
          { bot: 1, text: "Three quote options (basic, standard, extended) with your room to negotiate; standard is the default." }
        ]
      },
      product: {
        label: "Product startup", short: "Product team", quick: ["🧭 Set the 2-week MVP scope", "💡 Give me 3 new concepts", "🔨 Build the first screen"], tagline: "Prototype → build → sweep → grow → maintain",
        channel: "product-squad",
        names: ["MOA Chief", "Prototyper", "Builder", "Sweeper"],
        starter: "Set the MVP scope for the next two weeks, then move through prototype → build → tidy → first-100 test → ops check.",
        examples: [
          { bot: 1, text: "**Three concepts** — booking, logging, sharing. Logging is the lightest for two weeks." },
          { bot: 2, text: "Built three screens and the save flow for the logging concept. Clickable today." }
        ]
      }
    },
    consult: {
      pm: {
        label: "Planning / PM", tagline: "A planning team that leaves requirements, schedule and reports in writing",
        why: "Planners spend their day tidying up. This split gives the tidying to bots so the human only decides.",
        agents: [
          { name: "Planning bot", task: "Requirement and scope breakdown", summary: "Split the request into three user stories and a 3-day schedule." },
          { name: "Report bot", task: "Metrics and progress report", summary: "Put weekly metrics and progress into a one-page report." },
          { name: "Research bot", task: "Evidence and competitor check", summary: "Listed three competitors’ pricing and what still needs checking." }
        ]
      },
      b2b: {
        label: "B2B sales & proposals", tagline: "A sales team from target to proposal and follow-up",
        why: "Sales is won by carrying one deal to the end. Discovery, proposal, pricing and follow-up sit with four bots, so the owner can focus on meetings.",
        agents: [
          { name: "Proposal designer", task: "Proposal structure and logic", summary: "Built a five-slide outline: problem → solution → impact → plan → cost." },
          { name: "Billing bot", task: "Revenue and settlement flow", summary: "Put invoices, tax documents and overdue items into one table." },
          { name: "Follow-up bot", task: "Follow-up messages", summary: "Wrote one follow-up email to send within 24 hours of a meeting." }
        ]
      },
      content: {
        label: "Content & social", tagline: "A content team that never runs out of posts",
        why: "Content only lasts when planning, copy, visuals and analysis keep turning. Bots build the weekly rhythm; you approve.",
        agents: [
          { name: "Content strategist", task: "Topics and publishing calendar", summary: "Set this week’s seven topics and publishing days." },
          { name: "Copy bot", task: "Hooks and captions", summary: "Made two first-3-second hooks and a hashtag set." },
          { name: "Performance analyst", task: "Metrics and next test", summary: "Compared reach, saves and follows, and suggested one test." }
        ]
      },
      founder: {
        label: "Solo founder", tagline: "A business team running planning, build, growth and support alone",
        why: "A one-person business bottlenecks on decisions and repetition. Bots take the repetition; decisions get evidence and speed.",
        agents: [
          { name: "Business planner", task: "MVP scope and pricing", summary: "Cut the idea to a two-week MVP with two price options." },
          { name: "Builder bot", task: "Build and release order", summary: "Listed two files to change, the commands and the verification order." },
          { name: "Growth bot", task: "Early traction tests", summary: "Designed two first-100-user channel tests with stop criteria." }
        ]
      }
    },
    agents: {
      proposal: { name: "Proposal designer", task: "Proposal structure and logic", summary: "Built a five-slide outline: problem → solution → impact → plan → cost." },
      billing: { name: "Billing bot", task: "Revenue and settlement flow", summary: "Put invoices, tax documents and overdue items into one table." },
      followup: { name: "Follow-up bot", task: "Follow-up messages", summary: "Wrote one follow-up email to send within 24 hours of a meeting." },
      content: { name: "Content strategist", task: "Topics and publishing calendar", summary: "Set this week’s seven topics and publishing days." },
      copy: { name: "Copy bot", task: "Hooks and captions", summary: "Made two first-3-second hooks and a hashtag set." },
      analysis: { name: "Performance analyst", task: "Metrics and next test", summary: "Compared reach, saves and follows, and suggested one test." },
      planning: { name: "Planning bot", task: "Requirement and scope breakdown", summary: "Split the request into three user stories and a 3-day schedule." },
      build: { name: "Builder bot", task: "Build and release order", summary: "Listed two files to change, the commands and the verification order." },
      qa: { name: "QA bot", task: "Test scenarios", summary: "Wrote a six-item regression checklist." },
      research: { name: "Research bot", task: "Evidence and competitor check", summary: "Listed three competitors’ pricing and what still needs checking." },
      ops: { name: "Ops automation bot", task: "Automate repetitive work", summary: "Turned three repetitive tasks into script candidates." }
    },
    roleTasks: {
      pm: ["Break this week’s goal into a PRD draft", "Turn meeting notes into action items", "Make a pre-release QA checklist"],
      dev: ["Sort the build order and file structure", "Reproduce the bug and plan the fix", "Check the release script"],
      content: ["Next week’s seven-post calendar", "Two first-3-second hooks for a Short", "Write Instagram and Threads captions together"],
      research: ["Compare pricing at three competitors", "Lay out the evidence for market size", "Mark what still needs checking"],
      chief: ["Set this week’s team priorities", "Combine the agents’ outputs", "Pick the one next action"]
    },
    roleLabel: { pm: "Planning · PM", dev: "Build · QA", content: "Content", research: "Research", chief: "Chief" },
    characterTasks: {
      "MOA Chief": ["Set this week’s team priorities", "Report the five agents’ outputs", "Tell me only what I must decide"],
      "Prototyper": ["Throw out ten new ideas", "Draw the possibilities for this feature", "Propose three new concepts"],
      "Builder": ["Build this screen for real", "Sort the build order and commands", "Turn the prototype into a product"],
      "Sweeper": ["Tidy duplicate code and screens", "Remove the clutter in this flow", "Make a pre-release tidy checklist"],
      "Grower": ["Design a first-100-user test", "List channels that make people find us", "Read the metrics and pick the next test"],
      "Maintainer": ["Check where outages are likely", "Plan monitoring and backups", "List slow spots and security risks"]
    },
    chiefSummary: "Calm and clear lead — talks to you directly, hands work to five agents and reports only the result.",
    roles: {
      chief: "Charter, priorities and the final report", prototyper: "Ideas and possibilities", builder: "Real screens and implementation",
      sweeper: "Cleanup and simplification", grower: "Channels, metrics and growth", maintainer: "Stability, security and speed"
    },
    orch: {
      report: "**Team lead** · 🧠 MOA Chief\n\nJob: {goal}\n\nSplitting it across {n} bots.",
      goalFallback: "this request",
      summaryHeader: "**Result**",
      summaryScope: "Scope: split “{topic}” into {n} pieces of work.",
      summaryNext: "Next: check {agent}’s draft first.",
      summaryNextEmpty: "Next: pick one thing to do.",
      summaryCheck: "To verify: real numbers and customer details are not checked yet.",
      summaryFoot: "_Demo summary. The real work continues in the app._",
      proposalRuleTitle: "",
      proposalRuleBody: "",
      proposalBotTitle: "Add a weekly report bot to the team?",
      proposalBotBody: "It summarizes progress on one page every Friday.",
      designCreated: "",
      designReady: "",
      caseCreated: "**{label}** is ready — {n} bots.",
      caseStarterNote: "",
      proposalDone: "✓ Added to the team.",
      proposalPassed: "· Passed. Only recorded.",
      ruleApplied: "",
      botApplied: "✓ **{name}** is on the team now.",
      prodPromoted: "",
      readOnly: "This team is read-only."
    },
    replies: {
      dev: "**Bottom line** — scoped “{topic}” as this bot’s work.\n\n**Three things for today**\n1. Check the two screens or files involved\n2. Finish the draft today\n3. Click through once and share it\n\n**Needs a check** — tell me first if this touches real data.\n\n_Demo reply._",
      content: "**Bottom line** — planned “{topic}” as a week of content.\n\n**Next week, seven posts (day · topic)**\n- Mon · One thing I changed in my routine\n- Tue · What a 5-minute routine changed\n- Wed · Three automations that failed\n- Thu · Free productivity tools\n- Fri · What I learned this week\n- Sat · Reply to a reader\n- Sun · Preview of next week\n\n**Two first-3-second hooks**\n> “I changed this one thing and got 30 minutes back.”\n> “This daily task? You can skip it.”\n\n**Hashtags** `#lifeautomation #solobusiness #aitools #routine`\n\n_Demo reply._",
      research: "**Bottom line** — checked the facts behind “{topic}”.\n\n**Confirmed**\n- Public pricing at three places\n- What changed in the last two announcements\n\n**Assumed**\n- The gap probably comes from channel mix (weak evidence)\n\n**Needs checking** — one source link and I’ll match the numbers.\n\n_Demo reply._",
      chief: "**Bottom line** — “{topic}” is ready to share with the bots.\n\nI’ll combine their drafts and suggest one next step.",
      pm: "**Bottom line** — “{topic}” is scoped for a review this week.\n\n**Scope**\n- Problem: {topic}\n- Goal: a draft you can review this week\n- Out of scope: real data changes\n\n**3-day plan**\n1. Today — requirements and risks\n2. Tomorrow — draft and one review\n3. The day after — apply and check\n\n**Next step** — pick the one decision you need to make; I’ll draft the rest.\n\n_Demo reply._"
    },
    toasts: {
      teamCreated: "Team created in STG — #{channel}",
      caseApplied: "“{label}” team is ready.",
      reset: "Demo reset to its initial state.",
      adminOn: "Admin mode — STG/PROD and the Release panel are visible.",
      adminOff: "Normal mode — admin tools are hidden.",
      needDesign: "Pick an industry or write one line about what you need.",
      ruleAdded: "Auto-approve rule for read-only commands added.",
      botAdded: "{name} was added to the team.",
      promoted: "PROD v0.3.0 promoted — recorded in version history.",
      installHint: "Use your browser menu → “Add to Home Screen” / “Install app”.",
      installed: "Added to your home screen.",
      voiceUnsupported: "This browser does not support voice input — use the latest Chrome, Edge or Safari, or type below.",
      voiceFailed: "Could not start voice input. Check microphone permission.",
      listening: "Listening — speak in the language you selected."
    },
    demo: {
      engine: "Browser demo",
      stateIdle: "✨ Idle", stateWorking: "⚡ Working",
      chiefBadge: "Lead", workingBadge: "⚡ Working",
      noActivity: "· Nothing yet. Give it a job.",
      officeHint: "{chief} lead · {n} bots",
      bubbleDelegating: "Assigning…", bubbleWorking: "Working…", doneShort: "Done!",
      zoneMeeting: "Meeting room", zoneMaker: "Maker zone", zoneLounge: "Lounge",
      timeDay: "Day", timeSunset: "Sunset", timeNight: "Night",
      teamDefault: "My AI team",
      teamChip: "{label} · {n} bots",
      teamReady: "**{label} team** is ready — {n} bots walked into the office.\n\nNow tap one big button in **step 2**.",
      teamHello: "Great — leave **{label}** work to us.\n\nTap a button below and I’ll split it across the bots, then report only the result.",
      quickDefault: ["🗂️ Sort this week's to-dos", "🎯 Set this week's priorities", "✅ Pick my next action"],
      idleLines: ["💡 Polishing the draft!", "🔍 Checking the sources", "✍️ Writing a reply", "☕ Coffee break, back soon", "📊 Crunching numbers", "🌱 This is going well", "🎯 Almost done here", "⚡ Locked in!"],
      stepDone: "Done", stepWorking: "Working", stepWaiting: "Waiting",
      typing: "typing",
      autoRoute: "Auto", mentionRoute: "@mention",
      prodTopic: "Read-only — ", workspace: "./workspace", inputProd: "Read-only",
      packTeamLabel: "This team", localOnly: "this tab only",
      proposalOk: "Add it", proposalPass: "No thanks"
    },
    pack: {
      title: "🎁 Use this team in your ChatGPT · Claude",
      sub: "Setup pack — paste once, ready in three minutes.",
      teamLabel: "This team",
      steps: [
        ["Open the pack file for your team", "The pack has the same roles, their job descriptions and five ready prompts."],
        ["Paste into ChatGPT (Custom GPT / Projects) or Claude (Projects)", "One instruction block per team. Korean and English are included."],
        ["Start with the five prompts", "Each prompt produces a draft you can send today."]
      ],
      price: "Early bird 14,900 KRW · Bundle 24,900 KRW",
      cta: "Get the setup pack on Latpeed →",
      note: "The web demo stays free. The pack is optional — for people who want the same team in the tool they already pay for."
    }
  },

  zh: {
    channels: {
      "전체-팀": "全员频道", "B2B-업무": "B2B-业务", "사이드-수익화": "副业-变现",
      "매장-마케팅": "门店-营销", "팀-업무": "团队-事务", "스토어-운영": "店铺-运营",
      "콘텐츠-기획": "内容-策划", "일-파이프라인": "接单-流程", "프로덕트-스쿼드": "产品-小队",
      "영업-오케스트라": "销售-编队", "콘텐츠-오케스트라": "内容-编队", "빌드-오케스트라": "开发-编队",
      "기획-오케스트라": "策划-编队", "총괄-오케스트라": "总管-编队", "런칭": "上线",
      "영업-파이프라인": "销售-漏斗"
    },
    seed: {
      system: "本地环境已就绪。这段对话只保存在当前浏览器标签页里。",
      greeting: "你好，我是队长机器人 **MOA Chief**。\n\n1. 在上面选**你的行业**\n2. 点下面一个**大按钮**\n\n剩下的团队会分着做，您只看结果就好。",
      channelTopics: {
        ch_all: "六个角色都在这里的基础频道 — 说出来，工作自动分工",
        ch_b2b: "B2B 业务的策划、实现与增长",
        ch_side: "增长与收入实验 — 用 @名字 点名"
      }
    },
    cases: {
      store: {
        label: "个体小店", short: "小店", quick: ["🎪 策划本周老客活动", "📣 写 3 篇本周宣传文", "⭐ 起草新评价回复"], tagline: "宣传文案、评价回复、老客活动、每周营业额",
        channel: "门店-营销",
        names: ["活动策划", "宣传文案", "评价维护", "营业额整理"],
        starter: "帮我准备这周三条宣传文案、老客活动文案，以及新评价的回复草稿。",
        examples: [
          { bot: 0, text: "**结论** — 就做“下午三点，老客专享 1+1”。周一到周四 15:00–17:00 美式 1+1，短信版和动态版各一份。" },
          { bot: 2, text: "本周四条新评价的回复草稿都写好了。三星及以下单独标出，等老板确认后再发。" }
        ]
      },
      office: {
        label: "职场人·团队", short: "职场人", quick: ["📝 把会议记录总结成 3 行", "📊 起草周报", "✉️ 整理 2 封回信"], tagline: "会议记录三行摘要、周报、邮件草稿、日程",
        channel: "团队-事务",
        names: ["会议记录", "周报", "邮件", "日程"],
        starter: "把今天的会议记录缩成三行，再准备这周的周报草稿和两封回信。",
        examples: [
          { bot: 0, text: "**三行摘要**\n1. 本月目标是复购率提升 5 个百分点\n2. 优先修复支付失败的咨询\n3. 下周二前各自分享草稿" },
          { bot: 1, text: "周报草稿也放好了 — 三个指标、两个问题、下周两项计划。" }
        ]
      },
      seller: {
        label: "网店卖家", short: "网店", quick: ["🖼️ 写 3 个详情页文案", "💬 做 5 条客服回复模板", "🎁 策划本周促销"], tagline: "详情页文案、客服回复、促销、评价分析",
        channel: "店铺-运营",
        names: ["详情页", "客服回复", "促销策划", "评价分析"],
        starter: "策划这周的促销，再做五条客服回复模板和三个详情页文案版本。",
        examples: [
          { bot: 0, text: "**三个文案方向** — “轻，但装得下” / “从通勤到周末” / “包里为什么总能整齐”。" },
          { bot: 1, text: "配送、换货、尺码三类问题的回复模板五条已备好，换货话术按你的政策原文写。" }
        ]
      },
      creator: {
        label: "个人创作者", short: "个人创作者", quick: ["🔭 给出下周 10 个选题", "🎞️ 写 3 篇短视频脚本", "💌 起草评论回复"], tagline: "选题、短视频脚本、评论互动、数字商品",
        channel: "内容-策划",
        names: ["选题发现", "脚本撰写", "评论互动", "数字商品"],
        starter: "给我下周十个内容选题、三条短视频脚本、评论回复草稿和三个数字商品方向。",
        examples: [
          { bot: 0, text: "**十个选题** — 以收藏为目标挑的：“三分钟晨间流程”“这五样东西其实用不上”“别再订阅了”。" },
          { bot: 1, text: "三条脚本按“前 3 秒钩子 → 问题 → 解法 → 行动号召”写好，也标了拍摄分镜。" }
        ]
      },
      freelancer: {
        label: "自由职业者", short: "自由职业", quick: ["📄 起草客户提案", "🧮 做 3 个报价方案", "⏰ 写截止提醒邮件"], tagline: "提案、报价、截止提醒、作品集",
        channel: "接单-流程",
        names: ["提案", "报价", "提醒", "作品集"],
        starter: "准备这周新客户的提案初稿和三个报价方案，再写进行中项目的截止提醒邮件。",
        examples: [
          { bot: 0, text: "**提案目录** — 现状问题 → 改版方向 → 工作范围 → 时间表 → 费用，共五页。" },
          { bot: 1, text: "三个报价方案（基础／标准／扩展）和可让步范围已整理，默认推荐标准方案。" }
        ]
      },
      product: {
        label: "产品·创业团队", short: "产品团队", quick: ["🧭 定下 2 周 MVP 范围", "💡 给 3 个新点子", "🔨 先做出第一个页面"], tagline: "原型 → 实现 → 整理 → 增长 → 运维",
        channel: "产品-小队",
        names: ["MOA Chief", "Prototyper", "Builder", "Sweeper"],
        starter: "先定两周内要上线的 MVP 范围，再按原型 → 实现 → 整理 → 首批 100 人实验 → 运维检查推进。",
        examples: [
          { bot: 1, text: "**三个概念** — 预约型、记录型、分享型。两周内记录型最轻。" },
          { bot: 2, text: "按记录型做了三个页面和保存流程，今天就能点着看。" }
        ]
      }
    },
    consult: {
      pm: {
        label: "策划 / PM", tagline: "把需求、日程和汇报都落成文档的策划团队",
        why: "策划的时间大半花在整理上。把整理交给机器人，人只做决定。",
        agents: [
          { name: "策划PM", task: "需求与范围拆解", summary: "把请求拆成三个用户故事和三天日程。" },
          { name: "周报机器人", task: "指标与进度汇报", summary: "把本周指标和进度整理成一页报告。" },
          { name: "调研机器人", task: "依据与竞品核对", summary: "整理了三家竞品的价格和待确认项。" }
        ]
      },
      b2b: {
        label: "B2B 销售 · 提案", tagline: "从找客户到提案、跟进一条线跑完的销售团队",
        why: "销售拼的是把一个单子跟到底。挖掘、提案、报价、跟进分给四个机器人，负责人只管见客户和拍板。",
        agents: [
          { name: "提案设计", task: "提案结构与逻辑", summary: "排了五页目录：问题 → 方案 → 效果 → 计划 → 费用。" },
          { name: "结算机器人", task: "收入与结算流程", summary: "把回款、税务单据、逾期项整理成一张表。" },
          { name: "跟进机器人", task: "跟进文案", summary: "写好了一封会后 24 小时内发出的跟进邮件。" }
        ]
      },
      content: {
        label: "内容 · 社交运营", tagline: "每天都有东西可发的运营团队",
        why: "内容要策划、文案、视觉、分析一起转才不断更。机器人搭每周节奏，你只负责点头。",
        agents: [
          { name: "内容策略", task: "选题与发布日历", summary: "定了本周七条选题和发布日。" },
          { name: "文案机器人", task: "钩子与文案", summary: "写了两个前 3 秒钩子和一组话题标签。" },
          { name: "数据分析", task: "指标与下次实验", summary: "对比了触达、收藏和关注，提了一个实验。" }
        ]
      },
      founder: {
        label: "一人公司 · 创业", tagline: "一个人同时跑策划、开发、增长和客服的业务团队",
        why: "一人公司的瓶颈是决定太多、重复太多。重复交给机器人，决定有依据、更快。",
        agents: [
          { name: "业务策划", task: "MVP 范围与定价", summary: "把想法裁成两周 MVP，给了两个价格方案。" },
          { name: "开发机器人", task: "实现与发布顺序", summary: "列出要改的两个文件、命令和验证顺序。" },
          { name: "增长机器人", task: "早期获客实验", summary: "设计了两个首批 100 人渠道实验，附停止标准。" }
        ]
      }
    },
    agents: {
      proposal: { name: "提案设计", task: "提案结构与逻辑", summary: "排了五页目录：问题 → 方案 → 效果 → 计划 → 费用。" },
      billing: { name: "结算机器人", task: "收入与结算流程", summary: "把回款、税务单据、逾期项整理成一张表。" },
      followup: { name: "跟进机器人", task: "跟进文案", summary: "写好了一封会后 24 小时内发出的跟进邮件。" },
      content: { name: "内容策略", task: "选题与发布日历", summary: "定了本周七条选题和发布日。" },
      copy: { name: "文案机器人", task: "钩子与文案", summary: "写了两个前 3 秒钩子和一组话题标签。" },
      analysis: { name: "数据分析", task: "指标与下次实验", summary: "对比了触达、收藏和关注，提了一个实验。" },
      planning: { name: "策划机器人", task: "需求与范围拆解", summary: "把请求拆成三个用户故事和三天日程。" },
      build: { name: "开发机器人", task: "实现与发布顺序", summary: "列出要改的两个文件、命令和验证顺序。" },
      qa: { name: "测试机器人", task: "验证场景", summary: "写了六项回归检查清单。" },
      research: { name: "调研机器人", task: "依据与竞品核对", summary: "整理了三家竞品的价格和待确认项。" },
      ops: { name: "运营自动化", task: "重复工作自动化", summary: "把三项重复工作变成了脚本候选。" }
    },
    roleTasks: {
      pm: ["把本周目标拆成 PRD 草稿", "把会议记录整理成待办", "做上线前的 QA 清单"],
      dev: ["整理实现顺序和文件结构", "复现问题并定修复方案", "检查发布脚本"],
      content: ["下周七条发布日历", "短视频前 3 秒钩子两版", "同时写 Instagram 和 Threads 文案"],
      research: ["三家竞品价格对比", "整理市场规模依据", "标出待确认项"],
      chief: ["定本周团队优先级", "汇总各机器人产出", "只挑出一个下一步"]
    },
    roleLabel: { pm: "策划 · PM", dev: "开发 · 验证", content: "内容", research: "调研", chief: "总管" },
    characterTasks: {
      "MOA Chief": ["定本周团队优先级", "汇总五个角色的产出", "只告诉我需要我决定的事"],
      "Prototyper": ["抛十个新点子", "画出这个功能的可能性", "提三个新概念"],
      "Builder": ["把这个页面真的做出来", "整理实现顺序和命令", "把原型做成产品"],
      "Sweeper": ["清理重复的代码和页面", "把这个流程里多余的部分去掉", "做发布前的整理清单"],
      "Grower": ["设计首批 100 人实验", "整理让人找到我们的渠道", "看指标挑下一个实验"],
      "Maintainer": ["检查容易出故障的地方", "定监控和备份计划", "整理慢的地方和安全风险"]
    },
    chiefSummary: "沉稳清楚的总管 — 只和你对话，把工作分给五个角色，只汇报结果。",
    roles: {
      chief: "章程、优先级和最终汇报", prototyper: "想法与可能性", builder: "真实页面与实现",
      sweeper: "清理与简化", grower: "渠道、指标与增长", maintainer: "稳定、安全与速度"
    },
    orch: {
      report: "**队长报告** · 🧠 MOA Chief\n\n任务：{goal}\n\n分给 {n} 个机器人来做。",
      goalFallback: "这个请求",
      summaryHeader: "**结果**",
      summaryScope: "范围：把“{topic}”拆成 {n} 份工作。",
      summaryNext: "下一步：先看{agent}的草稿。",
      summaryNextEmpty: "下一步：先定一件事。",
      summaryCheck: "待确认：真实数字和客户信息还没有核实。",
      summaryFoot: "_体验用摘要。真实工作会在 App 里继续。_",
      proposalRuleTitle: "",
      proposalRuleBody: "",
      proposalBotTitle: "要把周报机器人加进团队吗？",
      proposalBotBody: "每周五把进度整理成一页报告。",
      designCreated: "",
      designReady: "",
      caseCreated: "**{label}**已就位 — 机器人 {n} 个。",
      caseStarterNote: "",
      proposalDone: "✓ 已加入团队。",
      proposalPassed: "· 已跳过，只留记录。",
      ruleApplied: "",
      botApplied: "✓ **{name}** 已经在团队里了。",
      prodPromoted: "",
      readOnly: "这个团队是只读的。"
    },
    replies: {
      dev: "**结论** — 把“{topic}”按这个机器人的工作整理好了。\n\n**今天要做的三件事**\n1. 确认相关页面或文件两处\n2. 今天内完成草稿\n3. 点一遍确认后分享\n\n**需要确认** — 是否会动到真实数据，请先告诉我。\n\n_体验用回复。_",
      content: "**结论** — 把“{topic}”排成了一周的内容。\n\n**下周七条（周 · 选题）**\n- 一 · 改掉一个日常习惯\n- 二 · 五分钟流程带来的变化\n- 三 · 三个失败的自动化\n- 四 · 不花钱的效率工具\n- 五 · 这周学到的事\n- 六 · 回答读者提问\n- 日 · 下周预告\n\n**前 3 秒钩子两版**\n> “就改了这一件事，早上多出 30 分钟。”\n> “每天做的这件事，其实可以不做。”\n\n**话题标签** `#生活自动化 #一人公司 #AI工具`\n\n_体验用回复。_",
      research: "**结论** — 核对了“{topic}”的依据。\n\n**已确认**\n- 三处的公开价格\n- 最近两次公告的变化\n\n**推测**\n- 差异大概来自渠道结构（依据较弱）\n\n**待确认** — 给我一个原文链接，我就能把数字对上。\n\n_体验用回复。_",
      chief: "**结论** — “{topic}”可以分给机器人了。\n\n我会汇总草稿，只给你一个下一步建议。",
      pm: "**结论** — “{topic}”按本周可评审的范围整理好了。\n\n**范围**\n- 问题：{topic}\n- 目标：本周内能评审的草稿\n- 不做：改动真实数据\n\n**三天计划**\n1. 今天 — 需求与风险整理\n2. 明天 — 草稿与一次评审\n3. 后天 — 落地并核对\n\n**下一步** — 只挑出需要你决定的一件事，其余我先写成草稿。\n\n_体验用回复。_"
    },
    toasts: {
      teamCreated: "已在 STG 建好团队 — #{channel}",
      caseApplied: "“{label}”团队已就位。",
      reset: "体验已恢复到初始状态。",
      adminOn: "管理员模式 — 显示 STG/PROD 和 Release 面板。",
      adminOff: "普通模式 — 已隐藏管理员工具。",
      needDesign: "请选一个行业，或写一行你想做的事。",
      ruleAdded: "已添加只读命令自动放行规则。",
      botAdded: "已把 {name} 加入团队。",
      promoted: "已发布 PROD v0.3.0 — 记入版本历史。",
      installHint: "请在浏览器菜单里选择“添加到主屏幕”或“安装应用”。",
      installed: "已添加到主屏幕。",
      voiceUnsupported: "这个浏览器不支持语音输入 — 请用最新版 Chrome、Edge 或 Safari，或直接在下方输入。",
      voiceFailed: "语音输入没能启动，请检查麦克风权限。",
      listening: "正在听 — 请用你选择的语言说话。"
    },
    demo: {
      engine: "浏览器体验版",
      stateIdle: "✨ 待机", stateWorking: "⚡ 处理中",
      chiefBadge: "队长", workingBadge: "⚡ 处理中",
      noActivity: "· 还没有记录。给它一件事试试。",
      officeHint: "{chief} 队长 · 机器人 {n} 个",
      bubbleDelegating: "分派中…", bubbleWorking: "处理中…", doneShort: "完成！",
      zoneMeeting: "会议室", zoneMaker: "制作区", zoneLounge: "休息区",
      timeDay: "白天", timeSunset: "黄昏", timeNight: "夜晚",
      teamDefault: "我的 AI 团队",
      teamChip: "{label} · 机器人 {n} 个",
      teamReady: "**{label}团队**已就位 — {n} 个机器人进了办公室。\n\n现在到**第 2 步**点一个大按钮。",
      teamHello: "好，**{label}**的事交给我们。\n\n点下面的按钮，我会分给机器人，只把结果整理给您。",
      quickDefault: ["🗂️ 整理这周要做的事", "🎯 定这周的优先级", "✅ 帮我选一个下一步"],
      idleLines: ["💡 正在润色草稿！", "🔍 正在核对资料", "✍️ 在写回复", "☕ 去倒杯咖啡", "📊 正在核对数字", "🌱 进展不错", "🎯 马上就好", "⚡ 专注中！"],
      stepDone: "完成", stepWorking: "处理中", stepWaiting: "等待",
      typing: "正在输入",
      autoRoute: "自动", mentionRoute: "@点名",
      prodTopic: "只读 — ", workspace: "./workspace", inputProd: "只读",
      packTeamLabel: "这个团队", localOnly: "只在这个标签页",
      proposalOk: "加上", proposalPass: "不用了"
    },
    pack: {
      title: "🎁 把这个团队搬进我的 ChatGPT · Claude",
      sub: "配置包 — 粘贴一次，三分钟就能用。",
      teamLabel: "团队构成",
      steps: [
        ["打开对应行业的配置包文件", "里面是同样的角色、职责说明和 5 条现成提示词。"],
        ["粘贴到 ChatGPT（Custom GPT / Projects）或 Claude（Projects）", "每个团队一段指令，韩语和英语都有。"],
        ["用五条提示词直接开始", "每条都能产出今天就能发出去的草稿。"]
      ],
      price: "早鸟价 14,900 韩元 · 组合包 24,900 韩元",
      cta: "在 Latpeed 购买配置包 →",
      note: "在线体验一直免费。配置包是给想把这套团队放进自己常用工具的人的选项。"
    }
  },

  ja: {
    channels: {
      "전체-팀": "全体チーム", "B2B-업무": "B2B業務", "사이드-수익화": "副業マネタイズ",
      "매장-마케팅": "店舗マーケ", "팀-업무": "チーム業務", "스토어-운영": "ストア運用",
      "콘텐츠-기획": "コンテンツ企画", "일-파이프라인": "案件パイプライン", "프로덕트-스쿼드": "プロダクトチーム",
      "영업-오케스트라": "営業オーケストラ", "콘텐츠-오케스트라": "コンテンツ編成", "빌드-오케스트라": "開発編成",
      "기획-오케스트라": "企画編成", "총괄-오케스트라": "統括編成", "런칭": "ローンチ",
      "영업-파이프라인": "営業パイプライン"
    },
    seed: {
      system: "ローカル環境の準備ができました。この会話はこのブラウザタブ内だけに保存されます。",
      greeting: "こんにちは、リーダーの **MOA Chief** です。\n\n1. 上で**業種**を選ぶ\n2. 下の**大きなボタン**を押す\n\nあとはチームが分担します。結果だけ見てください。",
      channelTopics: {
        ch_all: "6人が集まる基本チャンネル — 話せば自動で分担します",
        ch_b2b: "B2B事業の企画・実装・成長",
        ch_side: "成長と収益の実験 — @名前で呼び出し"
      }
    },
    cases: {
      store: {
        label: "個人店", short: "個人店", quick: ["🎪 今週の常連イベントを企画", "📣 今週の宣伝文を3本書く", "⭐ 新着レビュー返信の下書き"], tagline: "宣伝文・口コミ返信・常連イベント・週次売上",
        channel: "店舗マーケ",
        names: ["イベント企画", "宣伝ライター", "口コミケア", "売上整理"],
        starter: "今週の宣伝文3本と常連イベントの文案、新しい口コミへの返信下書きを用意してください。",
        examples: [
          { bot: 0, text: "**結論** — 「15時、常連さんだけの1+1」でいきます。月〜木15:00–17:00アメリカーノ1+1、SMS用とストーリー用の2案を用意しました。" },
          { bot: 2, text: "今週の新着口コミ4件の返信下書きができました。星3以下はオーナー確認後に投稿するよう分けてあります。" }
        ]
      },
      office: {
        label: "会社員・チーム", short: "会社員", quick: ["📝 議事録を3行に要約", "📊 週報の下書き", "✉️ 返信メール2通を整理"], tagline: "議事録3行要約・週報・メール下書き・日程",
        channel: "チーム業務",
        names: ["議事録", "週報", "メール", "日程"],
        starter: "今日の会議メモを3行に要約し、今週の報告書の下書きと返信メール2件を整理してください。",
        examples: [
          { bot: 0, text: "**3行要約**\n1. 今月の目標は再購入率+5ポイント\n2. 決済失敗の問い合わせを優先して修正\n3. 来週火曜までに担当者ごとの下書きを共有" },
          { bot: 1, text: "週報の下書きも添えました — 指標3つ、課題2つ、来週の計画2つで構成しています。" }
        ]
      },
      seller: {
        label: "ネットショップ", short: "ネットショップ", quick: ["🖼️ 商品ページ文案を3案", "💬 問い合わせ返信を5種", "🎁 今週のセールを企画"], tagline: "商品ページ文案・CS返信・セール・口コミ分析",
        channel: "ストア運用",
        names: ["商品ページ", "CS返信", "セール企画", "口コミ分析"],
        starter: "今週のセールを企画し、よくあるCS問い合わせ5件の返信テンプレートと商品ページ文案3案を作ってください。",
        examples: [
          { bot: 0, text: "**文案3案** — 「軽いのに、しっかり」／「通勤から週末まで」／「バッグの中が整う理由」でまとめました。" },
          { bot: 1, text: "配送・交換・サイズの問い合わせ用テンプレート5種を用意しました。交換の案内は規定の文言をそのまま入れています。" }
        ]
      },
      creator: {
        label: "個人クリエイター", short: "個人クリエイター", quick: ["🔭 来週のネタを10個", "🎞️ ショート動画台本3本", "💌 コメント返信の下書き"], tagline: "ネタ探し・ショート動画台本・コメント対応・デジタル商品",
        channel: "コンテンツ企画",
        names: ["ネタ探し", "台本ライター", "コメント対応", "デジタル商品"],
        starter: "来週のコンテンツネタ10個とショート動画台本3本、コメント返信の下書き、デジタル商品アイデア3つを用意してください。",
        examples: [
          { bot: 0, text: "**ネタ10個** — 保存されやすいテーマで選びました。「3分朝ルーティン」「使わないもの5つ」「サブスクよりこれ」など。" },
          { bot: 1, text: "台本3本を「最初の3秒フック → 問題 → 解決 → CTA」で作り、撮影カットも書きました。" }
        ]
      },
      freelancer: {
        label: "フリーランス", short: "フリーランス", quick: ["📄 提案書の下書き", "🧮 見積3案を作る", "⏰ 締切リマインドメール"], tagline: "提案書・見積・締切リマインド・ポートフォリオ",
        channel: "案件パイプライン",
        names: ["提案書", "見積", "リマインド", "ポートフォリオ"],
        starter: "今週の新規クライアント向け提案書の下書きと見積3案、進行中案件の締切リマインドメールを用意してください。",
        examples: [
          { bot: 0, text: "**提案の目次** — 現状の課題 → リニューアル方針 → 作業範囲 → スケジュール → 費用。5ページでまとめました。" },
          { bot: 1, text: "見積3案（基本・標準・拡張）と譲れる範囲を整理しました。標準案を既定のおすすめにしています。" }
        ]
      },
      product: {
        label: "プロダクト・スタートアップ", short: "プロダクトチーム", quick: ["🧭 2週間のMVP範囲を決める", "💡 新コンセプトを3案", "🔨 最初の画面を作る"], tagline: "プロトタイプ → 実装 → 整理 → 成長 → 運用",
        channel: "プロダクトチーム",
        names: ["MOA Chief", "Prototyper", "Builder", "Sweeper"],
        starter: "2週間で出すMVPの範囲を決め、プロトタイプ → 実装 → 整理 → 最初の100人テスト → 運用確認の順で進めてください。",
        examples: [
          { bot: 1, text: "**コンセプト3案** — 予約型・記録型・共有型。2週間なら記録型が最も軽いです。" },
          { bot: 2, text: "記録型で画面3つと保存フローを作りました。今日中に触れる形で繋いであります。" }
        ]
      }
    },
    consult: {
      pm: {
        label: "企画 / PM", tagline: "要件・日程・レポートを文書で残す企画チーム",
        why: "企画職は「整理する仕事」に1日を使います。整理はボットに任せ、人は決めることだけを担当します。",
        agents: [
          { name: "企画PM", task: "要件と範囲の分解", summary: "依頼を3つのユーザーストーリーと3日間の日程に分けました。" },
          { name: "レポート", task: "指標と進捗の報告", summary: "今週の指標と進捗を1ページにまとめました。" },
          { name: "リサーチ", task: "根拠と競合の確認", summary: "競合3社の価格と確認が必要な項目を整理しました。" }
        ]
      },
      b2b: {
        label: "B2B営業・提案", tagline: "ターゲット発掘から提案・フォローまで伴走する営業チーム",
        why: "営業は1件を最後まで運ぶ力が勝負です。発掘・提案・価格・フォローを4体が分担し、担当者は商談に集中できます。",
        agents: [
          { name: "提案設計", task: "提案の構成と論理", summary: "課題 → 解決 → 導入効果 → 計画 → 費用の5ページ構成にしました。" },
          { name: "請求・売上", task: "売上と精算の流れ", summary: "入金・請求書・未収を1つの表にまとめました。" },
          { name: "フォロー", task: "フォロー文の作成", summary: "商談後24時間以内に送るメールの下書きを1件作りました。" }
        ]
      },
      content: {
        label: "コンテンツ・SNS運用", tagline: "毎日出すものが尽きないコンテンツチーム",
        why: "コンテンツは企画・コピー・ビジュアル・分析が回って初めて続きます。ボットが週次リズムを作り、人は承認するだけです。",
        agents: [
          { name: "コンテンツ戦略", task: "テーマと投稿カレンダー", summary: "今週7本のテーマと投稿曜日を決めました。" },
          { name: "コピー", task: "フックとキャプション", summary: "最初の3秒フック2案とハッシュタグを作りました。" },
          { name: "成果分析", task: "指標と次の実験", summary: "リーチ・保存・フォローを比較し、実験を1つ提案しました。" }
        ]
      },
      founder: {
        label: "一人社長・起業", tagline: "企画・開発・グロース・CSを一人で回す事業チーム",
        why: "一人事業のボトルネックは「判断」と「繰り返し」です。繰り返しはボットへ、判断は根拠をつけて速く。",
        agents: [
          { name: "事業企画", task: "MVP範囲と価格", summary: "アイデアを2週間のMVPに削り、価格2案をまとめました。" },
          { name: "実装", task: "実装とリリース順", summary: "変更するファイル2つ、実行コマンド、検証順を整理しました。" },
          { name: "グロース", task: "初期ユーザー実験", summary: "最初の100人のチャネル実験2つと中止基準を付けました。" }
        ]
      }
    },
    agents: {
      proposal: { name: "提案設計", task: "提案の構成と論理", summary: "課題 → 解決 → 導入効果 → 計画 → 費用の5ページ構成にしました。" },
      billing: { name: "請求・売上", task: "売上と精算の流れ", summary: "入金・請求書・未収を1つの表にまとめました。" },
      followup: { name: "フォロー", task: "フォロー文の作成", summary: "商談後24時間以内に送るメールの下書きを作りました。" },
      content: { name: "コンテンツ戦略", task: "テーマと投稿カレンダー", summary: "今週7本のテーマと投稿曜日を決めました。" },
      copy: { name: "コピー", task: "フックとキャプション", summary: "最初の3秒フック2案とハッシュタグを作りました。" },
      analysis: { name: "成果分析", task: "指標と次の実験", summary: "リーチ・保存・フォローを比較し、実験を1つ提案しました。" },
      planning: { name: "企画整理", task: "要件と範囲の分解", summary: "依頼を3つのユーザーストーリーと3日間の日程に分けました。" },
      build: { name: "実装", task: "実装とリリース順", summary: "変更するファイル2つ、実行コマンド、検証順を整理しました。" },
      qa: { name: "QA", task: "検証シナリオ", summary: "回帰チェックリスト6項目を作りました。" },
      research: { name: "リサーチ", task: "根拠と競合の確認", summary: "競合3社の価格と確認が必要な項目を整理しました。" },
      ops: { name: "運用自動化", task: "繰り返し業務の自動化", summary: "繰り返し業務3つをスクリプト候補に変えました。" }
    },
    roleTasks: {
      pm: ["今週の目標をPRD草稿に分ける", "議事録をアクション項目に整理", "リリース前QAチェックリストを作る"],
      dev: ["実装順とファイル構成を整理", "バグを再現して修正計画を立てる", "リリーススクリプトを点検"],
      content: ["来週7本の投稿カレンダー", "ショート動画の最初の3秒フック2案", "InstagramとThreadsのキャプションを同時に"],
      research: ["競合3社の価格比較", "市場規模の根拠を整理", "確認が必要な項目を明示"],
      chief: ["今週のチーム優先順位を決める", "各エージェントの成果をまとめる", "次のアクションを1つ選ぶ"]
    },
    roleLabel: { pm: "企画・PM", dev: "開発・検証", content: "コンテンツ", research: "リサーチ", chief: "統括" },
    characterTasks: {
      "MOA Chief": ["今週のチーム優先順位を整理", "5人の成果をまとめて報告", "私が決めることだけ教えて"],
      "Prototyper": ["新しいアイデアを10個出す", "この機能の可能性を描く", "新しいコンセプト3案を出す"],
      "Builder": ["この画面を実際に作る", "実装順とコマンドを整理", "プロトタイプを製品の形にする"],
      "Sweeper": ["重複したコードと画面を整理", "この流れの無駄を削る", "リリース前の整理チェックリスト"],
      "Grower": ["最初の100人の流入実験を設計", "見つけてもらえるチャネルを整理", "指標を見て次の実験を選ぶ"],
      "Maintainer": ["障害が起きやすい箇所を点検", "監視とバックアップを計画", "遅い箇所とセキュリティリスクを整理"]
    },
    chiefSummary: "落ち着いて明快なリーダー — あなたと直接話し、5人に仕事を分けて結果だけを報告します。",
    roles: {
      chief: "方針・優先順位・最終報告", prototyper: "アイデアと可能性", builder: "実際の画面と実装",
      sweeper: "整理と単純化", grower: "チャネル・指標・成長", maintainer: "安定・安全・速度"
    },
    orch: {
      report: "**リーダー報告** · 🧠 MOA Chief\n\n仕事: {goal}\n\nボット{n}名に分けて進めます。",
      goalFallback: "この依頼",
      summaryHeader: "**結果**",
      summaryScope: "範囲: 「{topic}」を{n}つの仕事に分けました。",
      summaryNext: "次のアクション: まず{agent}の下書きを確認してください。",
      summaryNextEmpty: "次のアクション: やることを1つ決めてください。",
      summaryCheck: "確認が必要: 実際の数値と顧客情報はまだ未検証です。",
      summaryFoot: "_体験用のまとめです。実際の作業はアプリで続きます。_",
      proposalRuleTitle: "",
      proposalRuleBody: "",
      proposalBotTitle: "週次レポートボットをチームに追加しますか？",
      proposalBotBody: "毎週金曜に進捗を1ページにまとめるボットです。",
      designCreated: "",
      designReady: "",
      caseCreated: "**{label}** の準備ができました — ボット{n}名。",
      caseStarterNote: "",
      proposalDone: "✓ チームに追加しました。",
      proposalPassed: "· 見送りました。記録だけ残します。",
      ruleApplied: "",
      botApplied: "✓ **{name}** はチームにいます。",
      prodPromoted: "",
      readOnly: "このチームは読み取り専用です。"
    },
    replies: {
      dev: "**結論** — 「{topic}」をこのボットの仕事として整理しました。\n\n**今日やる3つ**\n1. 関係する画面やファイルを2つ確認\n2. 今日中に下書きを仕上げる\n3. 一度押して確認して共有\n\n**確認が必要** — 実際のデータに触れるか先に教えてください。\n\n_体験用の応答です。_",
      content: "**結論** — 「{topic}」を1週間分のコンテンツとして組みました。\n\n**来週7本（曜日 · テーマ）**\n- 月 · 毎日の習慣を1つ変えた話\n- 火 · 5分ルーティンで変わったこと\n- 水 · 失敗した自動化3つ\n- 木 · お金のかからない生産性ツール\n- 金 · 今週学んだこと\n- 土 · 読者の質問に回答\n- 日 · 来週の予告\n\n**最初の3秒フック2案**\n> 「これ1つ変えたら、朝が30分増えました。」\n> 「毎日やっていたこの作業、実は要りません。」\n\n**ハッシュタグ** `#生活自動化 #一人事業 #AIツール`\n\n_体験用の応答です。_",
      research: "**結論** — 「{topic}」の根拠を確認しました。\n\n**確認できたこと**\n- 3か所の公開価格\n- 直近2件のお知らせの変更点\n\n**推定**\n- 差はチャネル構成による可能性が高い（根拠は弱い）\n\n**確認が必要** — 原文リンクを1つもらえれば数字を合わせます。\n\n_体験用の応答です。_",
      chief: "**結論** — 「{topic}」をボットに分けられます。\n\n下書きをまとめて、次のアクションを1つ提案します。",
      pm: "**結論** — 「{topic}」を今週レビューできる範囲に整理しました。\n\n**範囲**\n- 問題: {topic}\n- 目標: 今週中にレビューできる下書き\n- 対象外: 実際のデータ変更\n\n**3日間の計画**\n1. 今日 — 要件とリスクの整理\n2. 明日 — 下書きとレビュー\n3. 明後日 — 反映と確認\n\n**次のアクション** — 決めるべき1件だけ選んでください。残りは下書きで用意します。\n\n_体験用の応答です。_"
    },
    toasts: {
      teamCreated: "STGにチームを作りました — #{channel}",
      caseApplied: "「{label}」チームを準備しました。",
      reset: "デモを初期状態に戻しました。",
      adminOn: "管理者モード — STG/PRODとReleaseパネルを表示します。",
      adminOff: "通常モード — 管理者ツールを隠しました。",
      needDesign: "業種を選ぶか、やりたいことを1行書いてください。",
      ruleAdded: "読み取り専用コマンドの自動承認ルールを追加しました。",
      botAdded: "{name} をチームに追加しました。",
      promoted: "PROD v0.3.0 を反映しました — バージョン履歴に記録しました。",
      installHint: "ブラウザのメニューから「ホーム画面に追加」「アプリをインストール」を選んでください。",
      installed: "ホーム画面に追加しました。",
      voiceUnsupported: "このブラウザは音声入力に対応していません — 最新のChrome・Edge・Safariを使うか、下に入力してください。",
      voiceFailed: "音声入力を開始できませんでした。マイクの権限を確認してください。",
      listening: "聞き取り中 — 選んだ言語で話してください。"
    },
    demo: {
      engine: "ブラウザ体験版",
      stateIdle: "✨ 待機中", stateWorking: "⚡ 作業中",
      chiefBadge: "リーダー", workingBadge: "⚡ 作業中",
      noActivity: "· まだ記録がありません。仕事を頼んでみてください。",
      officeHint: "{chief} リーダー · ボット{n}名",
      bubbleDelegating: "分担中…", bubbleWorking: "作業中…", doneShort: "完了！",
      zoneMeeting: "会議室", zoneMaker: "メイカーゾーン", zoneLounge: "ラウンジ",
      timeDay: "昼", timeSunset: "夕暮れ", timeNight: "夜",
      teamDefault: "私のAIチーム",
      teamChip: "{label} · ボット{n}名",
      teamReady: "**{label}チーム**ができました — ボット{n}名がオフィスに入りました。\n\n**ステップ2**で大きなボタンを押してみてください。",
      teamHello: "いいですね、**{label}**の仕事はお任せください。\n\n下のボタンを押せば、ボットに分けて結果だけまとめます。",
      quickDefault: ["🗂️ 今週のやることを整理して", "🎯 今週の優先順位を決めて", "✅ 次のアクションを1つ選んで"],
      idleLines: ["💡 下書きを整え中！", "🔍 資料を確認しています", "✍️ 返信を書いています", "☕ コーヒー休憩中", "📊 数字を合わせ中", "🌱 いい流れです", "🎯 もうすぐ終わります", "⚡ 集中中！"],
      stepDone: "完了", stepWorking: "作業中", stepWaiting: "待機",
      typing: "入力中",
      autoRoute: "自動", mentionRoute: "@指名",
      prodTopic: "読み取り専用 — ", workspace: "./workspace", inputProd: "読み取り専用",
      packTeamLabel: "このチーム", localOnly: "このタブ内だけ",
      proposalOk: "追加する", proposalPass: "いらない"
    },
    pack: {
      title: "🎁 このチームを自分のChatGPT · Claudeで使う",
      sub: "セットアップパック — 一度貼れば3分で準備できます。",
      teamLabel: "チーム構成",
      steps: [
        ["業種のパックファイルを開く", "同じ役割・仕事内容・すぐ使えるプロンプト5本が入っています。"],
        ["ChatGPT（Custom GPT / Projects）またはClaude（Projects）に貼る", "チームごとに指示ブロック1つ。韓国語と英語が入っています。"],
        ["プロンプト5本で始める", "どれも今日送れる下書きを作ります。"]
      ],
      price: "アーリーバード 14,900ウォン · バンドル 24,900ウォン",
      cta: "Latpeedでセットアップパックを購入 →",
      note: "ウェブのデモは無料のままです。パックは、いつも使うツールに同じチームを入れたい人向けの選択肢です。"
    }
  }
};
