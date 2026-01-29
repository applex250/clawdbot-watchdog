# Clawdbot Gateway Watchdog - 交互式监控守护进程

一个用于监控和自动恢复 Clawdbot Gateway 服务的交互式守护脚本。

## ✨ 特性

- 🐕 **自动监控** - 每 30 秒检查一次 Gateway 状态
- 🔄 **自动恢复** - 检测到掉线时自动刷新 Clash 订阅并重启 Gateway
- 📊 **实时状态面板** - 彩色显示运行状态、检查次数、恢复次数等
- 🎮 **交互式命令** - 支持 status、check、recover、quit 等命令
- 🛡️ **失败保护** - 连续 5 次失败后停止监控，避免无限重试
- 📝 **日志记录** - 所有恢复过程记录到 watchdog.log

## 📋 系统要求

- Windows 10/11
- Node.js 18+
- Clash Verge (用于代理管理)
- Clawdbot CLI (安装了 WhatsApp 通道)

## 🚀 快速开始

### 2. 修改配置

编辑 `clawdbot-watchdog-interactive.js` 中的配置：

```javascript
// Clash Verge API 配置
const CLASH_API = {
  host: '127.0.0.1',
  port: '9097',        // 改成你的 Clash Verge API 端口
  secret: '你的密钥'  // 如果有密钥，填在这里
};
```

### 3. 启动监控

双击 `start.bat` 或在命令行中运行：

```bash
node clawdbot-watchdog-interactive.js
```

## 🎮 交互式命令

| 命令 | 说明 |
|------|------|
| `status` | 显示当前状态面板 |
| `check` | 立即检查 Gateway 状态 |
| `recover` | 手动触发恢复流程 |
| `quit` 或 `q` | 退出监控 |

## 📊 工作流程

```
启动监控
  ↓
每 30 秒检查 Gateway 状态
  ↓
┌─────────────┐
│  运行正常？   │
└─────────────┘
  ↓ Yes    ↓ No
  状态面板   检测到掉线
            ↓
         刷新 Clash 订阅
            ↓
         启动 Gateway
            ↓
         检查恢复结果
            ↓
      ┌───────────┐
      │ 恢复成功？ │
      └───────────┘
         ↓ Yes       ↓ No
      重置失败计数   增加失败计数
         ↓            ↓
      继续监控      ≥5次则停止
```

## 📱 WhatsApp 通知

### 掉线通知
```
⚠️ Clawdbot Gateway 已停止
🔧 开始恢复... (1/5)
```

### 恢复成功
```
✅ Clawdbot Gateway 已恢复上线！
🔄 恢复次数: 0
```

### 达到最大重试
```
❌ Clawdbot Gateway 恢复失败！

🛑 已达到最大重试次数 (5)
📊 总检查次数: 15
⏱️ 运行时长: 450 秒

💡 请手动检查并重启！
```

## 📁 文件说明

| 文件 | 说明 |
|------|------|
| `clawdbot-watchdog-interactive.js` | 交互式监控脚本（推荐） |
| `clawdbot-watchdog-silent.js` | 静默版监控脚本（后台运行） |
| `start.bat` | 启动脚本（双击运行交互式版） |
| `start-silent.bat` | 启动脚本（双击运行静默版） |
| `stop-watchdog.js` | 停止监控脚本 |
| `watchdog-starter.js` | 后台启动器 |
| `cleanup-workspace.bat` | 清理 workspace 中旧文件 |
| `watchdog.log` | 恢复日志（运行时生成） |
| `README.md` | 本文件 |

## ⚙️ 配置参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `CHECK_INTERVAL` | 30 | 检查间隔（秒） |
| `MAX_FAILURES` | 5 | 最大连续失败次数 |
| `CLASH_API.host` | 127.0.0.1 | Clash API 地址 |
| `CLASH_API.port` | 9097 | Clash API 端口 |
| `CLASH_API.secret` | (空) | Clash API 密钥 |


## 🛠️ 故障排查

### Gateway 无法启动

1. 检查 Clash Verge 是否正常运行
2. 检查 Clash 订阅是否有效
3. 手动刷新 Clash 订阅
4. 运行 `clawdbot gateway status` 检查状态



### 监控不断重启

1. 检查 Gateway 端口  是否被占用
2. 检查网络连接是否稳定
3. 查看日志文件 `watchdog.log` 了解详细错误

## 📝 日志示例

```
═════════════════════════════════════════════════════════════
⚠️ 检测到 clawdbot gateway 已停止
🔧 开始恢复流程...
📊 当前连续失败: 0/5
📊 总检查次数: 12
🔄 总恢复尝试: 1

🔄 步骤 1/2: 刷新 Clash 订阅...
✅ Clash 订阅刷新成功
⏳ 等待 3 秒让 Clash 更新完成...
🚀 步骤 2/2: 启动 clawdbot gateway...

🎉 恢复成功！clawdbot gateway 已上线
✅ 连续失败计数已重置: 0
═════════════════════════════════════════════════════════════
```

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

**作者**: 伍
**日期**: 2026-01-28
**版本**: 1.0.0
