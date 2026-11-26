# 盐港 · 3.5C 第九轮 · 中央物流与东部工业

基线 `7273c24`。按分拣、管理、周转、检修、过滤与控制的实际用途布置空间。建筑、车辆、道具与设施用程序几何制作，名称在界面显示。

| 蓝图地块 | 实装 |
| --- | --- |
| C3 分拣中心 | 32×40m。双输送线、分拣复核台与发货笼围绕贯通装卸道。东侧楼梯接 +3.24m 桥式夹层，保留分拣工具箱与夹层箱交互 ID。 |
| C4 物流办公楼 | 1F 为南北贯通的大厅、接待台、档案室和玻璃分隔会议区。2F 地坪 +3.30m，值班室与员工交接区分隔。旧仓库内的值班隔间撤除，`duty-card` 迁入 2F 且全图只有一处保底点。 |
| C5 车辆转运场 | 贯通发车道、两种驻车货车、不同泊位和调度棚。备件可直接捡取。 |
| E1 设备维修厂 | 单坡屋面，装卸通道两侧分别布置压装工位、工装架及原有可步行夹层。 |
| E2 水处理设施 | 罐体、平台和原坡道周边补上地面过滤院、计量台、管线和下凹排水渠。两座桥面在 0m，排水渠底在 −1.12m。 |
| E4 工业控制中心 | 横穿一楼的值勤通道连接检测台、监控台、办公角与设备间。真实楼梯接 +3.64m 的临厂观察室。 |
| 维修通道 | 原有撤离坐标 (189, −90) 设实体检查棚。普通局继续检查随身维修卡，持卡退出并结算。 |

## 验收

- `node --test --test-name-pattern 'logistics buildings|industrial workspaces|freight mezzanines|warehouse doorways|dense transfer|expanded plant|eight safe spawns|every search case|new street|former street|district plan|factory maintenance|districts retain|playable body|playable coastline|north.*observation|offshore vessel|new harbor search' tests/world.test.mjs tests/harbor.test.mjs`。19 项覆盖两个工作区的楼梯、进出、搜刮和桥面、八组出生/撤离、43 个旧街屋地块的差异化、支撑面、厂区坡道与登船连接。
- `npm run build -- --base=./` 生成 Pages 生产包。
- `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/path/to/chromium node tests/field-pass-browser.mjs dist test-results/worksites-release service,worksites`。在实际浏览器搜索并携带维修卡，验证中途丢下取消撤离、拾回后撤离。关闭飞行步行连接分拣中心、转运场和办公楼，另走排水双桥、控制中心仪表间及观察室。截图和报告写入 `test-results/worksites-release/`。
- `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/path/to/chromium node tests/district-rebuild-browser.mjs dist`。浏览器走完八组对侧常规撤离，并复验同侧锁定及 C2、E3 入口。报告写入 `test-results/district-rebuild/`。
- [3.5C 建筑差异化](../design/MAP_REBUILD.md#35c-建筑差异化验收)继续作为放行依据。
