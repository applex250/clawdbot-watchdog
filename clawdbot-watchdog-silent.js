#!/usr/bin/env node

/**
 * Clawdbot Gateway 监控守护脚本
 * 功能：
 * 1. 监控 clawdbot gateway 进程
 * 2. 如果挂掉，自动刷新 Clash Verge 订阅
 * 3. 重新启动 clawdbot gateway
 */

const { exec, spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

// WhatsApp 通知配置
const WHATSAPP_ENABLED = true;  // 启用 WhatsApp 通知
const WHATSAPP_TARGET = '5625001745';  // 你的手机号

// ========== 配置区域 ==========

// Clash Verge API 配置
const CLASH_API = {
  host: '127.0.0.1',
  port: '9097',        // ← 改成你的 Clash Verge API 端口
  secret: 'haiwuwuwu'  // ← 如果有密钥，填在这里
};

// 检查间隔（秒）
const CHECK_INTERVAL = 30;

// 日志文件路径
const LOG_FILE = path.join(__dirname, 'watchdog.log');

// ========== 全局变量 ==========

let consecutiveFailures = 0;  // 连续失败次数
const MAX_FAILURES = 5;       // 最大连续失败次数

// ========== 日志函数 ==========

// 写入日志
function writeLog(message) {
  const timestamp = new Date().toLocaleString('zh-CN');
  const logEntry = `[${timestamp}] ${message}\n`;
  fs.appendFileSync(LOG_FILE, logEntry, 'utf8');
}

// 清空日志文件
function clearLog() {
  fs.writeFileSync(LOG_FILE, '', 'utf8');
}



// 清屏（使用 Node.js 内置的 console.clear()）
function clearScreen() {
  console.clear();
}

// 发送 WhatsApp 消息
function sendWhatsApp(message) {
  if (!WHATSAPP_ENABLED) return;

  const timestamp = new Date().toLocaleString('zh-CN');
  const fullMessage = `[${timestamp}] ${message}`;

  exec(`clawdbot message send --channel whatsapp --to ${WHATSAPP_TARGET} "${fullMessage}"`, (error, stdout, stderr) => {
    if (error) {
      console.error(`[${new Date().toLocaleString('zh-CN')}] ❌ WhatsApp 发送失败:`, error.message);
    } else {
      console.log(`[${new Date().toLocaleString('zh-CN')}] 📱 WhatsApp 消息已发送`);
    }
  });
}

// ========== 工具函数 ==========

// 执行命令
function execCommand(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

// 检查 clawdbot gateway 是否运行
async function isGatewayRunning() {
  try {
    // 方法1: 检查进程是否在监听端口
    const portCheck = await execCommand('netstat -ano | findstr :16666 | findstr LISTENING');
    if (portCheck) return true;

    // 方法2: 使用 clawdbot gateway status 检查
    const output = await execCommand('clawdbot gateway status');
    return output.includes('ok') || output.includes('running') || output.includes('active');
  } catch (error) {
    return false;
  }
}

// 刷新 Clash Verge 订阅
async function refreshClashSubscription() {
  return new Promise((resolve) => {
    // 清屏
    clearScreen();

    const options = {
      hostname: CLASH_API.host,
      port: CLASH_API.port,
      path: '/configs',        // Clash API 路径
      method: 'PUT',           // PUT 触发配置更新
      headers: CLASH_API.secret ? {
        'Authorization': `Bearer ${CLASH_API.secret}`,
        'Content-Type': 'application/json'
      } : {
        'Content-Type': 'application/json'
      }
    };

    console.log(`[${new Date().toLocaleString('zh-CN')}] 🔄 正在刷新 Clash 订阅...`);

    const req = http.request(options, (res) => {
      console.log(`[${new Date().toLocaleString('zh-CN')}] Clash API 响应: ${res.statusCode}`);
      if (res.statusCode === 204 || res.statusCode === 200) {
        console.log(`[${new Date().toLocaleString('zh-CN')}] ✅ Clash 订阅刷新成功`);
        resolve(true);
      } else {
        console.log(`[${new Date().toLocaleString('zh-CN')}] ⚠️ 刷新失败，状态码: ${res.statusCode}`);
        resolve(false);
      }
    });

    req.on('error', (error) => {
      console.error(`[${new Date().toLocaleString('zh-CN')}] ❌ Clash API 错误:`, error.message);
      resolve(false);
    });

    req.end();
  });
}

// 启动 clawdbot gateway
async function startGateway() {
  console.log(`[${new Date().toLocaleString('zh-CN')}] 🚀 正在启动 clawdbot gateway...`);
  try {
    const output = await execCommand('clawdbot gateway start');
    console.log(`[${new Date().toLocaleString('zh-CN')}] ✅ clawdbot gateway 启动命令已执行`);
    console.log(`[${new Date().toLocaleString('zh-CN')}] 📋 输出: ${output}`);
    // 等待6秒让它启动
    await new Promise(resolve => setTimeout(resolve, 6000));
    return true;
  } catch (error) {
    console.error(`[${new Date().toLocaleString('zh-CN')}] ❌ 启动失败:`, error.message);
    // 即使失败也返回true，继续监控
    return true;
  }
}

// 恢复流程
async function recover() {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`[${new Date().toLocaleString('zh-CN')}] ⚠️ 检测到 clawdbot gateway 已停止`);
  console.log(`[${new Date().toLocaleString('zh-CN')}] 🔧 开始恢复流程...`);
  console.log(`[${new Date().toLocaleString('zh-CN')}] 📊 当前连续失败: ${consecutiveFailures}/${MAX_FAILURES}`);
  console.log(`${'='.repeat(50)}\n`);

  // 发送 WhatsApp 通知
  sendWhatsApp(`⚠️ Clawdbot Gateway 已停止\n🔧 开始恢复... (${consecutiveFailures + 1}/${MAX_FAILURES})`);

  // 写入日志
  writeLog('═════════════════════════════════════════════════════════════');
  writeLog('⚠️ 检测到 clawdbot gateway 已停止');
  writeLog(`🔧 开始恢复流程...`);
  writeLog(`📊 当前连续失败: ${consecutiveFailures}/${MAX_FAILURES}`);

  // 检查是否达到最大失败次数
  if (consecutiveFailures >= MAX_FAILURES) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`[${new Date().toLocaleString('zh-CN')}] ❌ 已达到最大重试次数 (${MAX_FAILURES} 次)`);
    console.log(`[${new Date().toLocaleString('zh-CN')}] 🛑 停止自动监控，等待人工处理`);
    console.log(`${'='.repeat(50)}\n`);

    console.log(`[${new Date().toLocaleString('zh-CN')}] 📋 故障诊断信息:`);
    console.log(`   检查网络连接`);
    console.log(`   检查 Clash Verge 是否正常运行`);
    console.log(`   手动刷新 Clash 订阅`);
    console.log(`   手动启动: clawdbot gateway start\n`);

    // 写入日志
    writeLog('');
    writeLog(`❌ 已达到最大重试次数 (${MAX_FAILURES} 次)`);
    writeLog(`🛑 停止自动监控，等待人工处理`);
    writeLog('');
    writeLog('📋 故障诊断信息:');
    writeLog('   检查网络连接');
    writeLog('   检查 Clash Verge 是否正常运行');
    writeLog('   手动刷新 Clash 订阅');
    writeLog('   手动启动: clawdbot gateway start');
    writeLog('═════════════════════════════════════════════════════════════');

    // 发送 WhatsApp 通知
    sendWhatsApp(`❌ Clawdbot Gateway 恢复失败！\n\n🛑 已达到最大重试次数 (${MAX_FAILURES})\n📊 总检查次数: ${checkCount}\n⏱️ 运行时长: ${Math.floor((Date.now() - startTime) / 1000)} 秒\n\n💡 请手动检查并重启！`);

    process.exit(1);
  }

  // 步骤 1: 刷新 Clash 订阅
  writeLog(`\n🔄 步骤 1/2: 刷新 Clash 订阅...`);
  const refreshSuccess = await refreshClashSubscription();
  if (!refreshSuccess) {
    console.log(`[${new Date().toLocaleString('zh-CN')}] ⚠️ Clash 订阅刷新失败，但继续尝试启动 gateway`);
    writeLog(`⚠️ Clash 订阅刷新失败，但继续尝试启动 gateway`);
  } else {
    writeLog(`✅ Clash 订阅刷新成功`);
  }

  // 等待 3 秒让 Clash 更新完成
  writeLog(`⏳ 等待 3 秒让 Clash 更新完成...`);
  await new Promise(resolve => setTimeout(resolve, 3000));

  // 步骤 2: 启动 gateway
  writeLog(`🚀 步骤 2/2: 启动 clawdbot gateway...`);
  const startSuccess = await startGateway();

  let recoveryOk = false;

  if (startSuccess) {
    // 再次检查
    const running = await isGatewayRunning();
    if (running) {
      console.log(`\n[${new Date().toLocaleString('zh-CN')}] 🎉 恢复成功！clawdbot gateway 已上线\n`);
      recoveryOk = true;
      writeLog('');
      writeLog(`🎉 恢复成功！clawdbot gateway 已上线`);

      // 发送 WhatsApp 通知
      sendWhatsApp(`✅ Clawdbot Gateway 已恢复上线！\n🔄 恢复次数: ${consecutiveFailures}`);
    } else {
      console.log(`\n[${new Date().toLocaleString('zh-CN')}] ⚠️ 启动命令已执行，但状态检查失败\n`);
      writeLog('');
      writeLog(`⚠️ 启动命令已执行，但状态检查失败`);
    }
  }

  // 根据恢复结果更新连续失败计数
  if (recoveryOk) {
    consecutiveFailures = 0;  // 成功则重置
    console.log(`[${new Date().toLocaleString('zh-CN')}] ✅ 连续失败计数已重置: ${consecutiveFailures}\n`);
    writeLog(`✅ 连续失败计数已重置: ${consecutiveFailures}`);
  } else {
    consecutiveFailures++;
    console.log(`[${new Date().toLocaleString('zh-CN')}] ⚠️ 连续失败次数: ${consecutiveFailures}/${MAX_FAILURES}`);
    writeLog(`⚠️ 连续失败次数: ${consecutiveFailures}/${MAX_FAILURES}`);

    if (consecutiveFailures >= MAX_FAILURES) {
      console.log(`[${new Date().toLocaleString('zh-CN')}] ❌ 下次检测到掉线时将停止监控\n`);
      writeLog(`❌ 下次检测到掉线时将停止监控`);
    } else {
      console.log(`[${new Date().toLocaleString('zh-CN')}] ⏳ 将在 ${CHECK_INTERVAL} 秒后再次尝试...\n`);
      writeLog(`⏳ 将在 ${CHECK_INTERVAL} 秒后再次尝试...`);
    }
  }

  writeLog('═════════════════════════════════════════════════════════════\n');
}

// 主监控循环
async function watch() {
  // 清空日志文件
  clearLog();
  writeLog('🐕 Clawdbot 守护进程已启动');
  writeLog(`📡 检查间隔: ${CHECK_INTERVAL} 秒`);
  writeLog(`🌐 Clash API: ${CLASH_API.host}:${CLASH_API.port}`);
  writeLog('');

  console.log(`[${new Date().toLocaleString('zh-CN')}] 🐕 Clawdbot 守护进程已启动`);
  console.log(`[${new Date().toLocaleString('zh-CN')}] 📡 检查间隔: ${CHECK_INTERVAL} 秒`);
  console.log(`[${new Date().toLocaleString('zh-CN')}] 🌐 Clash API: ${CLASH_API.host}:${CLASH_API.port}`);
  console.log(`${'='.repeat(50)}\n`);

  while (true) {
    // 每次检查前先清屏
    clearScreen();

    const running = await isGatewayRunning();

    if (!running) {
      await recover();
    } else {
      // 正常时显示状态
      console.log(`[${new Date().toLocaleString('zh-CN')}] ✅ Gateway 运行正常`);
      console.log(`[${new Date().toLocaleString('zh-CN')}] 📊 检查间隔: ${CHECK_INTERVAL} 秒`);
      console.log(`[${new Date().toLocaleString('zh-CN')}] ⏰ 下次检查: ${CHECK_INTERVAL} 秒后\n`);
    }

    // 等待下次检查
    await new Promise(resolve => setTimeout(resolve, CHECK_INTERVAL * 1000));
  }
}

// 启动监控
watch().catch(error => {
  console.error(`[${new Date().toLocaleString('zh-CN')}] 💥 监控脚本崩溃:`, error);
  process.exit(1);
});

// 捕获未处理的异常
process.on('uncaughtException', (error) => {
  console.error(`[${new Date().toLocaleString('zh-CN')}] 💥 未捕获的异常:`, error);
  // 继续运行，不退出
});

process.on('unhandledRejection', (reason, promise) => {
  console.error(`[${new Date().toLocaleString('zh-CN')}] 💥 未处理的 Promise 拒绝:`, reason);
  // 继续运行，不退出
});
