# 逐件搜索 P3 · 2026-11-13

实现位于 `src/raid/containerSearch.ts`、`raid.ts`、`backpack.ts`、`src/ui/backpackView.ts` 与 `src/app/main.ts`。E 立即打开容器的 6×4 网格；未知物品只显示占格与问号。搜索圈按物品顺序推进，每件约 1.0～1.48秒，已知物品可提前点击后放置、拖入背包或双击自动放入；R 旋转，预览以绿/红色区分适配与冲突。图标由 Canvas 路径生成，揭示/拾取用 WebAudio。

内容在出击创建时按种子与容器 ID 固定：保留原关键卡/样本/补给，并加入少量普通物资。关闭保留揭示与取走状态，距离超过3m暂停搜索/拒绝转移；背包打开时世界继续运行。未揭示不可转移，单件放置失败不修改容器或背包。撤离规则、入仓去重、货币存档格式沿用现有保证；旧直接批量拾取不再用于物资。

针对性搜索测试与原撤离/仓库测试通过。浏览器用真实 E、点击格子和关闭重开，验证未知→逐件揭示→提前放置、远离暂停、满包保留、卡片撤离/变卖重载；[报告](../../test-results/search-p3/report.json)、[揭示](../../test-results/search-p3/02-first-revealed.png)、[满包保留](../../test-results/search-p3/04-full-retained.png)。本轮还补入 R 旋转后从容器拖入背包检查；最终验收以最新报告和 [STATUS](../memory/STATUS.md) 记录为准。
