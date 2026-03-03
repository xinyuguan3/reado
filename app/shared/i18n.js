const LANGUAGE_STORAGE_KEY = "reado_lang";
const LANGUAGE_EXPLICIT_KEY = "reado_lang_explicit";

const LANGUAGES = [
  { code: "zh-CN", label: "简体中文" },
  { code: "en-US", label: "English" },
  { code: "ja-JP", label: "日本語" },
  { code: "ko-KR", label: "한국어" },
  { code: "fr-FR", label: "Français" },
  { code: "de-DE", label: "Deutsch" },
  { code: "es-ES", label: "Español" },
  { code: "pt-BR", label: "Português" },
  { code: "ru-RU", label: "Русский" },
  { code: "ar-SA", label: "العربية" },
  { code: "hi-IN", label: "हिन्दी" },
  { code: "id-ID", label: "Bahasa Indonesia" }
];

const ZH = {
  "route.knowledge_map": "个人书库",
  "route.mission": "任务中心",
  "route.studio": "创作工坊",
  "route.ranking": "排行榜",
  "route.analytics": "数据看板",
  "route.library": "公共书库",
  "route.market": "交易中心",
  "route.profile": "个人资料",
  "shell.learner": "学习者",
  "shell.xp_to_next": "距离下一级还差 {xp} EXP",
  "shell.exit_experience": "退出体验",
  "shell.toggle_menu": "切换菜单",
  "shell.weekly_challenge": "每周挑战",
  "shell.weekly_goal": "阅读 3 章节历史书",
  "shell.weekly_progress": "已完成 {done}/{total}",
  "shell.weekly_board": "本周",
  "shell.total_board": "总榜",
  "shell.daily_board": "每日",
  "shell.achievement_board": "成就",
  "shell.weekly_score": "本周 XP",
  "shell.total_score": "总 XP",
  "shell.global_rank": "全球排名",
  "shell.current_rank": "当前排名",
  "shell.current_tasks": "进行中的任务",
  "shell.continue_learning": "继续学习",
  "shell.gain_gems": "+{value} 宝石",
  "shell.gain_xp": "+{value} EXP",
  "shell.level_up": "等级提升 +{value}",
  "studio.title": "创作工坊",
  "studio.subtitle": "添加来源后，一键生成关卡",
  "studio.search_placeholder": "在网络中搜索新来源（论文题目、DOI、关键词）",
  "studio.search_results": "搜索结果",
  "studio.selected_sources": "已选来源（将用于生成）",
  "studio.progress": "处理进度",
  "studio.generate": "生成可玩网页",
  "studio.upload": "上传文件",
  "studio.website": "网站",
  "studio.paste": "复制的文字",
  "studio.drop_title": "或拖放文件",
  "studio.drop_sub": "EPUB、TXT、Markdown、PDF、网页文字 等等",
  "studio.search_btn_title": "搜索来源",
  "studio.chip_web": "🌐 网络",
  "studio.chip_fast": "⚡ 快速研究",
  "studio.chip_multi": "🧠 多来源",
  "studio.logs_empty": "暂无日志。",
  "studio.progress_pct": "进度 {value}%",
  "studio.err_enter_query": "请输入查询词。",
  "studio.meta_searching": "正在搜索来源...",
  "studio.progress_searching": "正在检索网络来源...",
  "studio.log_search_done": "搜索完成，候选数：{value}",
  "studio.meta_search_done": "已找到 {value} 条来源。",
  "studio.progress_search_done": "搜索完成",
  "studio.err_search_failed": "搜索失败",
  "studio.log_search_failed": "搜索失败：{value}",
  "studio.search_empty": "暂无搜索结果。",
  "studio.source_default": "来源 {value}",
  "studio.snippet_empty": "暂无摘要",
  "studio.open": "打开",
  "studio.add_source": "加入来源",
  "studio.selected_empty": "还没有来源，请先搜索或上传。",
  "studio.remove": "移除",
  "studio.meta_parsing_files": "正在解析文件...",
  "studio.log_import_start": "开始导入文件，数量：{value}",
  "studio.log_import_done": "导入完成：{name}",
  "studio.err_file_parse": "文件解析失败：{name}",
  "studio.log_import_failed": "导入失败：{name} - {error}",
  "studio.meta_file_done": "文件导入完成，已选：{value}",
  "studio.progress_file_done": "文件导入完成",
  "studio.err_generation_failed": "生成失败",
  "studio.info_done": "生成成功",
  "studio.info_book_url": "书籍入口: {value}",
  "studio.info_generation_mode": "生成模式: {value}",
  "studio.info_html_mode": "HTML 模式: {value}",
  "studio.info_html_error": "HTML 生成问题: {value}",
  "studio.info_fallback_reason": "回退原因: {value}",
  "studio.err_poll_failed": "任务轮询失败",
  "studio.err_need_source": "请至少添加一个来源（搜索结果或上传文件）。",
  "studio.meta_generating": "正在生成可玩网页，请稍候...",
  "studio.progress_job_submitted": "任务已提交，等待执行...",
  "studio.log_generate_start": "开始生成可玩网页",
  "studio.prompt_title": "这本生成书籍的标题（可选）",
  "studio.prompt_module_count": "关卡数量（1-6）",
  "studio.log_generation_failed": "生成失败：{value}",
  "studio.err_file_import_failed": "文件导入失败",
  "studio.prompt_url": "粘贴网站 / 论文链接",
  "studio.progress_fetching_page": "正在抓取网页内容...",
  "studio.log_fetch_start": "开始抓取来源：{value}",
  "studio.log_processing_web": "正在处理网页",
  "studio.meta_website_added": "网站来源已加入并提取正文。",
  "studio.progress_website_done": "网站来源导入完成",
  "studio.err_website_failed": "网站来源抓取失败",
  "studio.log_website_failed": "网站抓取失败：{value}",
  "studio.prompt_paste": "粘贴要用于生成的文本内容",
  "studio.paste_title": "手动粘贴文本",
  "studio.meta_text_added": "文本来源已加入。",
  "studio.log_text_added": "已添加粘贴文本来源",
  "studio.progress_waiting": "等待来源输入",
  "studio.pending_source": "来源处理中",
  "studio.pending_queue": "等待上传...",
  "studio.pending_reading": "正在读取本地文件...",
  "studio.pending_uploading": "正在上传与解析...",
  "studio.pending_server": "服务端解析中...",
  "studio.pending_fetching": "正在抓取网页来源...",
  "studio.pending_done": "解析完成，加入来源列表中...",
  "studio.pending_desc": "来源正在上传/解析，完成后会自动出现在列表中。",
  "studio.err_wait_pending": "请等待来源上传/解析完成后再生成。"
  ,
  "studio.my_works": "我的可玩书架",
  "studio.my_works_empty": "还没有可玩书籍。",
  "studio.refresh": "刷新",
  "studio.publish": "上架到公共库",
  "studio.unpublish": "从公共库下架",
  "studio.delete": "删除",
  "studio.open_book": "打开书籍",
  "studio.err_delete_failed": "删除失败",
  "studio.err_publish_failed": "上架失败",
  "studio.confirm_delete": "确认删除该可玩书籍？此操作不可恢复。",
  "studio.meta_publish_done": "可见性已更新。",
  "studio.meta_delete_done": "书籍已删除。",
  "studio.meta_resumed_job": "已恢复后台任务追踪。",
  "studio.warn_active_job": "生成任务在后台继续运行。你可以切换页面，稍后回来查看。",
  "studio.rename": "重命名",
  "studio.prompt_rename": "重命名这本可玩书籍",
  "studio.meta_rename_done": "标题已更新。",
  "studio.err_rename_failed": "重命名失败",
  "studio.err_credit_unavailable": "额度系统不可用，请刷新页面后重试。",
  "studio.err_not_enough_gems": "宝石不足。需要 {need}，当前 {have}。",
  "studio.meta_credit_spent": "已消耗 {cost} 宝石。剩余 {remain}。自动章节：{modules}。",
  "studio.log_credit_spent": "已扣除额度：{value} 宝石",
  "studio.log_refund": "生成失败，已退回 {value} 宝石。",
  "studio.modal_cancel": "取消",
  "studio.modal_confirm": "确认",
  "studio.modal_add_source": "加入来源",
  "studio.website_section_title": "网站链接",
  "studio.website_section_desc": "粘贴一个链接，加入来源列表。",
  "studio.add_url": "添加链接",
  "studio.url_hint": "支持文章/文档/论文链接；缺少协议会自动补全 https://",
  "studio.upload_section_title": "上传文件",
  "studio.upload_section_desc": "上传 PDF/EPUB/Markdown/TXT，或直接拖入。",
  "studio.search_section_title": "网页检索（可选）",
  "studio.search_section_desc": "仅在需要补充来源时使用。",
  "studio.expand_optional": "展开",
  "studio.collapse_optional": "收起",
  "studio.generate_title": "生成关卡",
  "studio.knowledge_blocks": "知识块",
  "shell.task_empty_sub": "还没有任务领取记录，完成一个任务后开始追踪。",
  "shell.task_claimed": "已领取 {count} 次 · {updated}",
  "shell.recently": "最近",
  "shell.rank_top": "前 {value}%",
  "shell.rank_top_unknown": "前 --",
  "map.entry": "学习入口",
  "map.view_switch": "个人书库视图切换",
  "map.view_shelf": "书架视图",
  "map.view_map": "地图视图",
  "map.shelf_title": "个人书库",
  "map.shelf_subtitle": "默认视图 · 直接进入书籍体验",
  "map.shelf_count": "当前可体验 {count} 本书",
  "map.shelf_empty": "暂无可用书籍，请先配置 book_experiences 模块。",
  "map.manage_load_failed": "书籍管理数据加载失败：{error}",
  "map.manage_visible_public": "已上架到体验库",
  "map.manage_visible_private": "仅自己可见",
  "map.manage_unpublish": "下架",
  "map.manage_publish": "上架",
  "map.manage_delete": "删除",
  "map.category_default": "书籍模块",
  "map.module_count": "{count} 个体验模块",
  "map.hint_default": "点击进入，开始互动体验。",
  "map.cta_continue": "继续体验",
  "map.cta_start": "开始体验",
  "map.confirm_delete": "确认删除这本可玩书籍？删除后不可恢复。",
  "map.status_published": "已上架到体验库。",
  "map.status_unpublished": "已从体验库下架。",
  "map.status_deleted": "已删除该可玩书籍。",
  "map.action_failed": "操作失败：{error}",
  "map.category.science.title": "认知/硬核",
  "map.category.science.subtitle": "科学普及 · 历史 · 哲学 · 社会学",
  "map.category.personal.title": "个人修炼",
  "map.category.personal.subtitle": "心理学 · 自我提升 · 时间管理 · 思维模型",
  "map.category.career.title": "事业/财富",
  "map.category.career.subtitle": "经济金融 · 商业管理 · 职场技能 · 创业",
  "map.category.lifestyle.title": "灵感/生活",
  "map.category.lifestyle.subtitle": "艺术设计 · 传记 · 文学虚构 · 生活美学",
  "map.book.wanli-fifteen": "《万历十五年》",
  "map.book.sapiens": "《人类简史》",
  "map.book.principles-for-navigating-big-debt-crises": "《置身事外》",
  "map.book.zero-to-one": "《从零到一》"
};

const EN = {
  "route.knowledge_map": "Personal Library",
  "route.mission": "Missions",
  "route.studio": "Studio",
  "route.ranking": "Leaderboard",
  "route.analytics": "Analytics",
  "route.library": "Public Library",
  "route.market": "Marketplace",
  "route.profile": "Profile",
  "shell.learner": "Learner",
  "shell.xp_to_next": "{xp} EXP to next level",
  "shell.exit_experience": "Exit Experience",
  "shell.toggle_menu": "Toggle menu",
  "shell.weekly_challenge": "Weekly Challenge",
  "shell.weekly_goal": "Read 3 chapters this week",
  "shell.weekly_progress": "{done}/{total} completed",
  "shell.weekly_board": "This Week",
  "shell.total_board": "All-Time",
  "shell.daily_board": "Daily",
  "shell.achievement_board": "Achievement",
  "shell.weekly_score": "Weekly XP",
  "shell.total_score": "Total XP",
  "shell.global_rank": "Global Rank",
  "shell.current_rank": "Current Position",
  "shell.current_tasks": "Active Missions",
  "shell.continue_learning": "Continue",
  "shell.gain_gems": "+{value} gems",
  "shell.gain_xp": "+{value} EXP",
  "shell.level_up": "Level up +{value}",
  "studio.title": "Studio",
  "studio.subtitle": "Add sources, then generate",
  "studio.search_placeholder": "Search web sources (paper title, DOI, keywords)",
  "studio.search_results": "Search Results",
  "studio.selected_sources": "Selected Sources",
  "studio.progress": "Processing Progress",
  "studio.generate": "Generate Playable Web",
  "studio.upload": "Upload",
  "studio.website": "Website",
  "studio.paste": "Paste Text",
  "studio.drop_title": "Or drag and drop files",
  "studio.drop_sub": "EPUB, TXT, Markdown, PDF, web text, and more",
  "studio.search_btn_title": "Search sources",
  "studio.chip_web": "🌐 Web",
  "studio.chip_fast": "⚡ Fast Research",
  "studio.chip_multi": "🧠 Multi-source",
  "studio.logs_empty": "No logs yet.",
  "studio.progress_pct": "Progress {value}%",
  "studio.err_enter_query": "Please enter a query.",
  "studio.meta_searching": "Searching sources...",
  "studio.progress_searching": "Searching web sources...",
  "studio.log_search_done": "Search completed. Candidates: {value}",
  "studio.meta_search_done": "Found {value} sources.",
  "studio.progress_search_done": "Search completed",
  "studio.err_search_failed": "Search failed",
  "studio.log_search_failed": "Search failed: {value}",
  "studio.search_empty": "No search results yet.",
  "studio.source_default": "Source {value}",
  "studio.snippet_empty": "No snippet",
  "studio.open": "Open",
  "studio.add_source": "Add Source",
  "studio.selected_empty": "No sources yet. Search or upload first.",
  "studio.remove": "Remove",
  "studio.meta_parsing_files": "Parsing files...",
  "studio.log_import_start": "Start importing files. Count: {value}",
  "studio.log_import_done": "Imported: {name}",
  "studio.err_file_parse": "File parse failed: {name}",
  "studio.log_import_failed": "Import failed: {name} - {error}",
  "studio.meta_file_done": "File import completed. Selected: {value}",
  "studio.progress_file_done": "File import completed",
  "studio.err_generation_failed": "Generation failed",
  "studio.info_done": "Generation completed",
  "studio.info_book_url": "Book URL: {value}",
  "studio.info_generation_mode": "Generation mode: {value}",
  "studio.info_html_mode": "HTML mode: {value}",
  "studio.info_html_error": "HTML generation issue: {value}",
  "studio.info_fallback_reason": "Fallback reason: {value}",
  "studio.err_poll_failed": "Job polling failed",
  "studio.err_need_source": "Add at least one source first (search result or uploaded file).",
  "studio.meta_generating": "Generating playable web, please wait...",
  "studio.progress_job_submitted": "Job submitted, waiting...",
  "studio.log_generate_start": "Start generating playable web",
  "studio.prompt_title": "Title for this generated book (optional)",
  "studio.prompt_module_count": "Module count (1-6)",
  "studio.log_generation_failed": "Generation failed: {value}",
  "studio.err_file_import_failed": "File import failed",
  "studio.prompt_url": "Paste website / paper URL",
  "studio.progress_fetching_page": "Fetching page content...",
  "studio.log_fetch_start": "Start fetching source: {value}",
  "studio.log_processing_web": "Processing webpage",
  "studio.meta_website_added": "Website source added with extracted content.",
  "studio.progress_website_done": "Website source import completed",
  "studio.err_website_failed": "Website source fetch failed",
  "studio.log_website_failed": "Website fetch failed: {value}",
  "studio.prompt_paste": "Paste text content for generation context",
  "studio.paste_title": "Manually pasted text",
  "studio.meta_text_added": "Text source added.",
  "studio.log_text_added": "Pasted text source added",
  "studio.progress_waiting": "Waiting for sources",
  "studio.pending_source": "Processing source",
  "studio.pending_queue": "Queued for upload...",
  "studio.pending_reading": "Reading local file...",
  "studio.pending_uploading": "Uploading and parsing...",
  "studio.pending_server": "Server parsing file...",
  "studio.pending_fetching": "Fetching web source...",
  "studio.pending_done": "Parsed, adding to source list...",
  "studio.pending_desc": "Source is being uploaded/parsing. It will appear here when ready.",
  "studio.err_wait_pending": "Please wait until source uploads/parsing complete.",
  "studio.my_works": "My Playable Books",
  "studio.my_works_empty": "No playable books yet.",
  "studio.refresh": "Refresh",
  "studio.publish": "Publish to Library",
  "studio.unpublish": "Unpublish",
  "studio.delete": "Delete",
  "studio.open_book": "Open Book",
  "studio.err_delete_failed": "Delete failed",
  "studio.err_publish_failed": "Publish failed",
  "studio.confirm_delete": "Delete this playable book? This action cannot be undone.",
  "studio.meta_publish_done": "Visibility updated.",
  "studio.meta_delete_done": "Book deleted.",
  "studio.meta_resumed_job": "Resumed tracking for background generation job.",
  "studio.warn_active_job": "Generation keeps running in background. You can switch sections and come back later.",
  "studio.rename": "Rename",
  "studio.prompt_rename": "Rename this playable book",
  "studio.meta_rename_done": "Title updated.",
  "studio.err_rename_failed": "Rename failed",
  "studio.err_credit_unavailable": "Credit system is unavailable. Reload this page.",
  "studio.err_not_enough_gems": "Not enough gems. Need {need}, current {have}.",
  "studio.meta_credit_spent": "Spent {cost} gems. Remaining {remain}. Auto modules: {modules}.",
  "studio.log_credit_spent": "Credits spent: {value} gems",
  "studio.log_refund": "Generation failed; refunded {value} gems.",
  "studio.modal_cancel": "Cancel",
  "studio.modal_confirm": "Confirm",
  "studio.modal_add_source": "Add Source",
  "studio.website_section_title": "Website URL",
  "studio.website_section_desc": "Paste one link and add it to your source list.",
  "studio.add_url": "Add URL",
  "studio.url_hint": "Supports article/doc/paper links. Missing protocol auto-uses https://",
  "studio.upload_section_title": "Upload Files",
  "studio.upload_section_desc": "Upload PDF/EPUB/Markdown/TXT, or drag files in.",
  "studio.search_section_title": "Web Search (Optional)",
  "studio.search_section_desc": "Use only when you need extra sources.",
  "studio.expand_optional": "Expand",
  "studio.collapse_optional": "Collapse",
  "studio.generate_title": "Generate",
  "studio.knowledge_blocks": "Knowledge Blocks",
  "shell.task_empty_sub": "No mission claim yet. Complete one mission to start tracking.",
  "shell.task_claimed": "Claimed {count} time(s) · {updated}",
  "shell.recently": "Recently",
  "shell.rank_top": "Top {value}%",
  "shell.rank_top_unknown": "Top --",
  "map.entry": "Learning Hub",
  "map.view_switch": "Personal library view switch",
  "map.view_shelf": "Shelf View",
  "map.view_map": "Map View",
  "map.shelf_title": "Personal Library",
  "map.shelf_subtitle": "Default view · Jump directly into book experiences",
  "map.shelf_count": "{count} books available",
  "map.shelf_empty": "No books available yet. Please configure book_experiences modules first.",
  "map.manage_load_failed": "Failed to load book management data: {error}",
  "map.manage_visible_public": "Published to Experience Library",
  "map.manage_visible_private": "Private only",
  "map.manage_unpublish": "Unpublish",
  "map.manage_publish": "Publish",
  "map.manage_delete": "Delete",
  "map.category_default": "Book Module",
  "map.module_count": "{count} experience modules",
  "map.hint_default": "Tap to enter and start the interactive journey.",
  "map.cta_continue": "Continue",
  "map.cta_start": "Start",
  "map.confirm_delete": "Delete this playable book? This action cannot be undone.",
  "map.status_published": "Published to Experience Library.",
  "map.status_unpublished": "Unpublished from Experience Library.",
  "map.status_deleted": "Playable book deleted.",
  "map.action_failed": "Action failed: {error}",
  "map.category.science.title": "Science & Knowledge",
  "map.category.science.subtitle": "Popular Science · History · Philosophy · Sociology",
  "map.category.personal.title": "Personal Growth",
  "map.category.personal.subtitle": "Psychology · Self-Improvement · Time Management · Mental Models",
  "map.category.career.title": "Career & Wealth",
  "map.category.career.subtitle": "Economics · Business · Workplace Skills · Entrepreneurship",
  "map.category.lifestyle.title": "Lifestyle & Creativity",
  "map.category.lifestyle.subtitle": "Art & Design · Biography · Fiction · Everyday Aesthetics",
  "map.book.wanli-fifteen": "1587, A Year of No Significance",
  "map.book.sapiens": "Sapiens",
  "map.book.principles-for-navigating-big-debt-crises": "Principles for Navigating Big Debt Crises",
  "map.book.zero-to-one": "Zero to One"
};

const JA = {
  "route.knowledge_map": "知識マップ",
  "route.mission": "ミッション",
  "route.studio": "スタジオ",
  "route.ranking": "ランキング",
  "route.analytics": "分析",
  "route.market": "マーケット",
  "route.profile": "プロフィール",
  "shell.learner": "学習者",
  "shell.xp_to_next": "次のレベルまで {xp} EXP",
  "shell.exit_experience": "体験を終了",
  "shell.toggle_menu": "メニュー切替",
  "shell.weekly_challenge": "週間チャレンジ",
  "shell.weekly_goal": "今週 3 章を読む",
  "shell.weekly_progress": "{done}/{total} 完了",
  "shell.global_rank": "世界ランキング",
  "shell.current_rank": "現在順位",
  "shell.current_tasks": "進行中タスク",
  "shell.continue_learning": "続ける",
  "shell.gain_gems": "+{value} ジェム",
  "shell.gain_xp": "+{value} EXP",
  "shell.level_up": "レベルアップ +{value}",
  "studio.title": "ソースから遊べる学習ミッションを生成",
  "studio.subtitle": "あなたのノート",
  "studio.search_placeholder": "Web ソースを検索（論文タイトル、DOI、キーワード）",
  "studio.search_results": "検索結果",
  "studio.selected_sources": "選択済みソース",
  "studio.progress": "処理進捗",
  "studio.generate": "生成",
  "studio.upload": "アップロード",
  "studio.website": "Webサイト",
  "studio.paste": "テキスト貼付",
  "studio.drop_title": "またはファイルをドラッグ",
  "studio.drop_sub": "EPUB、TXT、Markdown、PDF、Web テキストなど"
};

const KO = {
  "route.knowledge_map": "지식 맵",
  "route.mission": "미션",
  "route.studio": "스튜디오",
  "route.ranking": "랭킹",
  "route.analytics": "분석",
  "route.market": "마켓",
  "route.profile": "프로필",
  "shell.learner": "학습자",
  "shell.xp_to_next": "다음 레벨까지 {xp} EXP",
  "shell.exit_experience": "체험 종료",
  "shell.toggle_menu": "메뉴 전환",
  "shell.weekly_challenge": "주간 챌린지",
  "shell.weekly_goal": "이번 주 3개 챕터 읽기",
  "shell.weekly_progress": "{done}/{total} 완료",
  "shell.global_rank": "글로벌 순위",
  "shell.current_rank": "현재 순위",
  "shell.current_tasks": "진행 중 작업",
  "shell.continue_learning": "계속 학습",
  "shell.gain_gems": "+{value} 젬",
  "shell.gain_xp": "+{value} EXP",
  "shell.level_up": "레벨 업 +{value}",
  "studio.title": "소스로 플레이형 학습 미션 생성",
  "studio.subtitle": "내 노트",
  "studio.search_placeholder": "웹 소스 검색 (논문 제목, DOI, 키워드)",
  "studio.search_results": "검색 결과",
  "studio.selected_sources": "선택한 소스",
  "studio.progress": "처리 진행률",
  "studio.generate": "생성",
  "studio.upload": "업로드",
  "studio.website": "웹사이트",
  "studio.paste": "텍스트 붙여넣기",
  "studio.drop_title": "또는 파일 드래그 앤 드롭",
  "studio.drop_sub": "EPUB, TXT, Markdown, PDF, 웹 텍스트 등"
};

const FR = {
  "route.knowledge_map": "Carte des connaissances",
  "route.mission": "Missions",
  "route.studio": "Studio",
  "route.ranking": "Classement",
  "route.analytics": "Analytique",
  "route.market": "Marché",
  "route.profile": "Profil",
  "shell.learner": "Apprenant",
  "shell.xp_to_next": "{xp} EXP jusqu'au niveau suivant",
  "shell.exit_experience": "Quitter l'expérience",
  "shell.toggle_menu": "Basculer le menu",
  "shell.weekly_challenge": "Défi hebdomadaire",
  "shell.weekly_goal": "Lire 3 chapitres cette semaine",
  "shell.weekly_progress": "{done}/{total} terminés",
  "shell.global_rank": "Classement mondial",
  "shell.current_rank": "Position actuelle",
  "shell.current_tasks": "Missions en cours",
  "shell.continue_learning": "Continuer",
  "shell.gain_gems": "+{value} gemmes",
  "shell.gain_xp": "+{value} EXP",
  "shell.level_up": "Niveau +{value}",
  "studio.title": "Générer des missions d'apprentissage interactives à partir de sources",
  "studio.subtitle": "Votre carnet",
  "studio.search_placeholder": "Rechercher des sources web (titre, DOI, mots-clés)",
  "studio.search_results": "Résultats",
  "studio.selected_sources": "Sources sélectionnées",
  "studio.progress": "Progression",
  "studio.generate": "Générer",
  "studio.upload": "Téléverser",
  "studio.website": "Site web",
  "studio.paste": "Coller du texte",
  "studio.drop_title": "Ou glisser-déposer des fichiers",
  "studio.drop_sub": "EPUB, TXT, Markdown, PDF, texte web, etc."
};

const DE = {
  "route.knowledge_map": "Wissenskarte",
  "route.mission": "Missionen",
  "route.studio": "Studio",
  "route.ranking": "Rangliste",
  "route.analytics": "Analyse",
  "route.market": "Marktplatz",
  "route.profile": "Profil",
  "shell.learner": "Lernende:r",
  "shell.xp_to_next": "{xp} EXP bis zum nächsten Level",
  "shell.exit_experience": "Erlebnis verlassen",
  "shell.toggle_menu": "Menü umschalten",
  "shell.weekly_challenge": "Wöchentliche Challenge",
  "shell.weekly_goal": "Diese Woche 3 Kapitel lesen",
  "shell.weekly_progress": "{done}/{total} erledigt",
  "shell.global_rank": "Globales Ranking",
  "shell.current_rank": "Aktuelle Position",
  "shell.current_tasks": "Laufende Aufgaben",
  "shell.continue_learning": "Fortsetzen",
  "shell.gain_gems": "+{value} Edelsteine",
  "shell.gain_xp": "+{value} EXP",
  "shell.level_up": "Levelaufstieg +{value}",
  "studio.title": "Interaktive Lernmissionen aus Quellen erzeugen",
  "studio.subtitle": "Dein Notizbuch",
  "studio.search_placeholder": "Webquellen suchen (Titel, DOI, Stichwörter)",
  "studio.search_results": "Suchergebnisse",
  "studio.selected_sources": "Ausgewählte Quellen",
  "studio.progress": "Fortschritt",
  "studio.generate": "Generieren",
  "studio.upload": "Hochladen",
  "studio.website": "Website",
  "studio.paste": "Text einfügen",
  "studio.drop_title": "Oder Dateien ziehen und ablegen",
  "studio.drop_sub": "EPUB, TXT, Markdown, PDF, Webtext und mehr"
};

const ES = {
  "route.knowledge_map": "Mapa de conocimiento",
  "route.mission": "Misiones",
  "route.studio": "Estudio",
  "route.ranking": "Clasificación",
  "route.analytics": "Analítica",
  "route.market": "Mercado",
  "route.profile": "Perfil",
  "shell.learner": "Aprendiz",
  "shell.xp_to_next": "{xp} EXP para el siguiente nivel",
  "shell.exit_experience": "Salir de la experiencia",
  "shell.toggle_menu": "Cambiar menú",
  "shell.weekly_challenge": "Desafío semanal",
  "shell.weekly_goal": "Leer 3 capítulos esta semana",
  "shell.weekly_progress": "{done}/{total} completado",
  "shell.global_rank": "Ranking global",
  "shell.current_rank": "Posición actual",
  "shell.current_tasks": "Misiones activas",
  "shell.continue_learning": "Continuar",
  "shell.gain_gems": "+{value} gemas",
  "shell.gain_xp": "+{value} EXP",
  "shell.level_up": "Subida de nivel +{value}",
  "studio.title": "Generar misiones de aprendizaje jugables desde fuentes",
  "studio.subtitle": "Tu cuaderno",
  "studio.search_placeholder": "Buscar fuentes web (título, DOI, palabras clave)",
  "studio.search_results": "Resultados de búsqueda",
  "studio.selected_sources": "Fuentes seleccionadas",
  "studio.progress": "Progreso de procesamiento",
  "studio.generate": "Generar",
  "studio.upload": "Subir",
  "studio.website": "Sitio web",
  "studio.paste": "Pegar texto",
  "studio.drop_title": "O arrastra y suelta archivos",
  "studio.drop_sub": "EPUB, TXT, Markdown, PDF, texto web y más"
};

const PT = {
  "route.knowledge_map": "Mapa de conhecimento",
  "route.mission": "Missões",
  "route.studio": "Estúdio",
  "route.ranking": "Ranking",
  "route.analytics": "Análises",
  "route.market": "Mercado",
  "route.profile": "Perfil",
  "shell.learner": "Aprendiz",
  "shell.xp_to_next": "{xp} EXP para o próximo nível",
  "shell.exit_experience": "Sair da experiência",
  "shell.toggle_menu": "Alternar menu",
  "shell.weekly_challenge": "Desafio semanal",
  "shell.weekly_goal": "Ler 3 capítulos nesta semana",
  "shell.weekly_progress": "{done}/{total} concluído",
  "shell.global_rank": "Ranking global",
  "shell.current_rank": "Posição atual",
  "shell.current_tasks": "Missões ativas",
  "shell.continue_learning": "Continuar",
  "shell.gain_gems": "+{value} gemas",
  "shell.gain_xp": "+{value} EXP",
  "shell.level_up": "Subiu de nível +{value}",
  "studio.title": "Gerar missões de aprendizagem jogáveis a partir de fontes",
  "studio.subtitle": "Seu caderno",
  "studio.search_placeholder": "Pesquisar fontes na web (título, DOI, palavras-chave)",
  "studio.search_results": "Resultados de busca",
  "studio.selected_sources": "Fontes selecionadas",
  "studio.progress": "Progresso de processamento",
  "studio.generate": "Gerar",
  "studio.upload": "Enviar",
  "studio.website": "Site",
  "studio.paste": "Colar texto",
  "studio.drop_title": "Ou arraste e solte arquivos",
  "studio.drop_sub": "EPUB, TXT, Markdown, PDF, texto web e mais"
};

const RU = {
  "route.knowledge_map": "Карта знаний",
  "route.mission": "Миссии",
  "route.studio": "Студия",
  "route.ranking": "Рейтинг",
  "route.analytics": "Аналитика",
  "route.market": "Маркет",
  "route.profile": "Профиль",
  "shell.learner": "Ученик",
  "shell.xp_to_next": "{xp} EXP до следующего уровня",
  "shell.exit_experience": "Выйти из режима",
  "shell.toggle_menu": "Переключить меню",
  "shell.weekly_challenge": "Недельный челлендж",
  "shell.weekly_goal": "Прочитать 3 главы за неделю",
  "shell.weekly_progress": "Выполнено {done}/{total}",
  "shell.global_rank": "Глобальный рейтинг",
  "shell.current_rank": "Текущая позиция",
  "shell.current_tasks": "Активные задания",
  "shell.continue_learning": "Продолжить",
  "shell.gain_gems": "+{value} кристаллов",
  "shell.gain_xp": "+{value} EXP",
  "shell.level_up": "Повышение уровня +{value}",
  "studio.title": "Создание интерактивных учебных миссий из источников",
  "studio.subtitle": "Ваш блокнот",
  "studio.search_placeholder": "Искать веб-источники (название, DOI, ключевые слова)",
  "studio.search_results": "Результаты поиска",
  "studio.selected_sources": "Выбранные источники",
  "studio.progress": "Ход обработки",
  "studio.generate": "Создать",
  "studio.upload": "Загрузить",
  "studio.website": "Сайт",
  "studio.paste": "Вставить текст",
  "studio.drop_title": "Или перетащите файлы",
  "studio.drop_sub": "EPUB, TXT, Markdown, PDF, веб-текст и другое"
};

const AR = {
  "route.knowledge_map": "خريطة المعرفة",
  "route.mission": "المهام",
  "route.studio": "الاستوديو",
  "route.ranking": "لوحة الصدارة",
  "route.analytics": "التحليلات",
  "route.market": "السوق",
  "route.profile": "الملف الشخصي",
  "shell.learner": "متعلم",
  "shell.xp_to_next": "{xp} نقطة خبرة للمستوى التالي",
  "shell.exit_experience": "إنهاء التجربة",
  "shell.toggle_menu": "تبديل القائمة",
  "shell.weekly_challenge": "تحدي الأسبوع",
  "shell.weekly_goal": "اقرأ 3 فصول هذا الأسبوع",
  "shell.weekly_progress": "اكتمل {done}/{total}",
  "shell.global_rank": "الترتيب العالمي",
  "shell.current_rank": "الترتيب الحالي",
  "shell.current_tasks": "المهام النشطة",
  "shell.continue_learning": "متابعة",
  "shell.gain_gems": "+{value} جواهر",
  "shell.gain_xp": "+{value} EXP",
  "shell.level_up": "ترقية مستوى +{value}",
  "studio.title": "إنشاء مهام تعلم تفاعلية من المصادر",
  "studio.subtitle": "دفترك",
  "studio.search_placeholder": "ابحث عن مصادر ويب (عنوان الورقة، DOI، كلمات مفتاحية)",
  "studio.search_results": "نتائج البحث",
  "studio.selected_sources": "المصادر المختارة",
  "studio.progress": "تقدم المعالجة",
  "studio.generate": "إنشاء",
  "studio.upload": "رفع",
  "studio.website": "موقع",
  "studio.paste": "لصق نص",
  "studio.drop_title": "أو اسحب الملفات وأفلتها",
  "studio.drop_sub": "EPUB وTXT وMarkdown وPDF ونصوص الويب وغير ذلك"
};

const HI = {
  "route.knowledge_map": "ज्ञान मानचित्र",
  "route.mission": "मिशन",
  "route.studio": "स्टूडियो",
  "route.ranking": "लीडरबोर्ड",
  "route.analytics": "विश्लेषण",
  "route.market": "मार्केट",
  "route.profile": "प्रोफ़ाइल",
  "shell.learner": "सीखने वाला",
  "shell.xp_to_next": "अगले स्तर तक {xp} EXP",
  "shell.exit_experience": "अनुभव से बाहर निकलें",
  "shell.toggle_menu": "मेनू बदलें",
  "shell.weekly_challenge": "साप्ताहिक चुनौती",
  "shell.weekly_goal": "इस सप्ताह 3 अध्याय पढ़ें",
  "shell.weekly_progress": "{done}/{total} पूरा",
  "shell.global_rank": "वैश्विक रैंक",
  "shell.current_rank": "वर्तमान रैंक",
  "shell.current_tasks": "सक्रिय कार्य",
  "shell.continue_learning": "जारी रखें",
  "shell.gain_gems": "+{value} जेम्स",
  "shell.gain_xp": "+{value} EXP",
  "shell.level_up": "लेवल अप +{value}",
  "studio.title": "स्रोतों से खेलने योग्य सीखने के मिशन बनाएं",
  "studio.subtitle": "आपकी नोटबुक",
  "studio.search_placeholder": "वेब स्रोत खोजें (पेपर शीर्षक, DOI, कीवर्ड)",
  "studio.search_results": "खोज परिणाम",
  "studio.selected_sources": "चयनित स्रोत",
  "studio.progress": "प्रोसेस प्रगति",
  "studio.generate": "जनरेट करें",
  "studio.upload": "अपलोड",
  "studio.website": "वेबसाइट",
  "studio.paste": "टेक्स्ट पेस्ट करें",
  "studio.drop_title": "या फ़ाइलें ड्रैग-ड्रॉप करें",
  "studio.drop_sub": "EPUB, TXT, Markdown, PDF, वेब टेक्स्ट आदि"
};

const ID = {
  "route.knowledge_map": "Peta Pengetahuan",
  "route.mission": "Misi",
  "route.studio": "Studio",
  "route.ranking": "Peringkat",
  "route.analytics": "Analitik",
  "route.market": "Pasar",
  "route.profile": "Profil",
  "shell.learner": "Pembelajar",
  "shell.xp_to_next": "{xp} EXP ke level berikutnya",
  "shell.exit_experience": "Keluar dari pengalaman",
  "shell.toggle_menu": "Ubah menu",
  "shell.weekly_challenge": "Tantangan Mingguan",
  "shell.weekly_goal": "Baca 3 bab minggu ini",
  "shell.weekly_progress": "{done}/{total} selesai",
  "shell.global_rank": "Peringkat Global",
  "shell.current_rank": "Posisi Saat Ini",
  "shell.current_tasks": "Misi Aktif",
  "shell.continue_learning": "Lanjutkan",
  "shell.gain_gems": "+{value} gem",
  "shell.gain_xp": "+{value} EXP",
  "shell.level_up": "Naik level +{value}",
  "studio.title": "Buat misi belajar interaktif dari sumber",
  "studio.subtitle": "Catatan Anda",
  "studio.search_placeholder": "Cari sumber web (judul paper, DOI, kata kunci)",
  "studio.search_results": "Hasil Pencarian",
  "studio.selected_sources": "Sumber Terpilih",
  "studio.progress": "Progres Proses",
  "studio.generate": "Buat",
  "studio.upload": "Unggah",
  "studio.website": "Situs",
  "studio.paste": "Tempel teks",
  "studio.drop_title": "Atau tarik dan lepas file",
  "studio.drop_sub": "EPUB, TXT, Markdown, PDF, teks web, dan lainnya"
};

const DICTS = {
  "zh-CN": ZH,
  "en-US": EN,
  "ja-JP": JA,
  "ko-KR": KO,
  "fr-FR": FR,
  "de-DE": DE,
  "es-ES": ES,
  "pt-BR": PT,
  "ru-RU": RU,
  "ar-SA": AR,
  "hi-IN": HI,
  "id-ID": ID
};

const listeners = new Set();
let currentLanguage = "zh-CN";
const RTL_LANGS = new Set(["ar-SA"]);

function normalizeLanguage(input) {
  const text = String(input || "").trim();
  if (!text) return "";
  const normalized = text.replace("_", "-");
  const exact = LANGUAGES.find((item) => item.code.toLowerCase() === normalized.toLowerCase());
  if (exact) return exact.code;
  const short = normalized.split("-")[0].toLowerCase();
  const match = LANGUAGES.find((item) => item.code.toLowerCase().startsWith(short + "-"));
  return match ? match.code : "";
}

function interpolate(template, params) {
  let out = String(template || "");
  const entries = params && typeof params === "object" ? Object.entries(params) : [];
  for (const [key, value] of entries) {
    out = out.replaceAll(`{${key}}`, String(value));
  }
  return out;
}

function detectLanguage() {
  try {
    const fromBootstrap = normalizeLanguage(window.__READO_BOOTSTRAP_LANG__ || "");
    if (fromBootstrap) return fromBootstrap;
  } catch {}

  try {
    const url = new URL(window.location.href);
    const fromQuery = normalizeLanguage(url.searchParams.get("lang") || "");
    if (fromQuery) return fromQuery;
  } catch {}

  try {
    const explicit = localStorage.getItem(LANGUAGE_EXPLICIT_KEY) === "1";
    if (explicit) {
      const fromStorage = normalizeLanguage(localStorage.getItem(LANGUAGE_STORAGE_KEY) || "");
      if (fromStorage) return fromStorage;
    }
  } catch {}

  try {
    const browserCandidates = Array.isArray(navigator.languages)
      ? navigator.languages
      : [navigator.language];
    for (const candidate of browserCandidates) {
      const normalized = normalizeLanguage(candidate || "");
      if (normalized) return normalized;
    }
  } catch {}

  return "en-US";
}

function applyHtmlLanguage() {
  document.documentElement.lang = currentLanguage;
  document.documentElement.setAttribute("data-reado-lang", currentLanguage);
  document.documentElement.dir = RTL_LANGS.has(currentLanguage) ? "rtl" : "ltr";
}

export function listLanguages() {
  return LANGUAGES.slice();
}

export function getCurrentLanguage() {
  return currentLanguage;
}

export function t(key, fallback = "", params = null) {
  const map = DICTS[currentLanguage] || EN;
  const text = map[key] || EN[key] || fallback || key;
  return interpolate(text, params);
}

export function setLanguage(nextLang) {
  const normalized = normalizeLanguage(nextLang) || "en-US";
  currentLanguage = normalized;
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, normalized);
    localStorage.setItem(LANGUAGE_EXPLICIT_KEY, "1");
  } catch {}
  applyHtmlLanguage();
  for (const cb of listeners) {
    try {
      cb(normalized);
    } catch {}
  }
  window.dispatchEvent(new CustomEvent("reado:langchange", { detail: { lang: normalized } }));
  return normalized;
}

export function onLanguageChange(cb) {
  if (typeof cb !== "function") return () => {};
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function translateDom(root = document) {
  const scope = root && typeof root.querySelectorAll === "function" ? root : document;
  scope.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n") || "";
    const fallback = el.getAttribute("data-i18n-fallback") || el.textContent || "";
    el.textContent = t(key, fallback);
  });
  scope.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.getAttribute("data-i18n-placeholder") || "";
    const fallback = el.getAttribute("placeholder") || "";
    el.setAttribute("placeholder", t(key, fallback));
  });
  scope.querySelectorAll("[data-i18n-title]").forEach((el) => {
    const key = el.getAttribute("data-i18n-title") || "";
    const fallback = el.getAttribute("title") || "";
    el.setAttribute("title", t(key, fallback));
  });
}

export function initReadoI18n() {
  if (window.__READO_I18N_READY__) return;
  window.__READO_I18N_READY__ = true;
  currentLanguage = detectLanguage();
  applyHtmlLanguage();
}

initReadoI18n();

window.ReadoI18n = {
  t,
  setLanguage,
  getCurrentLanguage,
  listLanguages,
  onLanguageChange,
  translateDom
};
