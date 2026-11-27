# 3.5D 地图、配发与物品检视验收

基线 `8423bc0`，2026-11-27（Asia/Shanghai）。

| 范围 | 行为 |
| --- | --- |
| 地图 | 大厅、战术地图、小地图使用同一世界坐标投影。全图包含外海邮轮，地面只显示六处地标名称，科研园、档案中心、邮轮等高价值范围用金线与半透明填色。 |
| 局内操作 | 地图键打开后释放鼠标。左键拖动、以滚轮所在位置缩放。可以定位、复位、切换六种楼层、查看本层撤离原因、在图上放置一个有距离提示的路标。打开期间战局继续。 |
| 基础配发 | 仓库只开放一套可确认的方案。港卫 P8 装填 8 发并带 15 发备弹，携带战术刀及 10 格巡检挎包。随身合计 24 格。实线、虚线和普通格分别表示全配发、混合和自带。 |
| 物品 | 点击物品可检视其短描述及品质色名称。55 件新搜刮品使用单独的路径轮廓、结构与高光，五档护甲采用不同程序几何。 |

## 复现

```sh
node --test tests/phase-35d.test.mjs tests/raid.test.mjs tests/outpost.test.mjs tests/phase-three.test.mjs tests/carrying.test.mjs tests/search.test.mjs tests/input.test.mjs tests/world.test.mjs
npm run build -- --base=./
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/path/to/chromium node tests/field-pass-browser.mjs dist test-results/35d phase35d
```

Chromium 从生产构建渲染 98 件图标，逐一核对图像和透明轮廓差异。检查检视文案、品质色、配发选择取消与确认、同名自带背包退库和弹药混合。核对地面与 B1 的撤离限制、六层切换、拖动缩放、路标、定位和 405 像素宽布局。地图打开时点击不射击，撤离计时继续推进，结算不带回配发挎包。浏览器脚本生成 `report-phase35d.json` 和对应截图。全量自动测试由 Pages 构建工作流执行。
