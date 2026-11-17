# 程序内容增量 · 2026-11-13

## P0 材质迁移

`src/presentation/finishes.ts` 删除历史图片 URL、TextureLoader 和旧图补色；全部改为共享 DataTexture。织物经纬/接缝、金属边缘/接触磨损、皮肤毛孔/褶皱、皮革压痕及聚合物颗粒按结构生成。颜色与粗糙度、由同一高度场导出的法线相对应。保留模型、UV 和枪械挂点；历史 `assets/` 仅作非运行资料，没有删除。

面部使用解析颜色遮罩投影到原连续头壳，真实眼窝、鼻唇保留，新增嵌入的眼睛/眼睑/鼻孔与口线。仍有面具感、肤色与工装轮廓尚待 P4 精修，未宣称达到 3A 或用户认可。下颌骨暂未驱动头壳，不记作表情完成。

验证：`node --test tests/finishes.test.mjs tests/art.test.mjs` 6/6，`npm run build` 通过，生产包 `index-BIF_kux4.js`。`node tests/procedural-browser.mjs` 在 Chrome 157 实测腰射、ADS、实际换弹及真实生成敌人正侧面，页面错误 0、内容图片请求 0。固定脸部机位先暂停，再移动观察机位；没有替换实际角色。报告 [report.json](../../test-results/procedural-p0/report.json)，[腰射](../../test-results/procedural-p0/01-pistol-world.png)、[换弹](../../test-results/procedural-p0/02-reload-world.png)、[ADS](../../test-results/procedural-p0/04-ads-world.png)、[正脸](../../test-results/procedural-p0/06-enemy-front.png)、[侧脸](../../test-results/procedural-p0/07-enemy-side.png)。未做包体、耗时、内存专项采样。

## P4 身体与动作增量

`infectedModel.ts` 缩小过宽的眼眶暗边，补瞳孔；肩顶环与上臂/躯干交叠，皮肤不再套用衣料褶皱，衣料弯曲区加强压褶。增加连续裤腰/胯部曲面、鞋面和鞋底纹路，避免腿与腰部只靠分离圆环连接。

步态相位改随实际水平位移推进，停住时不再凭时间继续摆步。肩、肘、头胸与前冲使用连续过渡，保留攻击逻辑与现有受击/倒地。新增回归先复现预警→攻击瞬间手部跳变，再以平滑姿态通过；持续移动转向时脚底锚点保持接地。现有 ADS、换弹接触与倒地测试仍通过。没有制作真实口腔/下颌蒙皮，因此未记作口部表情已完成。

实机证据使用 `tests/procedural-browser.mjs ... --final`：实际生成敌人追击、预警和攻击，随后暂停固定正/侧面观察；地下机位观察真实敌人，无预览替换。最终包与报告见 [STATUS](../memory/STATUS.md) 和 [实拍报告](../../test-results/next-pass-art/report.json)。仍有较强面具感、衣物片与参数化轮廓，尚未达到参考视频精度；没有用户视觉认可。
