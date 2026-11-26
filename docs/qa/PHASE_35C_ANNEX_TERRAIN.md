# 盐港 · 3.5C 第七轮 · 科研附属设施与陆地高差

基线 `35ca668`。本轮建设 N2、N4，接入陆地边界、东北山脊和西侧低地。

| 地点 | 实装 |
| --- | --- |
| N2 隔离观察设施 | 世界 Y=8.1m。接收台、采光走廊、两间独立观察室。旧隔离货棚移除，原 `quarantine-samples` 保存柜迁入新观察室。 |
| N4 科研档案中心 | 世界 Y=8.1m。高跨档案库、阅览区及独立机房。北、东及连桥侧入口可步行通行。 |
| 北部连接 | 两条直坡分别长 42m 与 41m。85m 高架步道连接两块台地，桥下原有道路和店铺通行。 |
| 东北山脊 | 档案中心北侧的 59m 山径接至世界 Y=20.9m，即海面以上 23m。 |
| 西侧潮沟步道 | 两端直坡接地，最低世界 Y=−1.6m，即海面以上 0.5m。 |
| 陆地轮廓 | 沿用 400×400m 参考范围。渲染、行走边界、大小地图和大厅预览采用同一不规则轮廓。西部码头与外海邮轮通过原连桥相接。 |

两栋合计六个搜索点。建筑、玻璃、家具、山径和海岸均由程序生成。地标名称显示在界面。

## 验收

- `node --test --test-name-pattern 'northern observation|playable coastline|eight safe spawns|expanded plant|freight mezzanines|every search case|main research|lab ramp|street blocks|each signed supply|ship|harbor|vessel|gangway' tests/world.test.mjs tests/harbor.test.mjs`。13 项通过，覆盖两栋通行、搜索点、坡口、山径、陆地边缘、旧夹层、登船和八组对侧撤离。
- `npm run build -- --base=./`。Pages 生产构建通过，保留已有的大包体积提示。
- `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/path/to/chromium node tests/field-pass-browser.mjs dist test-results/annex-terrain-final annex,terrain`。以 N-C 走两栋设施、桥面与山脊，搜索全部六处。从 S-A 走完整段潮沟步道并打开战术地图。两段均使用关闭飞行的练习模式。截图与报告写入 `test-results/annex-terrain-final/`。
- GitHub Actions 在主分支更新后执行完整测试与 Pages 部署。
