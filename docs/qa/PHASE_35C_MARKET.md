# 盐港 · 3.5C 第五轮 · 商街、药局与停车场

基线 `64dd423`。本轮实施南部 S2、S3、S7。

| 地块 | 实装 |
| --- | --- |
| S2 生活商街 | 便利店、五金杂货铺、街角食铺，各有独立入口、不同开间与陈设。街边步行通道从北干道绕到店铺正面，并接通药局北坡。 |
| S3 极光药局 | 取代旧街屋的独立两侧入口药局。世界 Y=1.6m，南北各由 9m 直坡接入，有公共药柜、冷藏设备和诊疗隔间。旧柜 `room-clinic-8` 迁至新址，另加冷藏柜和诊疗室应急箱。 |
| S7 公共停车场 | 世界 Y=2.0m，南北坡道接通两条原干道。程序生成三辆停放车辆、车位标线、收费亭、充电设备和检修点。 |

三处合计八个可搜查位置，其中七处为新设。HUD、大小地图及大厅预览使用实际场景位置。区域名称只在界面显示。

## 验收

- 本地运行 `node --test --test-name-pattern 'market stores|eight safe spawns|southern terraces|street blocks|freight mezzanines|every search case|signed supply' tests/world.test.mjs`。检查八组出生与撤离、各新搜索点的进出和支撑、坡道双向通行，以及相邻街屋、补给点和夹层。
- `npm run build -- --base=./` 构建 Pages 生产包。
- `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/path/to/chromium node tests/field-pass-browser.mjs dist test-results/market-pass market`。以 S-B 出生点为起点，步行穿过药局和商街。停车场从北干道另行起步并从南坡走出，两段都使用关闭飞行的练习模式，截图使用实机渲染。报告和截图写入 `test-results/market-pass/`。
- GitHub Actions 按既有 Pages 流程执行完整测试。

3.5C 接续 S5 海员旅馆、科研园剩余设施与全图地形连接。完整陆地轮廓及 22.5m 地表高差仍按蓝图推进。
