# 盐港 · 室内陈设、装备排布与搜刮物品

基线 `14a7298`。仓库和局内使用同一套方形槽位。头部、护甲、背包在人物右侧，两个主武器槽和副武器、近战槽在人物下方。窄窗搜刮时，武器组压成一排。槽内只渲染图标，点击检视和拖放依然由各自的库存操作接管。

街屋的档案、配餐、工装、洗衣和检修区增加与用途匹配的柜内陈设和台面物件。旅馆新增茶水台、通铺换鞋凳及客房衣柜。物流办公楼增加交接台用品和收纳，科研档案中心补上文件柜和图纸卷。几何检查确认商铺雨棚、分拣厅顶板、档案中心低翼屋顶、邮轮楼梯栏杆转角及街屋坡屋顶出现过共面。雨棚移到外壁，分拣厅顶板合并，屋顶与隔墙错边，栏杆共用立柱，坡屋顶由连续几何生成。

## 北部海关检查厅地板

基线 `7cadbb5`。在西北港区入口出生后进入海关大厅，面朝西南 224° 可见绿色通道与混凝土地面争抢同一深度。旧版射线在通道内同时命中两张 Y=8.028m 顶面。混凝土网格裁出通道轮廓，绿色材质嵌入该轮廓。东口支路从原来深入室内 6m 收到门槛。

`node --test --test-name-pattern 'customs hall floor' tests/civic.test.mjs` 覆盖大厅、通道四边和东口的 110 个室内采样点及 1 个室外路面采样点。生产构建后执行 `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/path/to/chromium node tests/field-pass-browser.mjs dist test-results/customs-floor customs-floor`，对比西南 224° 等四个固定机位，走过入口和通道、搜查旅客检验柜并回到路面。

## 全图可步行表面排查

基线 `7204446`。扫描完整生成场景，包括 34 栋街屋、专用建筑、邮轮三层和地下实验室。以实际地面碰撞为参照，从约 8.6 万个朝上的候选三角面中查找投影有面积交集、相互距离小于约 3 毫米且没有被更高面遮挡的位置。此范围针对可步行地面、铺装及坡度相近的接缝。

| 位置 | 实际改动 |
| --- | --- |
| 港务家属区联排住宅 | 客厅地毯有独立厚度，毯面与木地板相距 24 毫米。 |
| 科研档案中心首层 | 道路与标线围绕建筑占地裁边，南墙内侧只露出室内地面。 |
| 物流分拣中心及四座旧货仓 | 分拣夹层柱顶停在板底，四座旧货仓的侧廊接到横廊边缘，消除交叉踏板。 |
| 生活商街与北部高地 | 广场步道分别裁边，海关及气象站支路与路肩接边。北部挡土墙压顶降至台地以下。 |
| 码头与工业排水渠 | 登船落脚区嵌入码头步道，压低岸边装饰块并收齐低码头墙顶。排水桥面占地从陆地面裁掉，渠壁止于桥面下。 |

复扫在上述判定范围内无残余命中。地面接缝回归以 `node --test --test-name-pattern 'audited floor' tests/world.test.mjs` 检查已定位的楼板、入口和铺装。生产构建后使用 `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/path/to/chromium node tests/field-pass-browser.mjs dist test-results/floor-finishes floor-finishes` 复拍七处视角及微移，再实走夹层转角、双排水桥和邮轮连桥。

## 搜刮分布

共 98 个物品定义，其中新增的 55 种均可经容器随机获得。普通、军用、精良、稀有、珍贵、机密六档使用各自的搜索耗时和物品描边。容器显示允许出现的类型，已揭示物品的检视显示类型和品质。普通容器、分区容器和高风险设施使用不同品质权重。每次抽取相互独立，物品允许重复。

| 容器例子 | 类型 |
| --- | --- |
| 旅馆登记台、客房储物柜 | 文件档案、生活用品，部分客房有餐饮补给 |
| 食铺、船舶配餐区 | 餐饮补给 |
| 药局冷藏柜、医务柜 | 医疗物资 |
| 五金铺工具箱、配电工位 | 工业零件、电子元件 |
| 港务调度器材间 | 航海仪器、电子元件 |
| B1 样品保存柜 | 科研样品、电子元件，另有防护装备的独立抽取 |

全图 203 个搜刮容器以 256 个固定种子抽样，命中全部 55 种新物品及六档品质。保底维修卡、急救包和弹药继续在对应容器的队首。新物品可与原存档物资共存，撤离入库后可用于整备或变卖。

## 复现

- `node --test tests/carrying.test.mjs tests/search.test.mjs tests/raid.test.mjs`，检查掉落标签、独立抽取、搜刮转移和新旧物资入库。
- `node --test --test-name-pattern 'junctions|seafarers inn|logistics buildings|archive second floor|new street|eight safe spawns|every search case|market stores|third deck|harbor' tests/world.test.mjs tests/harbor.test.mjs`，检查已定位的五处重叠、房间通行净空、搜索支撑及八组撤离。
- `npm run build -- --base=./` 构建 Pages 生产包。`PLAYWRIGHT_CHROMIUM_EXECUTABLE=/path/to/chromium node tests/field-pass-browser.mjs dist test-results/loot-and-furnishings loadout,interiors` 复现仓库和局内的装备排布、三个窗口宽度、收纳和再装备、旅馆与办公楼陈设、档案中心上下层、B1 机密级掉落检视和拾入。浏览器报告和截图写入测试结果目录。
