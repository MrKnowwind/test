# 历史资产与来源

2026-11-13 P0 起，下述图片及派生文件均为非运行历史参考。生产使用 `src/presentation/finishes.ts` 的程序 DataTexture，不再加载或打包引用这些图片；原始资料按要求保留。验证见 [程序材质记录](../docs/art/PROCEDURAL_PASS.md)。

`source/presentation-atlas-v1.png` 和 `source/infected-face-v1.png` 由历史轮次内置 imagegen 按项目提示词生成，未复制示例视频中的贴图或模型。图集原生 1254×1254，每个象限 627×627；面部图原生 1254×1254。图源保留用于后续重做和对照。

`materials/` 是 `tools/bake-presentation-materials.mjs` 生成的历史运行资产：颜色使用 sRGB WebP，法线与粗糙度 PNG 使用线性采样。颜色经均值校正，atlas 纹理边缘作周期过渡。法线仅由高频色彩估计，不能替代高模烘焙；面部颜色图也不能视为经过摄影测量的无光照材质。

`src/presentation/` 中的模型在项目内使用曲面、挤出和骨骼代码制作。运行资产没有外部图床依赖。`art-qa/` 是历史预览证据，不作为游戏资源打包。后续制作继续遵守项目纯程序内容约束。
