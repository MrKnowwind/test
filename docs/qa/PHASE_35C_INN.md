# 盐港 · 3.5C 第六轮 · 海员旅馆

基线 `6c8c319`。本轮实施南部 S5。

| 位置 | 实装 |
| --- | --- |
| 台地及入口 | 世界 Y=3.1m。南北各有 16m 直坡，连通原有的两条直线干道。旅馆两侧均可进出。 |
| 一层 | 接待台、休息区、行李间和布草间。一条公共楼梯通往二层。 |
| 二层 | 世界 Y=6.35m。船员通铺、双床房和带书桌的转角房各有独立布局。 |

上下层各三处搜索点。大厅预览纳入旅馆轮廓，局内大地图标出楼梯，HUD、小地图和大地图按楼层显示。建筑及陈设由程序生成，区域名称在界面显示。

## 验收

- `node --test --test-name-pattern 'seafarers inn|eight safe spawns|southern terraces|market stores|every search case|arrivals, cargo' tests/world.test.mjs`。六项通过，覆盖进出路线、楼梯、全部六处搜索点和邻区回归。
- `npm run build -- --base=./`。Pages 生产构建通过，保留已有的大包体积提示。
- `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/path/to/chromium node tests/field-pass-browser.mjs dist test-results/inn-pass-final inn`。Chromium 种子 5 从 S-C 出生，在关闭飞行的练习模式中沿南坡进入旅馆，上下楼梯，探索三间客房并从北坡回到干道。共打开五处搜索点，核对 HUD 和小地图楼层。报告和截图写入 `test-results/inn-pass-final/`。
- GitHub Actions 在主分支更新后执行完整测试及 Pages 部署。

3.5C 接续科研园 N2 与 N4、整体陆地轮廓和地形连接。
