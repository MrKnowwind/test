# 感染体外观修订

更新于 2026-11-13（Asia/Shanghai）。本次任务是在既有感染体骨骼、攻击事件和命中数据不变的条件下，改善人体轮廓、面部与工装外观。遵循 `karpathy-guidelines`，仅修改感染体模型及其几何构造；共享材质和 AI 资产由集成负责人提供。

## 已实现

- `src/presentation/infectedGeometry.ts` 构造一体化头部曲面。颅顶使用椭圆帽，下颌、颧骨、眉骨、眼窝和鼻梁来自同一网格的连续轮廓。移除原先额外拼接的球状五官和脸侧肿块。
- `src/presentation/infectedModel.ts` 将生成的脸部色彩纹理投射到真实头部网格上。投影依据头部局部坐标，将眼、鼻、嘴的纹理位置分别对齐到几何位置；前侧材质逐渐过渡到通用皮肤，后脑不重复出现五官。光照仍由实际头部法线与游戏灯光计算。
- 身体保持原有骨骼蒙皮，肩、领、袖口补齐封口；头部与领口交接收紧。缩小病灶、前胸外露组织和指段，移除圆条状外露肋骨。增加有真实撕裂边缘的口袋、破损袖片及工装破口。
- 工装使用 15 cm 材质块的物理尺度：各 loft 以最大截面周长除以 `.15` 设置 U 重复，V 为高度除以 `.15`。皮肤使用独立尺度，避免将身体织纹铺成粗绳状条带。
- 保留 `infected-strike-hand` 挂点、预警和攻击动作、调用方控制的根坐标、脚底接地及倒地接口。敌人逻辑与数值未改变。

## 资产与实现边界

身体、头部与破损布料的可编辑来源均为上述 TypeScript 文件。通用材质由 `applyFinish` 接入；面部使用 `assets/materials/infected-face-color-v1.webp`，原始生成图位于 `assets/source/infected-face-v1.png`，均由主会话通过内置图像生成工具制作。本子任务没有联网搜索或下载第三方模型。

面部图是带少量鼻翼明暗的**近似 albedo**，并非经过摄影去光照的扫描资产。投影仅用于色彩，通用皮肤法线提供微表面变化；当前法线没有经过高模雕刻与烘焙。头部仍为程序化中等面数曲面，不宣称达到 3A 角色资产精度。

面部表情目前为静态。原有 jaw 骨骼及动作赋值保留，但新头部没有独立下颌蒙皮、口腔或表情 blend shape，不能将其记作已完成的张嘴动画。衣服与身体仍为分区蒙皮，肩部接缝和极近距离手部、鞋子、服装褶皱仍需进一步资产制作。

## 已执行验证

本地验收基线：`infectedModel.ts` SHA-256 前 12 位 `33AE983DEDA7`，`infectedGeometry.ts` 为 `5D9139232ECA`，脸部 WebP 为 `0F5D245213FA`。此时尚无 Git 提交基线。

- `node --test tests/art.test.mjs`：5 项通过，涵盖第一人称 ADS、换弹接触，以及感染体预警、根变换、倒地接地和机械状态。它们验证已有行为没有因资产修改而退化，不代替视觉验收。
- `npx tsc --noEmit`：全项目类型检查通过。
- `node test-results/infected-refine/capture.mjs`：本地 Vite `5199`、Chrome、1280×960，中性半球光与两盏方向光。等待 `window.artMaterialsReady` 后截图，页面、shader 编译、控制台和资源错误均为空。记录在 `test-results/infected-refine/metrics-final.json`。此夹具的 draw calls / triangles 仅描述独立资产视角，不是整局性能数据。
- 已实际查看最终的正脸、斜侧脸、侧面、全身、预警和倒地图，迭代修正了首轮中的尖顶/环截面台阶、凸起黑眼嘴、浮动肩球和过大的织纹。

最终证据：

| 证据 | 本地路径 |
| --- | --- |
| 原有整身基线 | `test-results/v2-art/07-enemies-idle.jpg` |
| 当前独立夹具 | `test-results/infected-refine/21-fixture-final.png` |
| 当前全身 | `test-results/infected-refine/22-body-final.png` |
| 正脸 | `test-results/infected-refine/23-face-final.png` |
| 斜侧脸 | `test-results/infected-refine/24-face-side-final.png` |
| 接近侧面 | `test-results/infected-refine/25-face-profile-final.png` |
| 攻击预警 | `test-results/infected-refine/26-windup-final.png` |
| 倒地 | `test-results/infected-refine/27-dead-final.png` |

## 待验证与下一步

生产构建、地图实际照明下的近战敌人、同屏多敌人的帧时间和完整出击流程由主会话集成验收。进一步提高角色精度应补充统一身体拓扑、衣物折痕与接缝、骨骼权重、独立眼球及下颌/表情，再做对应的法线与材质烘焙。此项是后续资产工作，尚未完成。
