const fs = require('fs');
const readline = require('readline');
const path = require('path');
const yaml = require('js-yaml');
const { spawn } = require('child_process');
const { SHELL_LOG_TAG, PATH, APP_DATA } = require('../constants');

module.exports = {
  // 核心逻辑
  createSn: function () {
    return new Date().getTime();
  },
  deepClone: function (obj) {
    return JSON.parse(JSON.stringify(obj));
  },
  readYamlFile: function (yamlFilePath) {
    let yamlContent = {};
    try {
      yamlContent = yaml.load(fs.readFileSync(yamlFilePath, 'utf8'));
    } catch (e) {
      console.log(e);
    }

    return yamlContent;
  },
  writeYamlFile: function (yamlFilePath, data = {}) {
    const yamlContent = yaml.dump(data);
    try {
      yaml.load(fs.writeFileSync(yamlFilePath, yamlContent));
    } catch (e) {
      console.log(e);
    }

    return yamlFilePath;
  },
  getFullDirPath: function (hostPath, dirPath) {
    return path.resolve(hostPath, dirPath);
  },
  // 读取目录下所有文件和目录
  readDirFiles: function (dirPath, fileTypes) {
    try {
      const files = fs.readdirSync(dirPath);

      return files.filter((file) => {
        const filePath = path.join(dirPath, file);
        const extname = path.extname(filePath);
        const stats = fs.statSync(filePath); // 获取文件或目录的状态

        return stats.isFile() && (!fileTypes || fileTypes.includes(extname)); // 过滤出文件，去掉目录
      });
    } catch (error) {
      return [];
    }
  },
  // 读取目录下所有文件和目录，转换为前端展示的数据结构
  readDirFilesToMap: function (hostPath, dirPath, fileTypes, dropSuffix = false) {
    const fullDirPath = this.getFullDirPath(hostPath, dirPath);
    const files = this.readDirFiles(fullDirPath, fileTypes);
    const filesMap = files.map((name) => ({
      label: name,
      value: `${dirPath}/${name}`
    }));

    if (dirPath === PATH.pretrained_mode.dirPath) {
      filesMap.push(...this.deepClone(APP_DATA.BUILT_IN_MODEL));
    }

    // 删除后缀
    if (dropSuffix) {
      filesMap.forEach(item => {
        item.label = item.label.lastIndexOf('.') === -1 ? item.label : item.label.substring(0, item.label.lastIndexOf('.'));
        item.value = item.value.lastIndexOf('.') === -1 ? item.value : item.value.substring(0, item.value.lastIndexOf('.'));
      });
    }

    return filesMap;
  },
  // 检查文件目录是否存在，如果不存在则手动创建目录
  mkDir: function (dirPath) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  },
  // 检查文件目录是否存在，如果不存在则手动创建目录
  mkFileDir: function (filePath) {
    const dirPath = path.dirname(filePath);
    this.mkDir(dirPath);
    return filePath;
  },
  // 创建文件
  createFile: function (filePath) {
    return this.mkFileDir(filePath);
  },
  // 检查文件是否存在
  checkFile: function (filePath) {
    return !!fs.existsSync(filePath);
  },
  // 核心函数
  // 重点：执行 shell 进程！！！！
  execShell: function (shell, shellAgrs, logFilePath, exitCB = () => {}) {
    let logStream = fs.createWriteStream(logFilePath, { flags: 'a+' });
    logStream.write(SHELL_LOG_TAG.BEGIN_TIPS + ' ' + new Date() + '\n', 'utf8', () => {});
    logStream.write([shell, ...shellAgrs].join(' ') + '\n', 'utf8', () => {});

    const shellProccess = spawn(shell, shellAgrs, {
      cwd: '..',
      // shell: true,
      detached: true
    });
    shellProccess.stdout.pipe(logStream);
    shellProccess.stderr.pipe(logStream);

    shellProccess.unref();

    shellProccess.on('exit', (code, signal) => {
      const logEndingText =
        code === 0
          ? SHELL_LOG_TAG.END_TIPS
          : signal
          ? SHELL_LOG_TAG.ACTIVE_INTERRUPT_END_TIPS
          : SHELL_LOG_TAG.UNACTIVE_INTERRUPT_END_TIPS;
      logStream.close();
      logStream = fs.createWriteStream(logFilePath, { flags: 'a+' });
      logStream.write(logEndingText + ' ' + new Date() + '\n', 'utf8', () => {
        logStream.close();
      });
      exitCB(code, signal);
    });

    // 监听日志文件变化事件，如果发生变化则重新打开日志文件并更新输出流
    fs.watchFile(logFilePath, (curr, prev) => {
      if (curr.mtime > prev.mtime) {
        logStream.close();
        logStream = fs.createWriteStream(logFilePath, { flags: 'a+' });
        shellProccess.stdout.unpipe(logStream);
        shellProccess.stderr.unpipe(logStream);
        shellProccess.stdout.pipe(logStream);
        shellProccess.stderr.pipe(logStream);
      }
    });

    return shellProccess;
  },
  // 手动中断 shell 进程
  killShellProccess: function (shellProccess) {
    return shellProccess.kill('SIGTERM');
  },
  writeEndingToFile: function (logFilePath, logText = SHELL_LOG_TAG.END_TIPS) {
    const logStream = fs.createWriteStream(logFilePath, { flags: 'a+' });
    logStream.write(logText + ' ' + new Date() + '\n', 'utf8', () => {
      logStream.close();
    });
  },
  // 最后几行搜索文本内容
  searchFromFileTail: function (filePath, linesToRead = 10, cb) {
    // 创建可读流和逐行读取对象
    const readStream = fs.createReadStream(filePath, { encoding: 'utf8' });
    const rl = readline.createInterface({ input: readStream });

    let buffer = [];
    // 逐行读取文件并记录最后几行的内容
    rl.on('line', (line) => {
      if (buffer.length >= linesToRead) {
        buffer.shift();
      }
      buffer.push(line);
    });

    // 当读取完文件时进行搜索并响应请求
    rl.on('close', () => {
      cb(buffer);
      readStream.close();
    });
  }
};
