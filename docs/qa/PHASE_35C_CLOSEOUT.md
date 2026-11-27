# 盐港 · 3.5C 地图验收

基线 `d9e37d0`。按[立体地形蓝图 V2](../design/MAP_REBUILD_35A.md)核对 25 个地面及船上地块与 B1 的实装用途、实际可走楼层和搜索位置。布局和高程以各轮实装的道路衔接与场地为准。

| 地块 | 实装用途及路线 |
| --- | --- |
| W1 | 167×44m 外海邮轮。两座连桥上船，船舱、上甲板、顶层甲板通过三座楼梯相连。 |
| W2–W4 | 候船厅有服务、候车和行李整理空间。堆场有四种可进入的货箱。维修工棚有开敞工位与独立配件架。 |
| W5 | 调度室首层有接待通道和独立器材间。室内楼梯接二层登记工位，西侧玻璃窗朝海。 |
| C1–C5 | 普货仓的装卸道与夹层、冷链库前室与冷藏舱、分拣中心输送线与桥式夹层、物流办公楼上下层、车辆转运场分别实装。维修卡在 C4 二层。 |
| E1–E4 | 维修厂有工位与夹层。水处理站有检修平台、过滤院和跨渠双桥。备件配电仓与两层工业控制中心各有设备区和搜索路线。 |
| N1–N2 | 海关登记大厅连通独立查验办公室。隔离观察设施有接收区、观察室、医用区及连接 N4 的高架步道。 |
| N3、B1 | 科研主楼的登记层与研究办公层各有搜索点。地下实验室比园区低 5.4m，独立坡口接入实验室、低温保存、配电和货梯。 |
| N4 | 档案中心首层有档案整理、阅览和机房。西侧档案楼有独立索引复核室和规划图纸室，二层世界 Y=11.3m，室内楼梯双向通行。 |
| N5 | 观测站首层有记录终端。室内楼梯到世界 Y=11.4m 的观测平台，西侧和南侧开真实采光窗。 |
| S1–S3 | 港务联排三户分别按客厅、家庭厨房和工作室布置，三户一、二层各可搜索。生活商街分别设置便利、五金和餐饮用途。全图仅一座极光药局，有冷藏和诊疗隔间。 |
| S4–S7 | 社区中心有救护和活动区。海员旅馆两层有不同客房。交通站连通候车区、安置行李区和餐饮广场。停车场有收费亭和充电区。 |

43 个旧地块的重构另见[街屋验收](PHASE_35C_STREETS.md)。其中 34 栋为独立功能布局的多房间建筑，9 处为开放场地。此前已在五个分区实走代表建筑。本轮复验每栋新街屋的实体房间、进出路线和两处搜索点。

主道路维持直线，坡道、台地和楼梯提供地表与楼层高差。潮沟步道世界 Y=−1.6m、东北山脊世界 Y=20.9m，步行高差为 22.5m。南北各四个出生点按对侧开启唯一常规出口。同侧锁定、维修卡检查和 B1 货梯有各自回归。八组完整撤离的浏览器复现见[工作区验收和坡缘续测](PHASE_35C_WORKSITES.md#南部道路坡缘复验)。

## 本轮复现

- 24 项定向地图测试通过，覆盖八组对侧撤离、海岸和地形接缝、船舶、旧街屋差异化、三户联排、档案中心和港务及观测楼层。命令为 `node --test --test-name-pattern 'archive|north civic|landside|search locations|southern terraces|eight safe spawns|playable coastline|open container|third deck|offshore vessel|freight mezzanines|every search case|district plan|new street|former street|industrial workspaces|logistics buildings|market stores|main research|seafarers inn|cold chain|ramp seams|underground openings' tests/world.test.mjs tests/harbor.test.mjs`。
- `node docs/design/map-rebuild/blueprint.mjs` 校验蓝图几何与连通性。`npm run build -- --base=./` 构建 Pages 生产包。全量测试由 GitHub Actions 执行。
- `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/path/to/chromium node tests/field-pass-browser.mjs dist test-results/closeout-35c annex,civic`。关闭飞行，在生产包完成 13 处搜索并复核上下楼、窗景及楼层显示。报告 `report-annex-civic.json` 和截图写入 `test-results/closeout-35c/`，无页面错误。

3.5D 接续地图拖动缩放、主动楼层切换和标记，以及配发方案选择与专属格子描边。
