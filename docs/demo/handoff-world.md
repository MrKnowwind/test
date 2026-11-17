# 首图与地下实验室交接

地图线交付 `createFirstMap(seed)`，入口为 `src/world/firstMap.ts`。使用 `src/contracts/demo.ts` 原接口。实现日期为 2026-11-12，工作目录 `D:/xzh/web3DGametest`，当前无 Git 基线。

## 本线文件

- `src/world/firstMap.ts` 负责三个出生点、三个出口、六个交互点和种子敌人布置。
- `src/world/environment.ts` 负责场景、实体和同源碰撞盒。
- `src/world/worldQueries.ts` 负责分层行走、坡道落点和首个实体射线命中。
- `src/world/surfaceMaterials.ts` 负责本地生成的湿沥青、混凝土和世界 UV。
- `src/world/industrialDetails.ts` 负责折板、灯具、管线、路牌、配电柜及具名拾取模型，重复零件由环境模块实例化。
- `tests/world.test.mjs` 为固定坐标行为测试，`tests/world-browser.mjs` 为真实 Chrome 输入验证。
- `tests/world-evidence/` 保存浏览器报告与截图，报告记录源码 SHA-256、种子、坐标和浏览器版本。

## 世界坐标与默认布置

米制，Y 向上，yaw 为弧度，默认正前方为 -Z。出生和敌人位置为脚底，**交互位置是可见物品或开关的瞄点**。物品放在桌面上，因此交互 Y 高于脚底。出口位置为脚底。

地面主区为 X `[-25,25]`、Z `[-23,24]`、Y `0`。地下为 X `[-10,15]`、Z `[-16,-4]`、Y `-4.2`。北侧公路开口另向 Z `-26.8` 延伸，有实体挡车墩。

| 出生 ID | 脚底 XYZ | yaw | 集成线选择器复现 seed |
| --- | --- | --- | --- |
| south-loading | `[-17,0,19]` | `0.78` | `2` |
| warehouse-alley | `[19,0,10]` | `0.66` | `1` |
| scrap-shelter | `[-17,0,5]` | `0.62` | `5` 或 `20261112` |

出生抽取由 `src/raid/raid.ts` 管理。地图只返回完整候选列表。三个出生位均有掩体，地面初始敌人距离至少 12 米，18 米内敌人的出生直视受实体遮挡。

| 出口 ID | 脚底 XYZ | 半径 | 条件 |
| --- | --- | --- | --- |
| highway | `[-21,0,-19]` | `1.8` | 常开 |
| service-passage | `[22.5,0,-14]` | `1.55` | 携带 `service-card` |
| lab-lift | `[-7.7,-4.2,-6.6]` | `1.55` | 当前局 `lab-power` |

| 交互 ID | 瞄点 XYZ | 内容 | 建议站立脚底 XYZ |
| --- | --- | --- | --- |
| duty-card | `[-10,0.97,-9.99]` | 维修卡 ×1 | `[-10,0,-9.25]`，`[-10,0,-7.65]` 也在 2.7 米交互范围内 |
| yard-ammo | `[-4.5,1.44,-3.06]` | 手枪弹药 ×6 | `[-4.5,0,-2.2]` |
| yard-medkit | `[-15,1.19,9.72]` | 医疗包 ×1 | `[-15,0,8.9]` |
| yard-salvage | `[3.5,1.98,1.96]` | 普通物资 ×1 | `[3.5,0,3]` |
| lab-power-panel | `[-7.22,-2.71,-14.58]` | `lab-power` 开关 | `[-7,-4.2,-14.05]` 或 `[-7,-4.2,-12.7]` |
| lab-research | `[3.3,-2.88,-14.12]` | 高价值样本 ×1 | `[3.3,-4.2,-13.4]`，`[5.5,-4.2,-13.4]` 也在范围内 |

五个战利品模型的 Group 名称与交互 ID 一致。集成线拾取后可隐藏对应 Group。配电柜保留在场景中，旗标与出口是否可用由出击模块维护。

| 敌人 ID | 脚底 XYZ | 类型 |
| --- | --- | --- |
| infected-1 | `[-5,0,8]` | 感染体 |
| infected-2 | `[4,0,-7]` | 感染体 |
| infected-3 | `[7,0,17]` | 感染体 |
| infected-4 | `[6,0,-16]` | 感染体 |
| infected-5 | `[12,-4.2,-12.6]` | 感染体 |
| infected-6 | `[2.8,-4.2,-11]` | 感染体 |
| infected-7 | `[-4,-4.2,-10.2]` | 感染体 |
| lab-security | 三个地下候选中选一个 | 机械安保机 |

机械候选为 `[10.6,-4.2,-13.4]`、`[4.5,-4.2,-5.8]`、`[-7,-4.2,-11.2]`。每局恰好一台，seed `1/2/20261112` 在第一个点，seed `5` 在第二个点，seed `0` 在第三个点。感染体布置固定，所有敌人 yaw 为 `Math.PI`。

## 地面与地下路线

以下 waypoint 为 `(X,Z)`。测试通过 `moveGrounded` 以 0.15 米步长逐点行走，角色半径 `0.36`、身高 `1.8`。

| 起点 | 到常开出口的地面路线 |
| --- | --- |
| south-loading | `(-21,19) → (-21,-19)` |
| warehouse-alley | `(21,10) → (21,-19) → (-21,-19)` |
| scrap-shelter | `(-21,5) → (-21,-19)` |

进入地下前到达 `(12,8.5)`。南侧和废车棚经西侧 `X=-21` 到 `Z=11.2`，沿该横向通道到 `X=12`。仓库外巷直接到 `(12,8.5)`。坡道入口有冷色灯、护墙和“地下实验室 / 货梯需先接通配电”标牌。

坡道范围为 X `[10,14]`、Z `[-4,7]`，向北下行，高度公式为 `Y=(Z-7)*4.2/11`。沿 `X=12` 走到 `Z=-8.4` 可进入地下，反走原路回到 `Z=8.5` 返回地面。护墙阻止地面侧向走入深坑，地下仍可在入口前自由转身。

实验室从 `(12,-8.4)` 经过隔离门 `(5.5,-8.4)` 到 `(5.5,-13.4)`，再到 `(3.3,-13.4)` 取样本。中央隔墙两端可绕行。由样本向西到 `(-7,-14.05)` 操作配电柜，经过 `(-7.7,-12)` 到 `(-7.7,-6.6)` 进入货梯区。未通电时也可沿坡道返回地面。

值班室从西侧 `(-16,-3.8)` 到南门 `(-10,-3.8)`，进门到 `(-10,-9.25)` 拿卡。退出后经 `(-16,-3.8) → (-16,-18) → (21,-18) → (21,-14) → (22.5,-14)` 到维修通道。

## 分层和射线

`moveGrounded` 子步进上限 0.18 米，可沿障碍滑动，检查实体 Y 区间并由坡道计算连续高度。地面上的角色不会被同 XZ 的地下隔墙阻住。坡道外的地下角色被地下边界墙约束。

`blockedDistance` 返回归一化射线在三维实体的首个命中距离。地面楼板厚 0.48 米，能阻止地上地下互射。坡道射线将斜面变换到局部坐标计算，因此向下射击命中实际坡面。主要掩体、墙、柱、桌面、配电柜与角色碰撞共用实体盒。折板起伏、线管、灯具和标牌为表现细节。

## 已执行与待验证

- `node --test tests/world.test.mjs` 已通过 6 项，覆盖三个出生点地面到公路、三个出生点进出地下、条件出口及关键物可达、普通补给可见与可隐藏、跨层实体和射线、种子布置与安全出生。
- `npm test` 已通过全部 28 项，其中地图 6 项。
- `node_modules/.bin/tsc.cmd --noEmit` 已通过。修复了样本圆柱几何被默认参数推断为 BoxGeometry 的类型错误。
- `node node_modules/vite/bin/vite.js build --outDir tests/world-build` 已通过，构建日志见 `tests/world-evidence/build.txt`。输出 JS 628.95 kB，gzip 166.87 kB，存在超过 500 kB 的分包提示。临时构建文件已逐项清理，保留空目录。
- Chrome 真实入口、鼠标锁定、三出生点公路撤离全部通过，全程 HP 100。报告见 `tests/world-evidence/report.json`，包括 seed `2/1/5`、逐段脚底坐标、单次导航和空错误列表。
- 复用集成线 `tests/browser-raid.mjs` 的 service、lab 场景均通过。维修卡条件拒绝、拾卡后维修撤离、刷新后卡入库均通过。实验室实际下坡、感染体与机械机战斗、样本拾取、未通电拒绝、配电后货梯撤离和刷新后样本入库均通过。报告见 `tests/world-evidence/integration/report.json`，该轮最终仓库为维修卡 ×1、研究样本 ×1。
- 地图固定机位已检查装卸棚、坡道、实验室、货梯和配电柜，修正了坡道横梁与标牌、货梯灯具与文字的遮挡。截图见 `tests/world-evidence/environment-*.png`，机位和渲染计数见 `preview-report.json`。Windows、Chrome `157.0.8103.51`、Radeon RX 5700 XT、1120×630，纯环境固定视角为 32–74 calls、8936–9646 三角面，这些计数不含敌人和第一人称模型。

首轮临时浏览器路径脚本超时，随后观测到同期开发服务发生多次页面热重载。正式复测使用 `hmr:false` 服务并记录页面导航次数。当前正式脚本要求每条路线仅发生初始导航。

复用集成脚本的首轮在开发服务上遇到两条 module script 导致选择器严格模式报错。后续仅在运行时把入口资产选择器改为 `.last()`，同时改为 headless 和地图证据输出目录，正常完成流程。集成脚本源文件归原线维护。

`tests/world-evidence/integration/*-failure.png` 保留首轮脚本选择器失败的历史现场，最终验收结果为同目录 `report.json` 的两项通过。

## 复现与集成下一步

建议技能为 karpathy-guidelines、tdd，浏览器验证失败时用 diagnose。启动与依赖由集成线提供，本线使用本地 Three.js `0.187.0`、Vite `8.3.8`、Playwright `1.65.0`，无联网素材。

```powershell
node --test tests/world.test.mjs
node --input-type=module -e "import {createServer} from 'vite'; const server=await createServer({server:{host:'127.0.0.1',port:5182,strictPort:true,hmr:false}});await server.listen();server.printUrls();"
```

另开终端执行 `node tests/world-browser.mjs http://127.0.0.1:5182/`。只复拍固定机位可加 `--preview`，输出独立 `preview-report.json`，保留公路路线报告。人工入口可带 `?qa=1&seed=2`、`seed=1` 或 `seed=5`。

本轮 service、lab 的精确复现命令如下，读取集成线脚本并只在内存中调整开发服务选择器和证据路径。

```powershell
$worldBrowser = Get-Content -Raw tests/browser-raid.mjs
$worldBrowser = $worldBrowser.Replace("const directory = 'test-results/browser-raid';", "const directory = 'tests/world-evidence/integration';")
$worldBrowser = $worldBrowser.Replace("channel: 'chrome', args:", "channel: 'chrome', headless: true, args:")
$worldBrowser = $worldBrowser.Replace("report.entryAsset = await page.locator('script[type=""module""]').getAttribute('src');", "report.entryAsset = await page.locator('script[type=""module""]').last().getAttribute('src');")
$worldBrowser | node --input-type=module - http://127.0.0.1:5182/ service lab
```

下一步由集成线完成统一生产版本的整局回归、长时性能采样和体验调参。环境首版采用程序化工业构件和本地纹理，湿地反射由粗糙度与灯光高光形成，视觉精度及帧时间仍需最终整局设备验收。跳跃、可破坏场景、动态升降平台未进入首图共享契约。当前货梯作为具备供电条件的撤离区实现。
