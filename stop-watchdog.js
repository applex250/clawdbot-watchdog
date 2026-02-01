const { exec } = require('child_process');

exec('tasklist', (error, stdout) => {
  if (error) {
    console.error('❌ 无法获取进程列表');
    return;
  }

  const lines = stdout.split('\n');
  let found = false;

  for (const line of lines) {
    if (line.includes('node.exe') && line.includes('openclaw-watchdog')) {
      const parts = line.trim().split(/\s+/);
      const pid = parts[1];
      console.log(`🔍 发现监控进程 PID: ${pid}`);

      exec(`taskkill /F /PID ${pid}`, (err) => {
        if (err) {
          console.error(`❌ 无法终止进程 ${pid}`);
        } else {
          console.log(`✅ 已终止监控进程 ${pid}`);
        }
      });

      found = true;
    }
  }

  if (!found) {
    console.log('ℹ️  未发现正在运行的监控进程');
  }
});
