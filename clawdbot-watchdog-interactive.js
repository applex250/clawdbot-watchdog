#!/usr/bin/env node

/**
 * OpenClaw Gateway 监控守护脚本 (交互版)
 * 功能：
 * 1. 监控 openclaw gateway 进程
 * 2. 如果挂掉，自动刷新 Clash Verge 订阅
 * 3. 重新启动 openclaw gateway
 * 4. 可交互控制（输入 quit 退出）
 */

const { exec, spawn } = require('child_process');
const http = require('http');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

// WhatsApp 通知配置
const WHATSAPP_ENABLED = true;  // 启用 WhatsApp 通知
const WHATSAPP_TARGET = '5625001745';  // 你的手机号

// ========== 配置区域 ==========

// Clash Verge API 配置
const CLASH_API = {
  host: '127.0.0.1',
  port: '9097',
  secret: 'haiwuwuwu'
};

// 检查间隔（秒）
const CHECK_INTERVAL = 30;

// 日志文件路径
const LOG_FILE = path.join(__dirname, 'watchdog.log');

// ========== 全局变量 ==========

let shouldStop = false;
let startTime = Date.now();
let checkCount = 0;
let lastCheckStatus = '未知';
let recoveryCount = 0;
let lastRecoveryTime = null;
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

  exec(`openclaw message send --channel whatsapp --to ${WHATSAPP_TARGET} "${fullMessage}"`, (error, stdout, stderr) => {
    if (error) {
      console.error(`[${getCurrentTime()}] ❌ WhatsApp 发送失败:`, error.message);
    } else {
      console.log(`[${getCurrentTime()}] 📱 WhatsApp 消息已发送`);
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

// 检查 openclaw gateway 是否运行
async function isGatewayRunning() {
  try {
    // 方法1: 检查端口
    const portCheck = await execCommand('netstat -ano | findstr :16666 | findstr LISTENING');
    if (portCheck) return true;

    // 方法2: 使用 openclaw gateway status 检查
    const output = await execCommand('openclaw gateway status');
    return output.includes('ok') || output.includes('running') || output.includes('active');
  } catch (error) {
    return false;
  }
}

// 刷新 Clash Verge 订阅
async function refreshClashSubscription() {
  return new Promise((resolve) => {
    const options = {
      hostname: CLASH_API.host,
      port: CLASH_API.port,
      path: '/configs?force=true',
      method: 'PUT',
      headers: CLASH_API.secret ? {
        'Authorization': `Bearer ${CLASH_API.secret}`,
        'Content-Type': 'application/json'
      } : {
        'Content-Type': 'application/json'
      }
    };

    console.log(`\x1B[36m[${getCurrentTime()}] 🔄 正在刷新 Clash 订阅...\x1B[0m`);

    const req = http.request(options, (res) => {
      console.log(`\x1B[90m[${getCurrentTime()}] Clash API 响应: \x1B[33m${res.statusCode}\x1B[0m`);
      if (res.statusCode === 204 || res.statusCode === 200) {
        console.log(`\x1B[32m[${getCurrentTime()}] ✅ Clash 订阅刷新成功\x1B[0m`);
        resolve(true);
      } else {
        console.log(`\x1B[33m[${getCurrentTime()}] ⚠️ 刷新失败，状态码: ${res.statusCode}\x1B[0m`);
        resolve(false);
      }
    });

    req.on('error', (error) => {
      console.error(`\x1B[31m[${getCurrentTime()}] ❌ Clash API 错误:\x1B[0m`, error.message);
      resolve(false);
    });

    req.write('{}');
    req.end();
  });
}

// 启动 openclaw gateway
async function startGateway() {
  console.log(`\x1B[36m[${getCurrentTime()}] 🚀 正在启动 openclaw gateway...\x1B[0m`);
  try {
    const output = await execCommand('openclaw gateway start');
    console.log(`\x1B[32m[${getCurrentTime()}] ✅ openclaw gateway 启动命令已执行\x1B[0m`);
    console.log(`\x1B[90m[${getCurrentTime()}] 📋 输出: ${output}\x1B[0m`);
    // 等待6秒让它启动
    await new Promise(resolve => setTimeout(resolve, 6000));
    return true;
  } catch (error) {
    console.error(`\x1B[31m[${getCurrentTime()}] ❌ 启动失败:\x1B[0m`, error.message);
    return true; // 即使失败也返回true，继续监控
  }
}

// 获取当前时间
function getCurrentTime() {
  return new Date().toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

// 显示状态
function showStatus() {
  // 清屏
  clearScreen();

  // 计算运行时间
  const runTime = startTime ? Math.floor((Date.now() - startTime) / 1000) : 0;
  const hours = Math.floor(runTime / 3600);
  const minutes = Math.floor((runTime % 3600) / 60);
  const seconds = runTime % 60;
  const runTimeStr = hours > 0 ? `${hours}h ${minutes}m ${seconds}s` : `${minutes}m ${seconds}s`;

  // 可视化状态条
  const statusIcon = lastCheckStatus === true ? '🟢' : lastCheckStatus === false ? '🔴' : '🟡';
  const statusText = lastCheckStatus === true ? '运行中' : lastCheckStatus === false ? '已停止' : '检查中...';
  const statusColor = lastCheckStatus === true ? '\x1B[32m' : lastCheckStatus === false ? '\x1B[31m' : '\x1B[33m';

  // 可视化检查进度条
  const progressChar = '▮';
  const emptyChar = '▯';
  const progressBar = progressChar.repeat(Math.min(checkCount % 10, 10)) + emptyChar.repeat(Math.max(10 - (checkCount % 10), 0));

  // 可视化恢复次数
  const recoveryStars = '⭐'.repeat(Math.min(recoveryCount, 5));

  console.log('\x1B[36m╔══════════════════════════════════════════════════════════╗\x1B[0m');
  console.log('\x1B[36m║\x1B[33m   🐕 OpenClaw Gateway 监控守护进程 (交互版)\x1B[36m           ║\x1B[0m');
  console.log('\x1B[36m╚══════════════════════════════════════════════════════════╝\x1B[0m\n');

  console.log('\x1B[36m📊 运行状态\x1B[0m');
  console.log(`   ${statusColor}${statusIcon} Gateway: ${statusText}\x1B[0m`);
  console.log(`   📈 检查次数: \x1B[33m${checkCount}\x1B[0m  [${progressBar}]`);
  console.log(`   🔄 恢复次数: \x1B[35m${recoveryCount}\x1B[0m  ${recoveryStars}`);
  console.log(`   ⏱️  运行时间: ${runTimeStr}`);
  console.log(`   🕐 最后恢复: ${lastRecoveryTime ? lastRecoveryTime : '\x1B[90m从未\x1B[0m'}`);
  console.log(`   ⏳ 下次检查: \x1B[32m${CHECK_INTERVAL}\x1B[0m 秒后\n`);

  console.log('\x1B[36m⚙️  配置\x1B[0m');
  console.log(`   📡 检查间隔: \x1B[33m${CHECK_INTERVAL}\x1B[0m 秒`);
  console.log(`   🌐 Clash API: \x1B[33m${CLASH_API.host}:${CLASH_API.port}\x1B[0m\n`);

  console.log('\x1B[36m🎮 可用命令\x1B[0m');
  console.log('   \x1B[32mstatus\x1B[0m       - 显示当前状态');
  console.log('   \x1B[32mcheck\x1B[0m        - 立即检查 Gateway 状态');
  console.log('   \x1B[32mrecover\x1B[0m      - 手动触发恢复流程');
  console.log('   \x1B[31mquit / q\x1B[0m     - 退出监控\n');

  console.log('\x1B[90m' + '='.repeat(60) + '\x1B[0m');
  console.log(`\x1B[90m[${getCurrentTime()}]\x1B[0m 🟢 正在运行... (\x1B[32m输入 quit 退出\x1B[0m)\n`);
}

// 恢复流程
async function recover() {
  const recoverTimestamp = getCurrentTime();

  // 先清屏
  clearScreen();

  console.log('\n' + '\x1B[90m' + '='.repeat(60) + '\x1B[0m');
  console.log(`\x1B[31m[${getCurrentTime()}] ⚠️ 检测到 openclaw gateway 已停止\x1B[0m`);
  console.log(`\x1B[33m[${getCurrentTime()}] 🔧 开始恢复流程...\x1B[0m`);
  console.log(`\x1B[90m[${getCurrentTime()}] 📊 当前连续失败: ${consecutiveFailures}/${MAX_FAILURES}\x1B[0m`);
  console.log('\x1B[90m' + '='.repeat(60) + '\x1B[0m\n');

  // 发送 WhatsApp 通知
  sendWhatsApp(`⚠️ OpenClaw Gateway 已停止\n🔧 开始恢复... (${consecutiveFailures + 1}/${MAX_FAILURES})`);

  // 写入日志
  writeLog('═════════════════════════════════════════════════════════════');
  writeLog('⚠️ 检测到 openclaw gateway 已停止');
  writeLog(`🔧 开始恢复流程...`);
  writeLog(`📊 当前连续失败: ${consecutiveFailures}/${MAX_FAILURES}`);
  writeLog(`📊 总检查次数: ${checkCount}`);
  writeLog(`🔄 总恢复尝试: ${recoveryCount + 1}`);

  // 检查是否达到最大失败次数
  if (consecutiveFailures >= MAX_FAILURES) {
    console.log('\n' + '\x1B[31m' + '='.repeat(60) + '\x1B[0m');
    console.log(`\x1B[31m[${getCurrentTime()}] ❌ 已达到最大重试次数 (${MAX_FAILURES} 次)\x1B[0m`);
    console.log(`\x1B[31m[${getCurrentTime()}] 🛑 停止自动监控，等待人工处理\x1B[0m`);
    console.log('\x1B[31m' + '='.repeat(60) + '\x1B[0m\n');

    console.log('\x1B[36m📋 故障诊断信息:\x1B[0m');
    console.log(`   📊 总检查次数: ${checkCount}`);
    console.log(`   🔄 总恢复尝试: ${recoveryCount}`);
    console.log(`   ⏱️  运行时长: ${Math.floor((Date.now() - startTime) / 1000)} 秒`);
    console.log(`   🕐 最后尝试时间: ${lastRecoveryTime}\n`);

    console.log('\x1B[36m💡 建议操作:\x1B[0m');
    console.log('   1. 检查网络连接');
    console.log('   2. 检查 Clash Verge 是否正常运行');
    console.log('   3. 手动刷新 Clash 订阅');
    console.log('   4. 手动启动: openclaw gateway start');
    console.log('   5. 问题解决后，输入 "check" 验证状态\n');

    console.log('\x1B[90m' + '='.repeat(60) + '\x1B[0m');
    console.log(`\x1B[90m[${getCurrentTime()}] ⏳ 等待人工处理... (输入 check 检查状态)\x1B[0m\n`);

    // 写入日志
    writeLog('');
    writeLog(`❌ 已达到最大重试次数 (${MAX_FAILURES} 次)`);
    writeLog(`🛑 停止自动监控，等待人工处理`);
    writeLog('');
    writeLog('📋 故障诊断信息:');
    writeLog(`   📊 总检查次数: ${checkCount}`);
    writeLog(`   🔄 总恢复尝试: ${recoveryCount}`);
    writeLog(`   ⏱️ 运行时长: ${Math.floor((Date.now() - startTime) / 1000)} 秒`);
    writeLog(`   🕐 最后尝试时间: ${lastRecoveryTime}`);
    writeLog('');
    writeLog('💡 建议操作:');
    writeLog('   1. 检查网络连接');
    writeLog('   2. 检查 Clash Verge 是否正常运行');
    writeLog('   3. 手动刷新 Clash 订阅');
    writeLog('   4. 手动启动: openclaw gateway start');
    writeLog('   5. 问题解决后，输入 "check" 验证状态');
    writeLog('═════════════════════════════════════════════════════════════');

    // 发送 WhatsApp 通知
    sendWhatsApp(`❌ OpenClaw Gateway 恢复失败！\n\n🛑 已达到最大重试次数 (${MAX_FAILURES})\n📊 总检查次数: ${checkCount}\n⏱️ 运行时长: ${Math.floor((Date.now() - startTime) / 1000)} 秒\n\n💡 请手动检查并重启！`);

    shouldStop = true;
    return;
  }

  recoveryCount++;
  lastRecoveryTime = getCurrentTime();

  // 步骤 1: 刷新 Clash 订阅
  writeLog(`\n🔄 步骤 1/2: 刷新 Clash 订阅...`);
  const refreshSuccess = await refreshClashSubscription();
  if (!refreshSuccess) {
    console.log(`[${getCurrentTime()}] ⚠️ Clash 订阅刷新失败，但继续尝试启动 gateway`);
    writeLog(`⚠️ Clash 订阅刷新失败，但继续尝试启动 gateway`);
  } else {
    writeLog(`✅ Clash 订阅刷新成功`);
  }

  // 等待 3 秒让 Clash 更新完成
  writeLog(`⏳ 等待 3 秒让 Clash 更新完成...`);
  await new Promise(resolve => setTimeout(resolve, 3000));

  // 步骤 2: 启动 gateway
  writeLog(`🚀 步骤 2/2: 启动 openclaw gateway...`);
  const startSuccess = await startGateway();

  let recoveryOk = false;

  if (startSuccess) {
    // 再次检查
    const running = await isGatewayRunning();
    if (running) {
      console.log(`\n\x1B[32m[${getCurrentTime()}] 🎉 恢复成功！openclaw gateway 已上线\x1B[0m\n`);
      recoveryOk = true;
      writeLog(``);
      writeLog(`🎉 恢复成功！openclaw gateway 已上线`);

      // 发送 WhatsApp 通知
      sendWhatsApp(`✅ OpenClaw Gateway 已恢复上线！\n🔄 恢复次数: ${consecutiveFailures}`);
    } else {
      console.log(`\n\x1B[33m[${getCurrentTime()}] ⚠️ 启动命令已执行，但状态检查失败\x1B[0m\n`);
      writeLog(``);
      writeLog(`⚠️ 启动命令已执行，但状态检查失败`);
    }
  }

  // 根据恢复结果更新连续失败计数
  if (recoveryOk) {
    consecutiveFailures = 0;  // 成功则重置
    console.log(`\x1B[32m[${getCurrentTime()}] ✅ 连续失败计数已重置: ${consecutiveFailures}\x1B[0m\n`);
    writeLog(`✅ 连续失败计数已重置: ${consecutiveFailures}`);
  } else {
    consecutiveFailures++;
    console.log(`\x1B[31m[${getCurrentTime()}] ⚠️ 连续失败次数: ${consecutiveFailures}/${MAX_FAILURES}\x1B[0m`);
    writeLog(`⚠️ 连续失败次数: ${consecutiveFailures}/${MAX_FAILURES}`);

    if (consecutiveFailures >= MAX_FAILURES) {
      console.log(`\n\x1B[31m[${getCurrentTime()}] ❌ 下次检测到掉线时将停止监控\x1B[0m\n`);
      writeLog(`❌ 下次检测到掉线时将停止监控`);
    } else {
      console.log(`\x1B[33m[${getCurrentTime()}] ⏳ 将在 ${CHECK_INTERVAL} 秒后再次尝试...\x1B[0m\n`);
      writeLog(`⏳ 将在 ${CHECK_INTERVAL} 秒后再次尝试...`);
    }
  }

  writeLog('═════════════════════════════════════════════════════════════\n');

  // 恢复后显示状态（先清屏）
  setTimeout(() => {
    clearScreen();
    showStatus();
  }, 2000);
}

// 主监控循环
async function watch() {
  // 清空日志文件
  clearLog();
  writeLog('🐕 OpenClaw 守护进程已启动');
  writeLog(`📡 检查间隔: ${CHECK_INTERVAL} 秒`);
  writeLog(`🌐 Clash API: ${CLASH_API.host}:${CLASH_API.port}`);
  writeLog('');

  // 初始显示状态（会清屏）
  showStatus();

  while (!shouldStop) {
    // 等待下次检查
    await new Promise(resolve => setTimeout(resolve, CHECK_INTERVAL * 1000));

    // 每次检查前先清屏
    clearScreen();

    // 检查状态
    const running = await isGatewayRunning();
    lastCheckStatus = running;
    checkCount++;

    if (!running) {
      await recover();
    } else {
      // 正常时也刷新状态（显示新的检查次数）
      showStatus();
    }
  }

  console.log(`\n[${getCurrentTime()}] 👋 监控已停止`);
  process.exit(0);
}

// 处理用户输入
function handleInput() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.on('line', async (input) => {
    const cmd = input.trim().toLowerCase();

    switch (cmd) {
      case 'quit':
      case 'q':
        shouldStop = true;
        rl.close();
        break;

      case 'status':
        showStatus();
        break;

      case 'check':
        console.log(`[${getCurrentTime()}] 🔍 手动检查 Gateway 状态...`);
        const running = await isGatewayRunning();
        lastCheckStatus = running;
        console.log(`[${getCurrentTime()}] Gateway 状态: ${running ? '✅ 运行中' : '❌ 已停止'}`);
        setTimeout(() => showStatus(), 1000);
        break;

      case 'recover':
        await recover();
        break;

      default:
        console.log(`❌ 未知命令: ${cmd}`);
        console.log(`   可用命令: status, check, recover, quit (q)\n`);
    }
  });
}

// 捕获异常
process.on('uncaughtException', (error) => {
  console.error(`[${getCurrentTime()}] 💥 未捕获的异常:`, error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error(`[${getCurrentTime()}] 💥 未处理的 Promise 拒绝:`, reason);
});

// 启动监控
handleInput();
watch().catch(console.error);
