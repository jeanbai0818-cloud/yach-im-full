# yach-im-full 业务域迁移分析

本文以参考工程 capability map 中 36 个有效工具域为基线，把它们重新归并为 9 大类。参考工程只提供接口、协议和行为依据，`yach-im-full` 运行时不依赖其目录、插件 ID 或 session。

## 迁移结论

- 36 个业务域、284 个唯一工具已全部迁移并注册到 `yach-im-full`。
- 工具名和来源接口保持一致，便于已有 Agent 提示词继续使用；工具契约由 `npm run tools:sync` 自动生成。
- API/tool 运行时通过同一个 `NimListener` 复用 NIM SDK 实例，不会因为工具调用再次创建同账号的第二条 NIM 长连接。
- `/yach_login` 保存 `user.id + cloudtoken` 到 `yach-im-full` 自己的 `nim-session/default` plugin-state 命名空间；缺失时只提示登录，不读取任何共享 session、浏览器、钥匙串或其他插件数据。OKR 换票态单独使用 `okr-session/default` 命名空间。
- 所有迁移工具默认是 optional；133 个外部副作用工具同时标记为 `sideEffecting`，在执行前由插件权限 hook 要求逐次确认。

## 9 大类与 36 个业务域

| 类别 | 业务域（来源 capability map） | 本插件状态 |
| --- | --- | --- |
| 1. 即时通信与会话 | `ch1-messaging`、`ch13-session-top`、`ch14-group-emot`、`ch16-sidebar`、`ch17-discuss`、`ch21-vote` | 已迁移 |
| 2. 群组与组织管理 | `ch2-groups`、`ch9-org`、`ch10-announcement`、`ch11-group-apply`、`ch12-external-contact`、`ch15-avatar` | 已迁移 |
| 3. 日程与会议协作 | `ch4-collab`、`ch17-timezone`、`ch21-meeting`、`ch24-schedule-subscribe` | 已迁移 |
| 4. 文档、知识库与文件 | `ch5-docs`、`ch18-file-mgmt`、`ch26-shorthand` | 已迁移 |
| 5. 工作管理与人事 | `ch7-okr`、`ch7-weekly`、`ch25-attendance` | 已迁移 |
| 6. AI 与智能助手 | `ch3-ai`、`ch28-others`、`ch34-feedback`、`ch35-subtitles`、`ch36-intelloft` | 已迁移 |
| 7. 搜索、提醒与信息治理 | `ch6-search`、`ch8-notify`、`ch18-msgfilter`、`ch20-notice`、`ch22-shortlink`、`ch23-collect`、`ch24-collection-remind` | 已迁移 |
| 8. 企业邮件 | `ch5-mail` | 已迁移 |
| 9. 开放平台与扩展能力 | `ch19-oapi` | 已迁移 |

### 第 1 类：即时通信与会话（已全量迁移）

| 业务域 | 能力摘要 | 工具数 |
| --- | --- | ---: |
| `ch1-messaging` | 发私聊/群聊、撤回、历史、搜索、未读、@、卡片、投票、机器人消息、语音转文字、状态 | 15 |
| `ch13-session-top` | 会话置顶配置、列表、添加/移除和排序 | 6 |
| `ch14-group-emot` | 群表情列表、详情和添加 | 3 |
| `ch16-sidebar` | 侧边栏配置和导航项增删 | 4 |
| `ch17-discuss` | 讨论组创建、加入、成员、标题、消息列表和解散 | 7 |
| `ch21-vote` | 投票详情、计数、选项和提交投票 | 4 |

### 第 2 类：群组与组织管理（已全量迁移）

| 业务域 | 能力摘要 | 工具数 |
| --- | --- | ---: |
| `ch2-groups` | 建群、群成员增删、群主、管理员、禁言、改名、退出、解散、群搜索 | 13 |
| `ch9-org` | 用户搜索、个人名片、组织树、部门成员、联系人、个人信息和工作状态 | 14 |
| `ch10-announcement` | 群公告查询、创建、更新、删除、置顶和审核状态 | 7 |
| `ch11-group-apply` | 入群申请查询、接受、拒绝、忽略、批处理、配置和计数 | 7 |
| `ch12-external-contact` | 外部联系人列表、添加、删除、申请处理和状态查询 | 6 |
| `ch15-avatar` | 头像查询和上传 | 2 |

## 全量迁移后的运行边界

这 9 类共同构成完整业务工具面：NIM 长连接负责实时人聊/群聊、云端历史和会话；Channel SDK 长连接负责 OpenClaw 标准机器人频道入站；OAPI 和各业务 API 负责出站及企业业务操作。不同域的 HTTP/CAPI 凭据仍由知音楼服务端独立校验，NIM 有效不代表 HTTP token 一定有效。

## 运行边界

- 发现、setup 和 manifest inspect 阶段不创建网络连接；NIM 只在 full runtime 的插件 service 启动时懒加载。
- 未登录时 NIM service 保持空闲，不让 Gateway 因缺少 session 启动失败。
- 写操作仍受来源 API 的参数校验；考勤写卡必须使用调用方显式提供的真实坐标和设备字段，不生成本机身份或位置，考勤 access_token 只在进程内短期缓存。自动响应默认关闭，开启后也按私聊/群聊白名单策略处理。
- 来源项目的自升级器、私有 session/runtime 镜像和未经确认的自动外发逻辑不随本轮迁移；考勤、邮件、文件、知识库等高影响写操作只在逐次确认后执行。
