# Yach IM Full（知音楼）OpenClaw 聊天通道插件

这是 `@tal/yach-im-full` 的完整聊天通道插件：保留标准机器人聊天通道，并融合好未来 Agent 项目的扫码登录、NIM 长连接、即时通信与会话、群组与组织管理能力。

插件目录、manifest、源码/runtime 双入口、setup 入口和频道插件入口按
[OpenClaw 官方插件构建说明](https://docs.openclaw.ai/plugins/building-plugins)
及[频道插件说明](https://docs.openclaw.ai/plugins/sdk-channel-plugins)组织。

插件 ID 和聊天频道 ID 都是 `yach-im-full`。不要同时启用两个会注册 `yach-im-full` 频道的插件。

## 两条长连接如何结合

它们是两套独立连接，共存于同一个 Gateway 进程：

- Channel SDK 长连接：使用 `appKey/appSecret`，负责机器人频道的入站消息；出站仍使用 Yach OAPI。
- NIM WebSocket 长连接：优先复用 `yach-im-full` session 或本机 OpenClaw 共用 session 中的 `user.id` 和 `cloudtoken`，使用固定 NIM appKey 建立人对人/群聊连接；已有有效 NIM 凭据时不需要扫码。

迁移工具和自动响应都从同一个 `NimListener`/NIM SDK 实例执行，不会重复建立同账号的第二个 NIM client。

频道 ID、配置键和 OpenClaw 聊天能力统一使用 `yach-im-full`；插件身份也是 `yach-im-full`，命令使用 `/yach_login`、`/yach_status`、`/yach-refresh-token` 和 `/yach-response`。知音楼平台自身的协议常量（例如 `yach20001`、`yach://` 原生深链和 `yach-oapi.zhiyinlou.com`）必须保留，否则平台消息、`/models` 可点击链接或鉴权会失效。

## 开发

```bash
npm install
npm run build
npm test
npm run pack:check
```

`package.json` 使用 `src/index.ts` 作为源码入口、`dist/index.js` 作为已安装插件的
runtime 入口，并配套 `setupEntry`/`runtimeSetupEntry`。二维码登录、NIM SDK 和浏览器
兼容层只在 full runtime 或实际执行登录命令时延迟加载。

好未来 Agent 项目的 36 个业务域已全部迁移到 `yach-im-full`：共 287 个唯一 Agent 工具，覆盖即时通信、群组组织、日程会议、文档知识库、文件、考勤、OKR/周报、AI、搜索提醒、企业邮件和开放平台能力。

迁移范围包含参考工程 capability map 中的全部 36 个业务域；完整的工具名、来源模块和副作用标记见自动生成的 [`docs/CAPABILITY-MAP.md`](docs/CAPABILITY-MAP.md)。

## 配置

```json5
{
  channels: {
    "yach-im-full": {
      enabled: true,
      appKey: "your-app-key",
      appSecret: "your-app-secret",
      channelAppId: "yach20001",
      dmPolicy: "pairing",
      groupPolicy: "allowlist",
      groupResponseMode: "mentions",
      requireMention: true,
      allowBots: true,
      chatHistoryEnabled: true,
      chatHistoryLimit: 20,
      replyMode: "stream"
    }
  }
}
```

多账号配置使用 `channels["yach-im-full"].accounts.<accountId>`。`connectionMode` 固定为 `channel`；`appKey/appSecret` 支持明文或 OpenClaw `SecretRef`。密钥只在 Gateway `full` 运行时解析，Discovery 和 setup-only 阶段不会建立网络连接。

工资条能力是显式配置的可选能力：在 `plugins.entries.yach-im-full.config.payrollAdminToken` 配置短期 admin_token，建议使用 OpenClaw `SecretRef`。Gateway 解析后只在插件进程内使用，不读取本机应用、浏览器或系统凭据文件，不写入 yach-im-full session。未配置时，`yach_refresh_payroll_token` 会明确提示配置缺失并停止。

安装后使用标准向导，不需要手动编辑配置文件：

```bash
openclaw channels add --channel yach-im-full
YACH_IM_APP_KEY=... YACH_IM_APP_SECRET=... openclaw channels add --channel yach-im-full --use-env
openclaw config validate
openclaw channels status --channel yach-im-full
```

向导会把 Yach IM 放入频道选择器、写入凭据引用、配置访问策略，并支持 `--account <accountId>`。

配置好 `appKey/appSecret` 后，在知音楼当前对话执行（仅在缺少 NIM 凭据，或需要刷新 HTTP/CAPI 登录态时）：

```text
/yach_login
```

命令会返回二维码并在后台轮询 60 秒；成功后 session 保存在 Gateway stateDir 下的 `yach-im-full/sessions/session.json`（权限 600），并立即尝试启动 NIM。插件自己的 session 不存在时，只读复用 OpenClaw 共用 session 中的 `user.id`、显示名和 `cloudtoken` 三个 NIM 字段；不会读取其中的 HTTP/CAPI 凭据，也不会写回共用文件。已有 `user.id + cloudtoken` 时，NIM 直接启动，不会要求扫码；两处都没有有效 NIM 登录态，或 HTTP/CAPI `token/accesstoken` 已失效时，才提示执行 `/yach_login`。用 `/yach_status` 查看进度；需要时用 `/yach-refresh-token` 刷新仍有效的登录态。

### 群聊默认行为

默认值是 `groupPolicy: "allowlist"` + `groupResponseMode: "mentions"`：

- 只有 `groupAllowFrom` 明确允许的群会纳入处理范围；
- 长连接只处理允许群的消息，包括未 @ 消息和其他机器人消息；
- 未 @ 当前机器人时，只记录到当前连接的群历史，不启动 agent 回复；
- 明确 @ 当前机器人时，读取最近 20 条上下文并回复；其他机器人明确 @ 当前机器人时也可以触发；
- `dmPolicy: "pairing"` 只作用于私聊，不会阻止已加入的群。

可按需切换：`all` 每条消息都回复，`humans` 只回复人类消息，`mentions` 只回复 @ 当前机器人，`paired` 只回复已配对发送者。`groupPolicy` 仍独立控制群范围，可设为 `open` 或 `disabled`。

如果知音楼平台没有把某条群消息通过长连接推送给插件，插件无法凭空回溯该消息；只要 `recvMsg` 收到，默认模式就会先记录，再由下一条 @ 消息使用。

排查时看 Gateway 日志前缀：新插件必须是 `[yach-im-full]`。如果仍看到 `[yach]`、配置路径是 `channels.yach` 或插件目录名是 `extensions/yach`，说明当前运行的还是旧插件，不能用来验收本包。

如果显式把 `groupPolicy` 改为 `open`，OpenClaw 标准安全审计会显示群开放风险提示；生产环境应保持 `allowlist` 并填写 `groupAllowFrom`。

### 考勤工具的安全边界

`yach_punch_on_duty`、`yach_punch_off_duty` 和 `yach_attendance_auth_check` 保留在完整工具集中，但每次都要求调用方显式提供本次真实 `latitude`、`longitude`、`deviceId` 和 `deviceName`；插件只把坐标交给知音楼服务端校验，不生成坐标、不读取主机硬件标识、不构造设备身份。考勤 access_token 只在当前 Gateway 进程内短期复用，不写入本地文件。两种打卡仍属于高风险外部写操作，必须经过 OpenClaw 逐次确认。

## 安装 `2026.9.4-11`

手工安装包：`tal-yach-im-full-2026.9.4-11.tgz`。

```bash
openclaw plugins install /path/to/tal-yach-im-full-2026.9.4-11.tgz --force --accept-capabilities
openclaw channels add --channel yach-im-full --app-key '<appKey>' --app-secret '<appSecret>'
openclaw config validate
openclaw channels list --all
```

检查能力：

```bash
openclaw channels capabilities --channel yach-im-full --json
openclaw plugins inspect yach-im-full --runtime --json
openclaw plugins doctor
```

能力包括 direct/group、文本/Markdown、引用、图片/音频/视频/文件、流式卡片、状态表情、模型选择深链和 shared-message `react`。Yach IM 的表情接口是 toggle-only，无法安全区分删除，因此 `remove: true` 会明确拒绝。

生产环境可以只在配置中保留 SecretRef：

```json5
{
  channels: {
    "yach-im-full": {
      appKey: { source: "env", provider: "default", id: "YACH_IM_APP_KEY" },
      appSecret: { source: "env", provider: "default", id: "YACH_IM_APP_SECRET" }
    }
  }
}
```

如果机器上仍残留旧版安装，先卸载旧插件，再安装本包，确保最终只有一个插件注册 `channels["yach-im-full"]`；安装完成后运行 `openclaw config validate`。本包不读取旧插件 session，也不读取旧 `channels.yach` 配置键。

## 长连接和消息处理

- 建连：创建 Channel SDK client，监听 `netStatusChange`、`authResponse`、`kickout`、`recvMsg`，再调用 `init`。
- 收消息：解析双层 JSON，做过期检查、AES-128-ECB 解密、账号级去重、DM/group 策略、配对、群 @ 门控和按会话串行队列。
- 群历史：连接级保存每个群最多 1000 个会话键；默认每次 @ 回复携带最近 20 条消息，重启或断线后不跨连接回溯。
- 重连：断线、踢下线或初始化异常使用 5 秒起步的指数退避，最多 5 分钟；成功连通后清零。
- 回复：`replyMode: "stream"` 使用知音楼卡片增量推送，`direct` 使用分段普通消息。
- 状态表情：从 `[推眼镜]`、`[暗中观察]`、`[拿捏]`、`[哇]`、`[爱你呦]`、`[我收到了]`、`[请稍等]`、`[荧光棒]`、`[鞠躬]`、`[收到]`、`[全力以赴]`、`[Yes]`、`[OpenClaw]` 中按场景随机选择，同一会话尽量不连续重复；可用 `typingExpression` 固定或置空关闭。
- `/models`：provider、model、More、All 会转换为知音楼原生 fold 深链，点击后回传对应命令；不支持深链的客户端仍可看到可读文本。

## NIM 长连接

登录成功后，或读取到已有有效登录态后，NIM 使用 `account = String(session.user.id)`、`token = session.cloudtoken`，服务器为 `weblink-haoweilai.netease.im:443`。未登录时 NIM 服务保持空闲，不会让 Gateway 启动失败；如果登录发生在服务尚未启动的时机，重启 Gateway 即可。

## 目标和配对

- 当前私聊：由入站会话自动回复；
- 指定用户：`user:<yachImUserId>`；
- 指定工号：`work_code:<工号>`；
- 指定群：`group:<conversationId>`。

私聊默认使用 pairing：

```bash
openclaw pairing list yach-im-full
openclaw pairing approve yach-im-full <code> --notify
```

## 安装后检查

安装完成后，使用默认 OpenClaw 配置执行以下检查：

```bash
openclaw channels list --all
openclaw plugins inspect yach-im-full --runtime --json
openclaw plugins doctor
openclaw config validate
```

预期结果：频道列表显示 `Yach IM Full`，插件 ID 为 `yach-im-full`，配置 schema 的默认 `groupPolicy` 为 `allowlist`、默认 `groupResponseMode` 为 `mentions`，且插件诊断为空。真实凭据探测需要在配置账号后执行；使用占位凭据时出现平台鉴权失败属于探测结果，不是注册错误。

### 合规运行时约束

- 287 个迁移工具全部保留在 `contracts.tools`；涉及消息发送、组织修改、考勤写卡或敏感工资条凭据检查的工具标记为 `sideEffecting` 并要求显式确认，查询组织/消息/会话等敏感工具要求通过 `tools.allow` 显式启用。
- `tool-discovery` 只发布工具能力，不启动 NIM、后台 service 或 HTTP 路由；setup 入口使用 bundled setup contract，不加载 Channel SDK/OAPI/NIM 运行时。
- 入站消息在进入 OpenClaw context 前经过官方 channel ingress resolver；私聊默认 pairing，群聊默认 allowlist。
- `/plugin/yach-im-full/*` 路由统一使用 Gateway 认证；二维码登录和 session 文件只属于 `yach-im-full`，不读取旧 `haoweilai-agent` session。
- 工资条 admin_token 不从本机 Cookie/浏览器存储提取，也不写入 session；考勤坐标和设备字段必须由调用方显式提供并由服务端校验。

## 迁移分析

36 个业务域、9 大类的归并、迁移范围与运行边界见
[`docs/yach-im-full/DOMAIN-MIGRATION.md`](docs/yach-im-full/DOMAIN-MIGRATION.md)。

## 参考资料

- [OpenClaw 官方构建插件说明](https://docs.openclaw.ai/plugins/building-plugins)
- [OpenClaw 官方频道插件 SDK](https://docs.openclaw.ai/plugins/sdk-channel-plugins)
