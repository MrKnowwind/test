# 盐港 · 南区实景与局内装备反馈

基线 `1f3d850`。本轮单独处理玩家截图中的旅馆坡口、墙角突出件、内外陈设和随身装备面板。

| 问题 | 修法 |
| --- | --- |
| 南北坡口伸上公路 | 南区干道和入口共用路缘坐标。旅馆和交通站的坡道在车道边降到地面，住宅台阶内收至前廊一侧，药局南口改为地块内的短台阶。住宅、社区中心的北口同样接至路缘。 |
| 墙角出现没有窗洞对应的长条 | 旅馆窗台取自实际窗洞尺寸。外墙按独立窗洞和墙段生成，可透光的玻璃与实体边界同步。山墙封合，入口和坡道扶手接到对应支撑。 |
| 花池占道或穿入台地 | 逐个核对 17 处街道花池的底座四角。九处调整位置，底座在同一承托面上，研究园花池从平台高度建立。 |
| 室内家具脱离用途 | 大厅视线从入门通向接待，沙发围绕茶几，行李架、推车和布草车按房间归位。通铺设个人储物，双床共用床头柜，转角客房将椅子和阅读灯布置在窗边书桌。候车、餐饮和商街用各自的柜台物件、货架和公共设施补足生活细节。 |
| 背包独立打开时携行栏偏宽 | 独立面板左侧主要显示人物和七个方形槽位，右侧收紧随身袋和背包。打开容器才显示第三块内容，窄窗口重排。装备槽仅展示图标，点击仍可操作，移回背包格和重新装备使用原有交互。 |

旅馆布置参考小型旅店的公共空间和客房分层，以及由入口通向接待、休息区和庭院的组织。室外布置参考把街边家具与步行通道分开。游戏内几何和道具由程序制作。 [Tsuyama Hotel](https://www.archdaily.com/1187432/tsuyama-hotel-i-and-ii-renovation-naad-plus-studio-tata) · [Yu Hotel](https://www.archdaily.com/895579/yu-hotel-shanghai-benzhe-architecture-design) · [NACTO Sidewalk Zones](https://nacto.org/publication/urban-street-design-guide/street-design-elements/sidewalks/sidewalk-zones/)

## 复现

- 定向测试覆盖道路边缘胶囊通行、路面渲染高度、花池占地、外墙玻璃碰撞、六处旅馆搜索点、联排前廊和室内楼梯、南区地形、全部八组出生至对侧撤离。命令为 `node --test --test-name-pattern 'southern street|planted street|southern terraces|seafarers inn|playable body crosses|market stores|eight safe spawns|every search case|main research|former street|new street|coastline|civic interiors|attached residence|cold chain|landside' tests/world.test.mjs tests/harbor.test.mjs tests/civic.test.mjs`。
- `npm run build -- --base=./` 生成生产包。GitHub Actions 执行全量测试及 Pages 部署。
- `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/path/to/chromium node tests/field-pass-browser.mjs dist test-results/feedback-inn inn,loadout`。实走旅馆两侧入口及两层，搜索六处，核对三种窗口宽度的独立与容器状态，并操作副武器收纳、装备。
- `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/path/to/chromium node tests/field-pass-browser.mjs dist test-results/feedback-south south,market`。实走交通站、社区中心、联排台阶和客房、商街、药局、停车区，复核南侧撤离。

本轮实景陈设走查集中在南区。街道花池的占地与落地校验覆盖全图。
