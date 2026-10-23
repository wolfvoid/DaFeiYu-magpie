# Contributing

欢迎改进 DaFeiYu-magpie。请保持 Magpie 接入只读、可断连降级，不发送模型请求。

## 提交问题

请提供 macOS 版本、芯片架构、Magpie 版本、复现步骤和预期效果。截图请遮盖账号信息；不要上传设置文件、密钥、聊天内容、原始路由响应或整个 `qa/` 目录。

## 提交代码

1. Fork 仓库，创建功能分支。
2. 按 README 下载依赖与素材。
3. 修改代码，为账号匹配、调度、边界等行为提供有意义的测试。
4. 运行 `npm test` 与 `npm run check`；界面变化在 macOS 上实际验证。
5. PR 写明问题、改动与验证结果；不要提交 `node_modules/`、下载的视频、构建产物或私人运行报告。

素材来自 [PC2005-cloud/dsh-pet](https://github.com/PC2005-cloud/dsh-pet)，禁止商用。若修改或添加视觉素材，请说明来源与授权，并保留作者致谢。
