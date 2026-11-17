# 首图战斗与敌人交接

2026-11-12，共享工作目录中的首图 Demo 基线。任务范围与接口见 [首图规格](FIRST_MAP.md) 和 [共享类型](../../src/contracts/demo.ts)。

## 接入

- 每次出击调用 [`createCombat(map, map.enemies)`](../../src/combat/createCombat.ts)。每个仿真步传入当前脚底、眼位、相机瞄准方向和枪口世界坐标。以返回的 `health` 推进撤离逻辑，使死亡能在当步终止撤离。
- `attackPressed` 可接鼠标按下脉冲。两次按下之间需要一次 `false` 采样。`aiming` 传按住状态，`reloadPressed` 和 `switchTo` 传本步的按键意图。UI 每步读取 `feedback`，持续显示时间由 UI 维护。未命中的开火可从 `weapon.action` 和弹量变化判断。
- 表现使用 `WeaponState` 和 `EnemyState`。`actionProgress` 是当前动作阶段的进度。机瞄和枪口来自第一人称模型，贴掩体时使用模型枪口的世界坐标。敌人的 `yaw` 与 Three.js 正前方 −Z 一致，根节点位置为脚底。
- 弹药拾取调用 `addReserve(发数)`，医疗调用 `heal(恢复量)`。每盒 6 发和每包 40 HP 由拾取方传入。死亡后当前战斗停止，新建战斗恢复起始配装。

## 实现取值

- [`createCombat.ts`](../../src/combat/createCombat.ts) 实现武器状态、伤害、补给和死亡。默认持手枪，起始 6+6，按住右键举枪，切换武器取消换弹或尚未命中的挥刀。换弹完成时转移弹药，切枪保留攻击间隔。刀在挥击约 0.234 秒后取当时的相机方向，触及距离为眼位到碰撞盒表面 1.55 m。
- [`targeting.ts`](../../src/combat/targeting.ts) 与 [`geometry.ts`](../../src/combat/geometry.ts) 计算最近目标和世界遮挡。手枪射程 45 m，先查相机射线，再查眼位至枪口和枪口至瞄准点。被挡的开火仍扣一发。命中盒为以脚底定位的轴对齐包围盒。
- [`createEnemy.ts`](../../src/enemies/createEnemy.ts) 与 [`specs.ts`](../../src/enemies/specs.ts) 实现两类敌人。感染体沿出生朝向在 1.4 m 范围内来回巡逻，10 m 内可见时沿地面追击，1.6 m 内起 0.65 秒前摇，命中扣 25 HP。两次生效至少相隔 1.4 秒。安保机原地守卫，11 m 内可见时开始 0.9 秒预警，命中扣 20 HP。掩体或离开攻击范围会清除前摇进度。敌人移动和视线使用地图查询，追击采用直线接近与地图滑移。

## 已验证

| 验证 | 复现与结果 |
| --- | --- |
| 战斗自动测试 | Node v24.6.0 执行 `node --test tests/combat.test.mjs`，12 项通过。覆盖近墙、刀距、耗弹、空仓、换弹中断、补给、前摇与锁定、遮挡、死亡及 30/60 FPS 固定靶复测。测试入口为 [combat.test.mjs](../../tests/combat.test.mjs)。 |
| 全项目回归与构建 | `npm test`，当时工作区 24 项通过。`node references/saltline-lite/node_modules/typescript/bin/tsc --noEmit` 通过。Vite 8.3.8 使用 `build({ build: { write: false } })` 通过生产打包。 |
| 实际地图装配 | Node 中分别用种子 0、1、2 调用 `createFirstMap(seed)` 和 `createCombat(map, map.enemies)`。九个地面出生点各空等 60 步，每步 1/60 秒，玩家保持 100 HP。仅装配各种子的实验室安保机，在其同一 XZ 的地面 Y=0 等待 60 步，安保机保持待机且玩家无伤。 |
| 本机浏览器输入 | Chrome 157.0.8103.51 无头模式，1024×640，经本地 Vite 打开 `?seed=2&qa=1`。点击开始后锁定鼠标。右键举枪，左键按住直到动作结束，弹药由 6+6 变为 5+6。松开右键退出 ADS，按 R 后变为 6+5，按 1 后点击可触发挥刀。页面与控制台错误均为 0，HTTP 响应无 4xx 或 5xx。 |

## 待验证与下一步

集成线按 [验收与证据](../qa/README.md) 完成地面和地下整局试玩。战斗画面重点核对实际近墙枪口、挥刀触及、感染体出招姿态和实验室安保机的灯态、火光及掩体边缘。追击转角和场景内命中盒与模型轮廓的吻合度仍待试玩。

后续技能建议用 `diagnose` 定位实机遮挡或时序偏差，用 `tdd` 固化可复现回归。
