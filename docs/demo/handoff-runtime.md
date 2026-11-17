# 运行与出击集成

> 本文记录 2026-11-12 首版历史基线。当前按键、地图、背包和美术以 [第二版](V2.md)、[当前状态](../memory/STATUS.md) 和 [外观修订](../art/VISUAL_REFINEMENT.md) 为准，勿按下面历史 1/2 切刀枪的说明修改新实现。

2026-11-12（Asia/Shanghai），首图整局已接通并完成本机生产预览验证。当前为共享工作目录基线，尚无 Git 提交。验收对应生产入口 `dist/assets/index-Bz8L-Ltx.js`，CSS 为 `index-CE4Gelo2.css`。

任务为按 [首图规格](FIRST_MAP.md) 集成真实画布、键鼠移动、种子出生、刀枪、拾取、三种撤离、失败重开和本地仓库。地图、战斗和美术由各自会话提供，集成使用其标准导出。地图坐标和路线见 [地图交接](handoff-world.md)，武器与敌人行为见 [战斗交接](handoff-combat.md)。

## 启动与操作

工作目录为 `D:/xzh/web3DGametest`。依赖从本机 npm 缓存离线安装，版本为 Three.js `0.187.0`、Vite `8.3.8`、TypeScript `6.0.3`、Playwright `1.65.0`、Node `v24.6.0`。

```powershell
npm ci --offline --ignore-scripts --no-audit --no-fund
npm run dev
```

生产验证使用以下命令。当前生产预览服务在 `http://127.0.0.1:4173/`。

```powershell
npm run build
npm run preview -- --port 4173 --strictPort
```

点击“开始出击”锁定鼠标。WASD 移动，Shift 奔跑，鼠标转向，左键攻击，右键按住举枪，R 换弹，1/2 切刀和手枪，E 拾取、开启配电或启动撤离。Esc 暂停并释放鼠标，可继续或放弃。当局放弃与刷新都会丢失未入库物品。

不带种子时每局使用浏览器随机数。`?seed=2` 复现南侧卸货口，`?seed=1` 复现仓库外巷，`?seed=5` 复现废车棚。加 `&qa=1` 后可读取 `window.raidQA.state()`，返回克隆的观测快照。自动整局脚本通过正常按钮、真实鼠标移动和键盘输入执行。

## 本线改动

| 路径 | 内容 |
| --- | --- |
| `package.json`、`package-lock.json`、`tsconfig.json`、`index.html` | 根 Vite 工程、离线锁定依赖、构建与测试入口 |
| `src/app/main.ts` | 世界装配、60 Hz 固定步、标准模块集成、场景资源释放、暂停与结果、只读测试快照 |
| `src/player/input.ts`、`controller.ts` | 鼠标锁定、失焦清输入、第一人称移动、分层碰撞、视线受阻的近距交互、ADS 相机 |
| `src/raid/raid.ts` | 等权种子出生、单次拾取、携带栏、当局配电、撤离条件、5 秒停留、离区取消、死亡优先、放弃 |
| `src/raid/warehouse.ts` | 本地持久化、按 runId 的单条原子保存、重复提交去重、保存失败重试 |
| `src/ui/gameView.ts`、`game.css` | 开始/暂停/结果页、生命弹药、拾取与命中反馈、条件提示、携带物与仓库 |
| `tests/raid.test.mjs`、`tests/browser-raid.mjs` | 出击行为与仓库测试、四条 Chrome 整局验收 |

拾取弹药即加入备弹，医疗包即恢复 40 HP。普通物资、维修卡和研究样本保存在当局携带栏，成功撤离后入库。维修卡撤离不扣卡。配电在新局重置。仓库存储采用 `wasteland-raid.warehouse.v1:<runId>`，每局独立一条 localStorage 记录，避免不同局在多个标签页同时保存时覆盖总量。保存失败时结果页显示“重试入库”，成功前保留本局结果。

## 已执行验证与证据

`npm test` 通过当前全部 **28 项**，包括美术 5 项、战斗 12 项、出击 5 项、地图 6 项。出击覆盖固定种子、离区取消、卡与配电条件、死亡同帧优先、放弃损失、保存失败重试、重复入库和重新读取。

`npm run build` 通过 TypeScript 检查和 Vite 生产构建。JS 约 628.95 kB，gzip 约 166.87 kB，Vite 提示主包超过 500 kB。

`npm run qa` 在 Chrome `157.0.8103.51`、1024×576、生产预览 `4173` 上通过四条路径。每条路径均断言页面错误、控制台 error、失败请求和 HTTP 4xx/5xx 列表为空。完整数据见 [浏览器报告](../../test-results/browser-raid/report.json)。

| 路径 | 实际结果 | 截图 |
| --- | --- | --- |
| seed 5 公路 | 废车棚出生，走到公路启动撤离，离区取消，Esc 暂停后继续，再完成全程 5 秒撤离 | [出生](../../test-results/browser-raid/road-spawn.png)、[结果](../../test-results/browser-raid/road-result.png) |
| seed 1 维修通道 | 未带卡时拒绝，走到值班室拾卡，再撤离。刷新后维修卡仍为 1 | [条件拒绝](../../test-results/browser-raid/service-locked.png)、[入库](../../test-results/browser-raid/service-result.png) |
| seed 1 实验室 | 实际走坡道下到 Y=-4.2，用枪击倒入口感染体和安保机，换弹后清除另外两只地下感染体，取得研究样本。未通电货梯拒绝，开柜后撤离，刷新后样本为 1、卡为 1，配电已清空 | [地下遭遇](../../test-results/browser-raid/lab-entrance.png)、[样本入库](../../test-results/browser-raid/lab-result.png) |
| seed 2 失败与重开 | 南侧出生，右键 ADS、开枪和换弹，拾维修卡，用刀命中感染体后等待其击杀。死亡携带栏清空，既有卡和样本各 1 保留。重开恢复 100 HP、手枪 6+6，再放弃并保留仓库 | [ADS](../../test-results/browser-raid/failure-ads.png)、[刀命中](../../test-results/browser-raid/failure-knife.png)、[死亡结果](../../test-results/browser-raid/failure-result.png) |

已打开并审查实际出生、ADS、挥刀、地下遭遇和撤离结果截图。Chrome 自动输入测试与截图审查已完成，自由人工试玩尚未记录。

地面废车棚固定机位记录 30 帧，中位 **16.7 ms**、P95 **16.9 ms**、98 draw calls、27,494 三角形。WebGL 渲染器为 AMD Radeon RX 5700 XT / ANGLE D3D11。这是本机短时固定机位采样，地下与持续战斗的长时性能仍待采样。

## 待验证与下一步

初版战斗压力尚待人工调参。地下路线已实测可带样本撤离，入口停留、换弹和清敌次序会影响生存。敌人转角追击、低配置设备、长时运行和多画幅完整整局继续按 M3 验证。程序化首版美术的观感由各美术/地图交接继续说明。

下一步用固定种子记录人工路线的弹药、耗时和受伤，调节地下风险收益，并建立首个 Git 基线以固定当前可复现版本。
