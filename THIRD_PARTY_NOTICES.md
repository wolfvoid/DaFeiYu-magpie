# 素材与代码来源

动画、动作分类与动作选择逻辑来自 [PC2005-cloud/dsh-pet](https://github.com/PC2005-cloud/dsh-pet)，固定版本 242fac13053ca6d7a5d316124df499013c2494a1。

上游代码采用 MIT 许可，完整文本见 licenses/dsh-pet-MIT.txt。动画、提示词和源视频的上游声明：允许开源使用，禁止商用；任何介绍、展示、分发衍生作品的地方须附上原作者 GitHub 地址。此应用保留原始动画文件，逐个验证 Git blob SHA-1。

动画清单见 `assets/upstream.json`；`assets/upstream-config.jsonc`、动作分类及 `src/vendor/pickers.ts` 来自同一固定提交。`src/pickers.mjs` 是选择器的编译版本。当前 `src/animation.mjs` 为本项目后续重写的调度器。素材由下载脚本取得，不在 Git 中重复分发。README 和其他包含角色的演示截图也遵循上游素材要求。

Magpie 接口与集成文档：[yetone/magpie](https://github.com/yetone/magpie)。本项目仅通过其本地只读接口交互，不包含 Magpie 二进制，也不复制用户配置或凭据。请求和额度适配器是本项目的实现。

早期 Codex 只读状态适配的设计参考 [bianbian-666/Codex-dafeiyu](https://github.com/bianbian-666/Codex-dafeiyu)，最初的宠物安装思路参考 [yifanlu0227/DaFeiYu-codex-pet](https://github.com/yifanlu0227/DaFeiYu-codex-pet)。当前版本已移除 Codex 适配；没有采用后者的 spritesheet。两者在此作为参考来源致谢，不表示其作者直接参与提交或为本项目背书。

运行时与构建工具包括 [Electron](https://github.com/electron/electron)、[electron/packager](https://github.com/electron/packager)、[esbuild](https://github.com/evanw/esbuild)、[jsonc-parser](https://github.com/microsoft/node-jsonc-parser)。依赖保留各自许可证；Electron 应用包还包含 Chromium 等组件及其随包许可。

此项目为独立社区工具，与 OpenAI、DeepSeek、Magpie 无官方隶属关系。仓库新增代码的 MIT 许可不覆盖第三方角色与动画素材。

