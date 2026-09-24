/*
 * 烂果杯宾果词条数据（合并版）
 *
 * 每个词条包含：
 *   id     : 唯一编号
 *   level  : 等级 1~5（同一等级的词条只会出现在同等级的格子里）
 *   grade  : 档位 A~E（仅作展示与对照）
 *   score  : 该词条的基础分数
 *   title  : 标题
 *   body   : 正文条件（可留空）
 *   plated : 镀层条件（可选，不写就没有镀层效果）
 *   tracker: 记录终端配置（可选，单个终端）
 *   trackers: 记录终端配置数组（可选，一个词条挂多个终端时用它）
 *
 * tracker / trackers 里每一项的可选配置：
 *   counter   数量记录器（target / platedTarget / drivePlate）
 *   checklist 多选清单（options / target / platedTarget）
 *   failure   失败标记
 *
 *   镀层判定：除 drivePlate 之外的计数类终端都达标 -> 完成；
 *             完成且所有镀层条件满足 -> 镀层。
 *             drivePlate: true 表示「该终端达到 target」本身就是镀层条件
 *             （用于完成与镀层由不同终端决定的词条，例如「隐秘藏品」）。
 *
 * 添加新词条示例：
 * { id: 99, level: 3, grade: "C", score: 80, title: "词条标题", body: "完成条件", plated: "镀层条件" },
 */

/* ============================================================
   记录终端用到的常量清单
   ============================================================ */
const BLACKFLOW_NODE_TYPES = [
  "未知的凶戾", "未知的诡秘", "林间空地", "作战", "紧急作战", "险路恶敌",
  "不期而遇", "安全的角落", "命运所指", "得偿所愿", "狭路相逢", "诡意行商",
  "失与得", "险路尽头", "险路小径", "秘境行商", "应急助力", "曲折密道",
  "羽瞰点", "“居民”据点", "误入奇境", "先行一步"
];

const BLACKFLOW_NATURAL_ITEMS = [
  "种子", "血蕈", "雾滚草", "回声玉米", "浪花", "霜晶树",
  "多生苔藓", "枯苔藓球", "板藤", "恋家果", "光彩松露", "笼控器"
];

const BLACKFLOW_CONCEPTS = ["白模鸟", "白模狗", "白模鱼", "涂装黎博利", "涂装佩洛", "涂装阿戈尔"];
const BLACKFLOW_ELEMENTS = ["凋亡损伤", "灼燃损伤", "神经损伤", "侵蚀损伤", "狂躁损伤"];
const BLACKFLOW_CHESTS   = ["普通宝箱", "刺箱", "怪箱", "零件箱"];

/* ============================================================
   主表格词条
   ============================================================ */
window.BINGO_DATA = [

  /* ===== 5 级 / A 档 / 200 分（共 6 条） ===== */
  { id: 1,  level: 5, grade: "A", score: 200, title: "奇美拉",   body: "完成结局“畸症”" },
  { id: 2,  level: 5, grade: "A", score: 200, title: "会心一击", body: "一击超过 50w", plated: "一击超过 100w" },
  { id: 3,  level: 5, grade: "A", score: 200, title: "极速之手", body: "在 2h 内通关游戏", tracker: { type: "failure", label: "超时状态" } },
  { id: 4,  level: 5, grade: "A", score: 200, title: "大胃戴",   body: "生吃“玻利瓦尔，症结之核”、“洛伦茨，扰动之谬”或“卡德霍，黑流之源”", plated: "至多部署一名炎国干员（用以触发炎佑，其自身不能对敌方单位造成伤害）并通过结局" },
  { id: 5,  level: 5, grade: "A", score: 200, title: "主角",     body: "由阿米娅完成“玻利瓦尔，症结之核”、源阶方或“卡德霍，黑流之源”的击杀" },
  { id: 6,  level: 5, grade: "A", score: 200, title: "玉米晓夫", body: "本局中至少获得过 8 个回声玉米", plated: "至少获得过 11 个回声玉米" },
   { id: 14, level: 5, grade: "A", score: 200, title: "致盲",           body: "只通过阻挡或装置反隐", tracker: { type: "failure", label: "反隐违规状态" } },

  /* ===== 4 级 / B 档 / 120 分（共 8 条） ===== */
  { id: 7,  level: 4, grade: "B", score: 120, title: "礼帽",           body: "不在商店中选择选项“请坎诺特降价”", tracker: { type: "failure", label: "违规状态" } },
  { id: 8,  level: 4, grade: "B", score: 120, title: "完美主义",       body: "全程完美作战（最终关卡除外）", plated: "全程没有在关卡内让目标生命值降低过", tracker: { type: "failure", label: "完美作战状态" } },
  { id: 9,  level: 4, grade: "B", score: 120, title: "最是人间留不住", body: "至少碎过一颗霜晶树" },
  { id: 10, level: 4, grade: "B", score: 120, title: "单兵计划",       body: "有一名干员同时拥有三种招募增益藏品的效果", plated: "有一名干员同时拥有四种招募增益藏品的效果" },
  { id: 11, level: 4, grade: "B", score: 120, title: "不积跬步",       body: "探索过黑流树海中的至少 20 种不同类型节点", plated: "探索过黑流树海中的全部 22 种不同类型节点", tracker: { type: "checklist", label: "节点探索记录", options: BLACKFLOW_NODE_TYPES, target: 20, platedTarget: 22 } },
  { id: 12, level: 4, grade: "B", score: 120, title: "最终防线",       body: "通关时目标生命值为 1，护盾值为 0" },
  { id: 13, level: 4, grade: "B", score: 120, title: "心急如焚",       body: "全程使用二倍速", tracker: { type: "failure", label: "倍速违规状态" } },
  

  /* ===== 3 级 / C 档 / 80 分（共 9 条） ===== */
  { id: 15, level: 3, grade: "C", score: 80, title: "登峰造极", body: "以难度 n12 通关游戏" , plated: "以难度 n15 通关游戏"},
  { id: 16, level: 3, grade: "C", score: 80, title: "嚼嚼嚼",   body: "击杀 15 只猎犬 proto", tracker: { type: "counter", label: "已击杀猎犬 proto", unit: "只", target: 15, min: 0 } },
  { id: 17, level: 3, grade: "C", score: 80, title: "小苹果",   body: "先锋干员全程不被击倒", tracker: { type: "failure", label: "先锋击倒状态" } },
  { id: 18, level: 3, grade: "C", score: 80, title: "植物学家", body: "获得过至少 10 种自然物", plated: "获得过全部 12 种自然物", tracker: { type: "checklist", label: "自然物图鉴", options: BLACKFLOW_NATURAL_ITEMS, target: 10, platedTarget: 12 } },
  { id: 19, level: 3, grade: "C", score: 80, title: "静默猎手", body: "至少触发 3 次追猎", plated: "至少触发 5 次追猎", tracker: { type: "counter", label: "追猎触发次数", unit: "次", target: 3, platedTarget: 5, min: 0 } },
  { id: 20, level: 3, grade: "C", score: 80, title: "偷天换日", body: "同时获得藏品“红日冠冕”和“黑夜披肩”", tracker: { type: "checklist", label: "藏品收集", options: ["红日冠冕", "黑夜披肩"], target: 2 } },
  { id: 21, level: 3, grade: "C", score: 80, title: "空床",     body: "进入最终关卡时，零件箱装载量不高于零件箱容量的 40%（向上取整）", plated: "进入最终关卡时，零件箱为空" },
  { id: 22, level: 3, grade: "C", score: 80, title: "烂果",     body: "出售过一个估价≤16 的恋家果" },
  { id: 23, level: 3, grade: "C", score: 80, title: "鲜蔬",     body: "出售过一个估价≥32 的雾滚草或血蕈" },

  /* ===== 2 级 / D 档 / 80 分（共 7 条） ===== */
  { id: 24, level: 2, grade: "D", score: 80, title: "短兵相接",     body: "通关时至少携带 7 位六星先锋/近卫/重装/特种" },
  { id: 25, level: 2, grade: "D", score: 80, title: "远程打击",     body: "通关时至少携带 7 位六星狙击/术士/医疗/辅助" },
  { id: 26, level: 2, grade: "D", score: 80, title: "均衡",         body: "每个职业最多只抓取 1 名六星干员（包括机械师）", tracker: { type: "failure", label: "违规状态" } },
  { id: 27, level: 2, grade: "D", score: 80, title: "说好的……呢", body: "进入第五层时，职业队的本家六星数量不多于3（不包括机械师）" },
  { id: 28, level: 2, grade: "D", score: 80, title: "擢升",         body: "通关时，至少拥有 20 名进阶干员" },
  { id: 29, level: 2, grade: "D", score: 80, title: "指引β",       body: "携带沙盘β通关", plated: "同时携带沙盘α、沙盘β通关" },
  { id: 38, level: 2, grade: "D", score: 80, title: "纯净",         body: "通关时，职业队的非本家六星数量不多于1（不包括机械师）", tracker: { type: "failure", label: "违规状态" } },

  /* ===== 1 级 / E 档 / 50 分（共 8 条） ===== */
  { id: 30, level: 1, grade: "E", score: 50, title: "随心所欲", body: "在选择招募组合时，使用“随心所欲”策略开局", tracker: { type: "failure", label: "违规状态" } },
  { id: 31, level: 1, grade: "E", score: 50, title: "本源研习", body: "触发过所有的元素爆发（敌方或我方的均可）", tracker: { type: "checklist", label: "元素爆发记录", options: BLACKFLOW_ELEMENTS, target: 5 } },
  { id: 32, level: 1, grade: "E", score: 50, title: "深不见底", body: "至少使 25 名敌人入坑", tracker: { type: "counter", label: "已入坑人数", unit: "名", target: 25, min: 0 } },
  { id: 33, level: 1, grade: "E", score: 50, title: "动物学家", body: "获得过所有概念体", tracker: { type: "checklist", label: "概念体图鉴", options: BLACKFLOW_CONCEPTS, target: 6 } },
  { id: 34, level: 1, grade: "E", score: 50, title: "基石",     body: "通关时，携带干员夜刀、黑角" },
  { id: 35, level: 1, grade: "E", score: 50, title: "隐秘藏品", body: "成功收集见到的所有宝箱", plated: "收集见到的所有宝箱，同时至少有 5 名干员被刺箱/怪箱击倒", trackers: [
    { type: "failure", label: "宝箱是否全部收集" },
    /* 完成看宝箱、镀层看击倒数：drivePlate 让这条计数只参与镀层判定 */
    { type: "counter", label: "击倒干员计数", unit: "名", target: 5, min: 0, drivePlate: true }
  ] },
  { id: 36, level: 1, grade: "E", score: 50, title: "指引α",   body: "携带沙盘α通关", plated: "同时携带沙盘α、沙盘β通关" },
  { id: 37, level: 1, grade: "E", score: 50, title: "贪心",     body: "每次进入得偿所愿时，若可以花 4 源石锭刷新，则必须选择刷新选项", tracker: { type: "failure", label: "违规状态" } }

];

/* ============================================================
   F 级独立词条：每完成一条增加 0.05 得分系数，不进入 5×5 棋盘和 Bingo 连线。
   ============================================================ */
window.BINGO_F_DATA = [
  { id: "F01", grade: "F", coefficient: 0.05, title: "我见过你？",   body: "至少遇见两次“货从口出”" },
  { id: "F02", grade: "F", coefficient: 0.05, title: "一切？",       body: "同时拥有藏品“漆黑的舞鞋”和“洁白的舞鞋”" },
  { id: "F03", grade: "F", coefficient: 0.05, title: "老缠杯？",     body: "在结局关卡，所有干员携带 1 技能" },
  { id: "F04", grade: "F", coefficient: 0.05, title: "襁褓白泽？",   body: "获得至少 6 个临时招募" },
  { id: "F05", grade: "F", coefficient: 0.05, title: "安眠？",       body: "遇见事件“安眠一隅”" },
  { id: "F06", grade: "F", coefficient: 0.05, title: "英雄母亲？",   body: "在一局游戏中获得过至少 5 个襁褓" },
  { id: "F07", grade: "F", coefficient: 0.05, title: "这也言周？",   body: "拥有过恰好325源石锭或者零件箱估价恰好有为325的时刻" },
  { id: "F08", grade: "F", coefficient: 0.05, title: "野蛮退化？",   body: "全程不消除理想源" },
  { id: "F09", grade: "F", coefficient: 0.05, title: "孤岛？",       body: "在整局游戏中，不使用除阿米娅之外的任何医疗干员" }
];

/* ============================================================
   抽取规则

   always : 这些 id 必定出现在棋盘上，占用它自己等级的格子。
            必须能在上面的数据里找到，否则会被忽略。
   ============================================================ */
window.BINGO_DRAW_RULES = {
  /* 奇美拉（5 级）、礼帽（4 级）、登峰造极（3 级）
     以及指引α（1 级）、指引β（2 级）均必定出现 */
  always: [1, 7, 15, 36, 29]
};
