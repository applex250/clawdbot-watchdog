const { spawn } = require('child_process');
const path = require('path');

const WATCHDOG_SCRIPT = path.join(__dirname, 'openclaw-watchdog-silent.js');

function startWatchdog() {
  console.log('🚀 启动监控守护进程...');

  const child = spawn('node', [WATCHDOG_SCRIPT], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true
  });

  child.unref();

  console.log('✅ 监控守护进程已启动 (PID:', child.pid, ')');
  console.log('📝 日志会写入标准输出/错误流');
}

startWatchdog();
