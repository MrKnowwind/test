# 盐港 · 3.5C 第八轮 · 全部旧街屋重构

基线 `739c802`。本轮覆盖旧生成器剩余的 43 个街屋地块。原药房模板的 15 个地块编号为 2、4、5、11、15、17、19、24、28、30、31、34、35、38、39。实际位置及室内格局逐块记录在 [portLots.ts](../../src/world/portLots.ts)。可探索药局为南区极光药局。

| 区域 | 新建筑 | 开放地块 | 实装用途举例 |
| --- | ---: | ---: | --- |
| 港区 | 2 | 1 | 吊索巡查工棚、防护用品库、水手接驳 |
| 中央物流 | 9 | 2 | 卸货签收、封签、周转件清点、托盘回收 |
| 东部工业 | 10 | 2 | 传感器标定、泵组检修、绝缘工装、排水前场 |
| 北部科研 | 10 | 3 | 巡测器材、申报、实验器具交接、园区庭院 |
| 南部生活 | 3 | 1 | 洗衣缝补、配餐、候车、自行车停放 |

34 栋建筑共有 26 种占地形状、34 套平面安排和 5 种屋顶。各建筑由三个功能室区组成，两个搜索点分属不同室区。场景使用实体分隔与开口，装夹工作台、配餐设备、货架和班组座椅按用途布置。各楼另有配合空间用途的陈设，例如签收处的等候座椅、包装间的货架和泵组车间的清洗台。新平面同步到大厅、大小地图和 HUD，现场通过建筑与家具定位。旧骑楼和通用阳台夹层生成代码一并移除。

## 验收

- `node --test --test-name-pattern 'new street|former street|eight safe spawns|each signed supply|every search case|freight court|freight mezzanines|northern observation|playable coastline|market stores|southern terraces|lab ramp|district plan|opposite side|arrivals, cargo|seeded mechanical|offshore vessel|ship reception|new harbor search' tests/world.test.mjs tests/harbor.test.mjs`。核对所有旧地块和药房模板、所有新建筑的碰撞通行、两处搜索点以及旧道路、仓库夹层和登船衔接。
- `npm run build -- --base=./` 生成 Pages 生产包。
- `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/path/to/chromium node tests/field-pass-browser.mjs dist test-results/street-rebuild-release street`。关闭飞行的练习模式下，从外部步行进入五区代表建筑，搜索并退出。报告和场景截图写入 `test-results/street-rebuild-release/`。
- [地图重构的 3.5C 放行条件](../design/MAP_REBUILD.md#35c-建筑差异化验收)包含地块、实际建筑差异和探索路径核对。
