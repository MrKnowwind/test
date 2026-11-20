# 当前状态

## 2026-11-20 科幻盐港首轮场景改造

基线 `4d5b9ee` 已归档。分支 `art/cel-port` 重制材质和天空、货运导轨与停靠车、街区站房、街道种植池、研究扫描门、能源地标和八处补给棚，地面与战术图共用道路矩形。玩法仍按原地图坐标运行。

`npm test` 52/52；`npm run build -- --base=./` 通过。新增门洞可见几何与碰撞一致性、全部搜索箱支撑面回归。生产包在 Chromium 中启动并进入出击，种子 42 查看出生点、码头、厂区、救护站、研究入口和坡道。部分旧仓棚、车辆、角色沿用原几何，尚待逐区完整人工试玩和美术验收。


## 地区补给与高台路线

2026-11-18 新增 8 个沿路补给据点。`src/world/supplySites.ts` 同时提供场景配置、容器和战术图标记，37 个容器中有 24 个来自本轮。医疗、弹药、维修和研究据点有独立名称，两处高风险研究据点有感染体守卫。各据点设有低墙、工作台、货架、托盘和攀爬平台，平台高 3.2 至 6.4 米。布局参考 [三角洲行动官方地图工具](https://www.playdeltaforce.com/act/mapswiki/?lang=en) 的资源分类，以及 [ARC Raiders 的 Bird City](https://arcraiders.com/es/news/headwinds-content-update) 用高处战利品引导探索的做法。

`npm test` 50 项通过，覆盖原撤离通路及每处新增据点的地面箱、攀爬净空、高台通路和储备箱视线。`npm run build -- --base=./` 通过，保留原分包大小提示。Chrome 使用种子 42，以 QA 定位到南侧救护站首个攀爬边缘，通过实际 Space 和 WASD 两次攀登到 3.2 米平台，按 E 打开高台容器。实拍和报告位于 `test-results/supply-pass/`。其余据点已做坐标回归，尚待逐点人工试玩和风险收益调参。

GitHub Pages 使用 `.github/workflows/deploy.yml`，每次推送 `main` 后安装依赖、跑测试并发布相对路径构建。线上入口为 [盐港隔离区](https://mrknowwind.github.io/test/)。

## 2026-11-17 Git 工程基线

本轮按用户要求先提交推送现有工程到 `origin/main`。提交包含当前源码、测试、项目文档和已有资产资料，`references/` 为本地只读参考归档，加入忽略规则。运行内容仍采用程序生成。

当前增量包含 `src/contracts/demo.ts` 的可选三维移动/地面/攀爬查询、`src/world/worldQueries.ts` 的空中碰撞与边缘落点检查、`src/player/{input,controller}.ts` 的 Space 跳跃和空中二次 Space 攀爬，以及 `tests/traversal.test.mjs`。已执行 `npm test`，49/49 通过；`npm run build` 通过，产物 `index-D7DHpX5q.js`，保留原分包大小提示。

跳跃/攀爬目前仅自动行为测试与构建通过，尚未完成本轮浏览器操作和画面验收。用户要求的资源点重排、地区密度/高低差增强和 Git 自动部署仍待继续。前期地图研究与设想未记作实现完成。以下为历史制作与证据基线。

更新于2026-11-13（Asia/Shanghai）。用户最新明确反馈人物、手部、场景物品与空间设计仍粗糙，未认可前轮P0–P5的视觉效果。当前优先级是按原作源码重审近景模型与空间质量，不能继续以地图面积、面数或功能测试代替美术验收。

## 最新任务：原作源码核查

已拉取 `references/saltline-upstream/`，提交 `09c51774cd77aad750bd2d6c42af2b1020cb668d`，原镜像未修改；本地原版 `http://127.0.0.1:8731/`。注意旧 `saltline-lite` 为本地历史复刻，并非本次原作源码。已审查并实拍原作敌人、手部、武器与叉车，核对几何结构、材料组与路线，详见 [源码核查](../art/SALTLINE_SOURCE_STUDY.md)。

核心事实：当前手枪双手约6.5万三角、感染体约6.3万；原作枪械双手约5.3万、机械猎犬约1.7万。造型不同不能等价排名，但当前差距主要是形体/接合/中层分件与材料尺度，继续加细分不能解决。下一项先逐件制作近景样板，再推进区域密度；暂不继续拉开地图。

本轮只新增参考、诊断与文档，生产源码未改，以下仍为前轮功能基线。原作实拍JS错误0、内容文件请求0；保留着色器警告与字体回退说明，未做包体/生成耗时/内存专项。

## 当前基线

- 工作目录 `D:/xzh/web3DGametest`，试玩 `http://127.0.0.1:4173/`。`npm run dev` 开发，`npm run preview -- --port 4173` 生产服务，当前服务可访问。
- 当前生产包 `dist/assets/index-D1-1L5N5.js`，SHA-256 `4FDEA73549C1433895432823CDE1875E4623DBEDCD80F2F694FFD1FEF52CABFD`。Three.js 0.187.0 / Vite 8.3.8 / TypeScript 6.0.3 / Chrome 157.0.8103.51。
- 尚无 Git 基线。`references/saltline-lite/` 本轮未修改。历史AI图源/派生文件保留在 `assets/`，已无运行加载与打包引用；未删除用户资料。

## 本轮任务与改动

| 范围 | 已落地及写入位置 |
|---|---|
| P0 程序材质 | `src/presentation/finishes.ts`、`infectedModel.ts`：织物/金属/皮肤/皮革/聚合物等 DataTexture；原几何、UV与枪械挂点保留。见 [程序内容增量](../art/PROCEDURAL_PASS.md) |
| P1 地区路线 | `src/world/layout.ts`、`firstMap.ts`、`worldQueries.ts`、`environment.ts`、`src/ui/tacticalMap.ts`、`src/app/sky.ts`/`main.ts`：边界400×400m，地区移位但建筑不缩放，道路/坡道/出生/出口同步。见 [地区坐标与路线](../demo/DISTRICT_PASS.md) |
| P2 样板与远景 | `src/world/districtDetails.ts` 与环境入口：转运仓、货架/托盘/包装、维修棚/工具/柜体/软管/管桥/排水；海岸、货轮、远港吊机、连续地形；路障与不可见越界碰撞取代围墙环 |
| P3 逐件搜索 | `src/raid/containerSearch.ts`、`backpack.ts`、`raid.ts`、`src/ui/backpackView.ts`/`game.css`、`src/app/main.ts`：未知占格、逐件圈式揭示、程序图标、提前拿取、旋转/拖放/适配预览、续搜与远离暂停、满包保留。见 [搜索规则](../demo/SEARCH_PASS.md) |
| P4 敌人与动作 | `infectedModel.ts`：眼部、肩部、衣料/皮肤分工、裤腰胯部、鞋面鞋底；随位移步态、接地与预警/攻击连续姿态。保留手枪/换弹挂点；没有实现真正下颌/口腔动画 |
| P5 分区与声音 | 环境模块复用至六处厂区/研究/后勤设施，新增三个功能容器、4个地区感染体、地下柜/服务管线；土砾/道路/作业面与枯草分层。`src/app/audio.ts` 接入合成脚步/预警/搜索/拾取与环境层 |
| 验收入口 | 新增 `tests/{finishes,search}.test.mjs`，更新 art/world/raid 测试；浏览器入口为 `tests/next-pass.mjs`，由 `npm run qa` 调用四段串行检查。旧 browser-v2 坐标/13图片断言不再适用 |

初始仍只有手枪6+6和刀，1/2空主槽、3手枪、4近战。卡片持续条件、同帧死亡优先、撤离才入仓、runId去重与变卖持久化保留。

## 验证与证据

- `npm test`：**46/46通过**。含未知不可转移、确定性内容、逐件续搜、放置失败保留、ADS/换弹接触、攻击过渡与接地、所有出生点/对向路线、关键物资/坡道/出口、战斗遮挡、撤离/死亡/入仓/变卖保证。
- `npm run build`：类型检查和生产构建通过。保留原主JS分包提示；没有为此安排包体、生成耗时或内存专项。
- `npm run qa`：包 `index-Bz_g_Dun.js` 四段生产Chrome回归全部通过，四份报告无错误。随后仅修正战术图区域标题越界/地下标签重叠，当前包 `index-D1-1L5N5.js` 构建通过并以 [地图专项报告](../../test-results/next-pass-world/map-capture.json) 补拍审查通过；未无故重跑整局。游戏规则、地图物件与搜索行为没有发生后续改变。
- [世界报告](../../test-results/next-pass-world/report.json)：南出生用真实W/Shift走完公路撤离，新坡道实际走下；固定地区/样板/室内/边界/地图截图。[转运仓](../../test-results/next-pass-world/06-transfer.png)、[研究后勤](../../test-results/next-pass-world/11-research-wing.png)。
- [搜索报告](../../test-results/search-p3/report.json)：未知→逐件揭示→先取卡片→手动放格→关闭续搜/距离暂停→卡片撤离入仓/出售重载→R旋转研究样本拖入指定格→满包保留。[揭示实拍](../../test-results/search-p3/02-first-revealed.png)。
- [美术报告](../../test-results/next-pass-art/report.json)：腰射、ADS、实际换弹、刀、实际生成敌人预警/攻击及正侧面、地下照明；页面错误0，内容图片请求0。近景固定机位先暂停再摆观察位置，没有注入替代预览角色。[敌人](../../test-results/next-pass-art/06-enemy-front.png)。
- [整局报告](../../test-results/next-pass-flow/report.json)：`index-Bz_g_Dun.js` 已通过东/码头全程真实步行撤离、配电前拒绝/实际开关后货梯撤离、倒计时中用背包丢卡取消。
- 三个出生点到公路的平移全部为真实键盘；QA pose只就地转向。关键交互/实验室/固定画面使用QA摆初始机位后真实输入，不冒充全部自由探索。程序声音触发/无运行错误已检查，主观混音未验收。

## 限制与下一具体动作

- 首轮实现完成不等于视觉质量达标。400m地图仍有较多空地，建筑模块重复、船/远景与地表材质较简单；战术图已修正标题越界与地下标签重叠。感染体脸部仍有面具感，衣物片、手脚和躯干统一拓扑需继续精修。
- 尚未实现真实口腔/下颌蒙皮或逐指动作，不记录为表情完成。没有本轮持续高负载战斗/其他设备性能结论；包体、资源生成耗时和内存专项继续按用户要求暂缓，不能复用旧FPS作为新成绩。
- 下一具体动作：按[源码核查](../art/SALTLINE_SOURCE_STUDY.md)先做一套手部、一个敌人、一组道具的轮廓/接合/分件近景验收，再修区域密度与掩体节奏；不重做P0迁移或增加其他枪械。
