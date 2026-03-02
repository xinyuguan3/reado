# Railway 书籍体验生成工作流（Codex + Skills）

## 1. 目标

在 Railway 上将“用户上传书籍 -> 互动学习体验 -> 个人书库/公共阅读区上架”做成稳定流水线，支持：

1. 自动解析目录与知识块。
2. 每个知识块并行生成 10 道左右可学习/试错题目（Duolingo + Khan + Coursera 风格混合）。
3. 并行生成碎片、徽章、音频复盘、沉浸式彩蛋关。
4. 失败自动重试与端到端闭环验收。
5. 完成后扣费并入库，支持公开上架。

## 2. Railway 运行拓扑

1. `api` 服务：当前 `scripts/serve.mjs`，负责上传、状态、扣费、上架。
2. `worker` 服务：Codex 执行器，消费任务队列并调度 skills。
3. `redis`：队列与任务状态（BullMQ/同类队列）。
4. `storage`：原始书文件、中间产物、最终体验包（可用 Supabase Storage）。
5. `codex runtime`：在 worker 中拉起，按任务调用 skill。

## 3. Skill 清单（已匹配）

已加入安装脚本：
- `book-reader`：长书分段读取/进度。
- `ai-review`：结构化观点与评论产物。
- `boof`：PDF->Markdown->索引检索。
- `anki-connect`：卡片化复习（可选输出）。
- `zettel-link`：知识连接图谱。
- `agents-skill-podcastifier`：音频复盘。
- `bex-nano-banana-pro`：碎片/徽章图生成（你提到的 banana pro 路线）。

脚本：
- [`install-railway-skills.sh`](/Users/guanxinyu/Documents/GitHub/reado/scripts/studio-tools/install-railway-skills.sh)
- `npm run skills:railway`

说明：
- `banana pro` 对应 skill 已找到：`bex-nano-banana-pro`。
- 如果 Railway 环境缺 `REPLICATE_API_TOKEN`，图片链路会降级为占位图并进入重试队列。
- 未找到成熟通用 skill：`信息密度过滤器`。建议在 worker 内置评估器实现（第 7 节）。

## 4. 端到端主流程

1. 用户上传书籍（pdf/epub/txt）后，创建 `book_generation_job`，状态 `queued`。
2. `ingest` 阶段：抽取元数据（页数、字数、目录、章节结构），落盘规范化文本。
3. 执行“信息密度过滤器”：过水章节不建知识块，直接标记为“背景补充”。
4. 生成知识块计划（每块代表完整知识体系）：
   - 目标：`6~36` 个知识块，按书体量自适应。
   - 每块绑定学习目标、前置知识、核心概念、易错点。
5. 并行生产（核心）：
   - `quiz-gen`: 每知识块约 10 道题，分成 10 个 30 秒微任务。
   - `asset-gen`: 碎片图片 + 徽章图 + 文案。
   - `audio-gen`: 该知识块音频复盘（1~3 分钟）+ 全书总复盘（5~12 分钟）。
   - `easter-gen`: 全书 1 个沉浸式彩蛋关（场景化决策模拟）。
6. `assembler` 阶段：合并为 `module.json + code.html + assets/*`，生成可运行体验。
7. `qa` 阶段（自动验收）：
   - 端到端试玩脚本可通关（不死链、不空页面、不缺素材）。
   - 图片/音频存在且可访问。
   - 题目质量达标（见第 7 节）。
8. 若失败：只重跑不达标分片，不重做全书。
9. 全部通过后 `finalize`：
   - 扣除最终额度（此前只是冻结预扣）。
   - 写入个人书库并返回可进入体验链接。
   - 可选一键上架公共阅读区。
10. 向用户推送完成通知 + 扣费明细 + 获得奖励。

## 5. ETA 估算与用户告知

在 `ingest` 完成后立即给出预估：

```text
eta = queue_wait + parse + parallel_gen + qa + buffer

parse = pages*0.30s + ocr_pages*1.2s
blocks = clamp(round(words/1800), 6, 36)
parallel_gen = max(
  blocks*quiz_sec/workers_quiz,
  blocks*asset_sec/workers_asset,
  blocks*audio_sec/workers_audio,
  easter_sec/workers_easter
)
qa = blocks*6s + 90s
buffer = 15%
```

默认系数建议：
- `quiz_sec=26`
- `asset_sec=18`
- `audio_sec=22`
- `easter_sec=240`
- `workers_quiz=8`, `workers_asset=4`, `workers_audio=4`, `workers_easter=2`

用户文案模板：
- “已拆出 {blocks} 个知识块，预计 {eta_min}~{eta_max} 分钟完成，建议在 {return_time} 后回来查看。”

## 6. 题目生成规范（Duolingo/Khan/Coursera 融合）

每知识块固定 10 题，结构：
1. `2` 题：阅读理解（短文证据定位）。
2. `3` 题：概念辨析（选择/配对/排序）。
3. `3` 题：应用推理（情境决策、反例判断）。
4. `1` 题：纠错题（给错误推导，要求修正）。
5. `1` 题：微项目题（30~90 秒可完成）。

每题都要有：
- `why_this_matters`（为什么要学）
- `hint`（最少 1 条）
- `retry_feedback`（答错后具体反馈，不给空话）
- `mastery_signal`（通过标准）

## 7. 信息密度过滤器（防“废话题”）

章节先过过滤再出题，建议阈值：

```text
density_score = 0.35*concept_density
              + 0.25*claim_evidence_ratio
              + 0.20*novelty_ratio
              + 0.20*actionability_ratio

保留条件: density_score >= 0.62
```

低于阈值：
- 不生成独立知识块。
- 并入相邻高密度块，作为“背景补充卡片”。

## 8. 随机奖励池（Mystery Box）

三类并行产物，答题/连胜/彩蛋关触发掉落：

1. 功能外挂：
   - 注意力保护罩（极简 UI + 专注音轨）
   - 连胜冻结券（中断保护）
2. 视觉身份资产：
   - 碎片（收集品）
   - 徽章（集齐碎片合成）
3. 认知捷径：
   - 知识块音频复盘
   - 全书总复盘播客

## 9. 质检与重试策略

质检项：
1. 页面闭环：可从知识块进入题目、结算、奖励、下一块。
2. 素材完整：碎片/徽章/音频 URL 全可访问。
3. 题目质量：拒绝模板化空反馈，拒绝答案泄露式提示。
4. 彩蛋关可玩：有目标、反馈、结算。

重试策略：
1. 分片重试最多 `2` 次。
2. 仍失败则降级：
   - 图片失败 -> 占位图 + 后台异步补图。
   - 音频失败 -> 文本复盘先上线 + 后台补音频。
3. 连续失败触发人工审核标记，不阻塞全书其余模块。

## 10. 额度与结算

1. 创建任务先“冻结”预估额度，不立即实扣。
2. 任务成功时按实际成本结算，多退少补。
3. 失败或取消自动退款。
4. 写入账单事件：`reserved/charged/refunded`，前端可追踪。
5. 上架公共阅读区后，支持创作者返利（例如 5% 额度返还）。

推荐再加三条业务规则：
1. `Rollover Credits`：按月结转上限（例如可结转当月剩余额度的 60%，有效期 2 个月）。
2. 创作者分成：用户发布书籍被购买后，给发布者返还标价额度的 5%。
3. 拉新优惠：同一用户成功邀请 2 位新付费用户后，发放 80% 首单折扣券（仅一次）。

## 11. 红黑榜落地

应做：
1. 可视化进度条，且把大关卡拆成 10 个短任务。
2. 联盟段位按能力分层竞争。
3. 每本书结尾提供代入式最终挑战（彩蛋关）。

避免：
1. 过度低幼动画与口吻。
2. 纯签到式奖励（无学习意义）。
3. 无反馈的“答对/答错”。

## 12. 你当前仓库可直接执行的动作

1. 安装技能：`npm run skills:railway`
2. 在 Railway worker 启动命令前增加技能安装步骤。
3. 将本工作流接入现有 `studioJobs` 状态机（`queued -> running -> qa -> done/failed`）。
4. 将最终产物写入 `book_experiences/<book-id>/<module-id>/`，自动出现在个人书库，可选公开。

## 13. 新增 API（已落地）

1. `POST /api/studio/books/jobs`
2. Body（JSON）支持：
   - `bookFile`: `{ name, type, contentBase64 }`
   - 或 `file`: `{ name, type, contentBase64 }`
   - 或 `url` / `sources` / `input`
   - 可选：`title`, `moduleCount`, `blockCount`, `publishPublic`
   - 可选：`pipelineHtmlProvider` (`template|llm|auto`，默认 `template`，避免依赖 stitch)
3. 返回：
   - `job.eta`（预计分钟区间 + 建议返回时间）
   - `job.pipeline`（book pipeline 摘要）
   - `job.creditCharge`（预扣额度）

## 14. 媒体生成 Provider（已落地）

`scripts/serve.mjs` 已支持真实媒体生成与自动降级：

1. 图片（碎片/徽章）：
   - 优先调用 `bex-nano-banana-pro/generate.py`（需 `REPLICATE_API_TOKEN`）
   - 失败自动回退到 SVG data URI 占位图
2. 音频复盘：
   - 优先调用 ElevenLabs TTS（需 `ELEVENLABS_API_KEY`）
   - 失败自动回退到静音 wav + 文本复盘

关键环境变量：
- `READO_BOOK_PIPELINE_IMAGE_PROVIDER=auto|nano-banana|fallback`
- `READO_BOOK_PIPELINE_AUDIO_PROVIDER=auto|elevenlabs|fallback`
- `READO_CODEX_SKILLS_DIR` / `READO_NANO_BANANA_SCRIPT`
- `REPLICATE_API_TOKEN`
- `ELEVENLABS_API_KEY`
- `READO_ELEVENLABS_VOICE_ID`
- `READO_ELEVENLABS_MODEL_ID`
- `READO_ELEVENLABS_OUTPUT_FORMAT`

## 15. 模块 Pipeline 元数据 API（已落地）

新增：

1. `GET /api/content/modules/:slug/pipeline`
2. 返回：
   - `module`（公开模块基础信息）
   - `pipeline`（来自 `module.json.book_pipeline`，可用于前端任务面板/奖励面板/音频入口）
