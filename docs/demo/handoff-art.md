# 角色与武器美术交付

2026-11-12，首图契约版本为同日的 src/contracts/demo.ts。本线交付已被 src/app/main.ts 的正常游戏入口接入。验收时的本线源文件、测试入口与共享契约散列见 [source-sha256.json](../../assets/art-qa/source-sha256.json)，用于在共享目录继续制作后识别对应基线。

## 实际导出与接入

| 文件 | 导出与职责 |
| --- | --- |
| src/presentation/viewmodel.ts | createViewmodel() 返回 group、muzzle、update(dt, weapon, moving) |
| src/presentation/enemyVisuals.ts | createEnemyVisual(kind) 返回 group、update(dt, enemy) |
| src/presentation/viewmodelModels.ts | 双手、前臂、小刀、手枪和分件挂点 |
| src/presentation/infectedModel.ts | 16 根骨骼、连续蒙皮身体与四肢、感染组织、工装、动作和倒地 |
| src/presentation/securityModel.ts | 四足安保机、关节连杆、炮架、展开护盾、传感器与失效姿态 |
| src/presentation/modelParts.ts | 材质、确定性纹理生成、几何与刚性分件合批 |

group 挂在相机下，调用 update 时传入契约的秒制 dt 和完整 WeaponState。集成入口已采用单独的第一人称渲染层，在世界渲染后清深度绘制。相机 near 建议采用当前入口的 0.035 m。

muzzle 为真实 THREE.Object3D。调用 muzzle.getWorldPosition(target) 得到随相机、ADS、后坐与换弹运动的世界坐标，出射方向沿局部 -Z。枪口位置挂点为手枪局部 [0, 0, -0.188]。即便刀处于显示状态，枪口也保留在可查询的隐藏枪械组下，战斗模块按武器 ID 选择其用途。

敌人 group 根节点表示脚底，yaw=0 面向 -Z。调用方设置 group.position 与 group.rotation.y，再 update。本线只改变组内骨骼和零件。活体脚底按足底挂点落地，尸体按蒙皮后的几何包围盒落地，测试覆盖平移与旋转后的地下出生点。

## 资产与动作

资产均为本地原创程序几何和确定性纹理，没有外部模型或图片依赖。可编辑源与运行生成逻辑位于上表的 TypeScript 文件，运行时直接返回 Three.js 对象。材质采用 MeshStandardMaterial，区分枪钢、磨损钢、塑料、橡胶、织物、皮革与有机组织。布纹、金属细痕、皮肤斑驳由 128×128 DataTexture 生成。

| 稳定资产 ID | 结构与可观察动作 |
| --- | --- |
| first-person-viewmodel | 有袖口、腕部、掌指与护腕的双臂。前臂每帧连接当前手腕挂点 |
| pistol | 枪身、后倾握把、扳机护圈、滑套与抛壳窗、弹匣、独立机瞄、枪口 |
| knife | 有厚度和刃线的小刀、护手、缠带握柄，右手环握，左手戒备 |
| infected | 不对称感染上臂、肩部增生与工装残片，呼吸、行走、抬臂前摇、前扑、恢复、受击抽动与侧倒 |
| security-bot | 四足、外露关节与液压杆、装甲炮架，扫描、下压展开护盾锁定、炮管后坐火光、收拢恢复与失效塌落 |

除 muzzle 外，可用 group.getObjectByName 取得 front-sight、rear-sight、pistol-slide、magazine、pistol-grip-hand、pistol-support-hand、knife-grip-hand、knife-free-hand 等分件。front-sight 和 rear-sight 是光学对齐挂点，位于局部 y=0.040 的同一直线上。ADS 完成后完全去除待机与走路摆动，挂点投影到屏幕中心。腰射与 ADS 过渡约 0.32 秒收敛，FOV 由玩家控制器处理。

动作消费 actionProgress，不扣弹、不改伤害、不移动敌人的权威根节点。开火进度 0～0.14 显示火光，滑套与后坐在前半段回正。换弹在 0.08～0.22 让左手接近弹匣，0.22～0.43 取出，0.60～0.83 插入，0.84～1 回到持握。换弹中切刀由战斗状态中断，返回手枪时回到就位状态。小刀挥击在前 16% 完成主要横扫，随后回收。

感染体静止最高点约 1.80 m，安保机含天线约 1.47 m。战斗模块目前使用整身盒体，感染体手指与安保机炮管会伸出盒体边缘，首片没有逐骨骼命中或弱点判定。

## 已执行验证

自动回归使用 tests/art.test.mjs，5 项全部通过，涵盖相机转向与移动后的 ADS、FOV 和宽高比切换、短时枪口火光、弹匣与支撑手接触及中断恢复、感染体前摇和攻击、地下旋转出生点倒地接触、安保机机械前摇与熄灯。

本线最后一次集成检查 npm test 通过全部 27 项。npm run build 通过 TypeScript 与 Vite 生产构建，主包仍有超过 500 kB 的体积提示。美术模块与预览入口的独立严格类型检查也通过。

复现命令在项目根运行。

```powershell
node --test tests/art.test.mjs
node tests/art-browser.mjs
node tests/art-raid.mjs
npm test
npm run build
```

art-browser 自动启动本地 Vite 与 Chrome，生成中性光与暗光固定姿态，并把浏览器错误、GPU、draw calls 和三角数写入 [metrics.json](../../assets/art-qa/metrics.json)。实测为 Chrome 157.0.8103.51、AMD Radeon RX 5700 XT、1280×720。4∶3 为 1024×768，超宽为 1720×720。浏览器脚本每次结束关闭自己的服务器和 Chrome。

13 张资产截图均已查看。重点证据为 [腰射](../../assets/art-qa/01-pistol-hip.jpg)、[ADS](../../assets/art-qa/02-pistol-ads.jpg)、[开火](../../assets/art-qa/03-pistol-shot.jpg)、[取出弹匣](../../assets/art-qa/04-pistol-reload.jpg)、[插入弹匣](../../assets/art-qa/11-pistol-reload-seat.jpg)、[持刀](../../assets/art-qa/05-knife-ready.jpg)、[挥刀](../../assets/art-qa/06-knife-strike.jpg)、[敌人轮廓](../../assets/art-qa/07-enemies-idle.jpg)、[暗处前摇](../../assets/art-qa/08-enemies-windup.jpg)、[敌人攻击](../../assets/art-qa/09-enemies-attack.jpg)、[倒地](../../assets/art-qa/10-enemies-dead.jpg)、[4∶3 ADS](../../assets/art-qa/12-ads-4by3.jpg) 与 [超宽 ADS](../../assets/art-qa/13-ads-ultrawide.jpg)。

剔除固定验收场景的 draw calls 后，手枪与双臂约 31 calls、13,182 三角形，小刀与双臂约 20 calls、7,876 三角形，两类敌人同时可见约 91 calls、13,492 三角形。数值来自静态姿态，整局帧时间仍以集成线的地图与遭遇测试为准。

art-raid 从正常入口点击出击按钮，使用真实键鼠完成 RMB 举枪、开火一次、等待回正、R 换弹、1 切刀和左键挥刀。按种子 2 在南侧卸货口验证，浏览器错误与 HTTP 错误为零。证据包括 [输入结果](../../assets/art-qa/raid-input.json)、[地图 ADS](../../assets/art-qa/raid-ads.jpg)、[地图换弹](../../assets/art-qa/raid-reload.jpg)、[地图持刀](../../assets/art-qa/raid-knife.jpg) 和 [连续动作视频](../../assets/art-qa/raid-actions.webm)。视频由 Chrome MediaRecorder 录制游戏画布，1280×720，VP9，画布外 HUD 见对应截图。另用 Chrome 解码验证了视频的实际宽高和画面。

## 待验证与下一步

此版本采用程序化低面数模型和姿态曲线。已检查所列机位的持握、弹匣贴合、袖口接续和倒地，后续复杂近身遭遇仍需结合地图实测穿插。安保机与感染体的完整地下交战、近墙命中、撤离整局和性能由集成线复验。敌人受击以血量下降触发短促姿态，声音由后续玩法表现统一处理。

本线修改范围为 src/presentation/、tests/art*、assets/art-qa/ 和本文件。共享状态 docs/memory/STATUS.md 由集成线在最终整局验收后更新。下一步由集成线运行生产预览及 tests/browser-raid.mjs，关联最终地图和战斗版本，确认地下遭遇、近墙射击与整局结算。
