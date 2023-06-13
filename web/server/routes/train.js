const router = require('koa-router')();
const path = require('path');
const helper = require('../helper');
const constants = require('../constants');

const baseYamlName = 'base_train';
const getBaseYamlFilePath = (sn, paths) => {
  const { hostPath, serverPath } = paths;
  const isHost = sn && !isNaN(sn);
  const baseYamlPathPrefix = isHost ? hostPath : serverPath;
  const baseYamlPathName = isHost
    ? `${constants.DIR.TRAIN.YAML_FILE}/${baseYamlName}_${sn}.yaml`
    : `${constants.DIR.SERVER.YAML_FILE}/${baseYamlName}${sn ? '_' : ''}${sn}.yaml`;

  return path.resolve(baseYamlPathPrefix, baseYamlPathName);
};
const getShellLogFilePath = (basePath, sn) => {
  return `${basePath}/${constants.DIR.SERVER.SHELL_LOG}/${baseYamlName}_${sn}.log`;
};
const shellProcessMap = new Map();

// 重要逻辑！！！
const getShellProgress = async (shellLogFilePath, shellProccess) => {
  // 先判断文件是否存在
  if (!helper.checkFile(shellLogFilePath)) {
    return {
      progress: 100,
      status: constants.SHELL.STATUS.DELETE_OR_NOT_EXIST
    };
  }

  return await new Promise((resolve) => {
    let progress = 0.01;

    helper.searchFromFileTail(shellLogFilePath, 20, (buffer) => {
      // 从日志文本最后一行读起
      // 如果读到结束语，向上读获取所有图片，直到没有标记，进度 100
      // 如果读到 progress 标记，返回该进度
      // 如果读到其他的，就往上读完，如果有读到 progress 标记，返回该进度, 没有的话进度 1
      let isEnding = false;
      let isProgress = false;
      let status = constants.SHELL.STATUS.LOADING;
      // const progressRegex = /Step\s*=\s*\[\s*(\d+\/\d+)\s*\]/
      const progressRegex = new RegExp(
        `${constants.SHELL_LOG_TAG.TRAIN_PROGRESS_TIPS.replace(
          /[.*+?^${}()|[\]\\]/g,
          '\\$&'
        )}(\\d+\\/\\d+)\\s*\\]`
      );

      for (let index = buffer.length - 1; index >= 0; index--) {
        const line = buffer[index] || '';
        console.log(line);

        if (line.includes(constants.SHELL_LOG_TAG.ACTIVE_INTERRUPT_END_TIPS)) {
          isEnding = true;
          status = constants.SHELL.STATUS.ACTIVE_INTERRUPT;
          break;
        }

        if (line.includes(constants.SHELL_LOG_TAG.UNACTIVE_INTERRUPT_END_TIPS)) {
          isEnding = true;
          status = constants.SHELL.STATUS.UNACTIVE_INTERRUPT;
          break;
        }

        if (line.includes(constants.SHELL_LOG_TAG.END_TIPS)) {
          isEnding = true;
          status = constants.SHELL.STATUS.END;
          break;
        }

        if (line.includes(constants.SHELL_LOG_TAG.TRAIN_PROGRESS_TIPS)) {
          const match = progressRegex.exec(line);
          const data = (match ? match[1] : '0/100').split('/');
          const currentProgess = (+data[0] / +data[1]) * 100;

          progress = +currentProgess.toFixed(2);
          progress = progress > 0.01 ? progress : 0.01;
          isProgress = true;
          status = constants.SHELL.STATUS.LOADING;
          break;
        }
      }

      if (isEnding) {
        progress = 100;
      }

      // 可以判断进程是否存在或者结束，如果结束或不存在，progress 一定是 100%
      if (!shellProccess && !isEnding) {
        helper.writeEndingToFile(shellLogFilePath, constants.SHELL_LOG_TAG.UNACTIVE_INTERRUPT_END_TIPS);
        progress = 100;
        status = constants.SHELL.STATUS.UNACTIVE_INTERRUPT;
      }

      resolve({ progress, status });
    });
  });
};

router.prefix('/api/v1/train');

// 获取训练配置
router.get('/', async function (ctx, next) {
  const sn = ctx.query.sn || '';
  const { hostPath, serverPath } = ctx.state;
  const shellLogFilePath = getShellLogFilePath(serverPath, sn);
  const shellProccess = shellProcessMap.get(+sn);
  const { progress = 100, status } = await getShellProgress(shellLogFilePath, shellProccess);
  const info = helper.readYamlFile(getBaseYamlFilePath(sn, ctx.state));
  const pretrained_mode = helper.readDirFilesToMap(
    hostPath,
    constants.PATH.pretrained_mode.dirPath,
    constants.PATH.pretrained_mode.fileTypes,
    constants.PATH.pretrained_mode.dropSuffix,
  );
  const pretrained_model_name_or_path = helper.readDirFilesToMap(
    hostPath,
    constants.PATH.pretrained_mode.dirPath,
    constants.PATH.pretrained_mode.fileTypes,
    constants.PATH.pretrained_mode.dropSuffix,
  );
  const prompt_template = helper.readDirFilesToMap(
    hostPath,
    constants.PATH.prompt_template.dirPath,
    constants.PATH.prompt_template.fileTypes,
    constants.PATH.prompt_template.dropSuffix,
  );
  const tokenizer_pt_train_name = helper
    .readDirFilesToMap(
      hostPath,
      constants.PATH.tokenizer_pt_train_name.dirPath,
      constants.PATH.tokenizer_pt_train_name.fileTypes,
      constants.PATH.tokenizer_pt_train_name.dropSuffix,
    )
    .map((item) => ({
      label: item.label,
      value: (item.label.match(new RegExp(`(.*)`)) || [])[1] || ''
    }));
  const server_yaml_file = helper
    .readDirFilesToMap(
      serverPath,
      constants.PATH.server_yaml_file.dirPath,
      constants.PATH.server_yaml_file.fileTypes,
      constants.PATH.server_yaml_file.dropSuffix,
    )
    .filter((item) => item.label.indexOf(baseYamlName) !== -1)
    .map((item) => ({
      label: item.label,
      value: (item.label.match(new RegExp(`${baseYamlName}_(.*)`)) || [])[1] || ''
    }));

  ctx.body = {
    info,
    pretrained_mode,
    prompt_template,
    pretrained_model_name_or_path,
    tokenizer_pt_train_name,
    server_yaml_file,
    is_pending: progress < 100,
    progress,
    status,
    sn
  };
});

// 开始训练：校验 schema，然后备份 yaml 文件，开始执行训练 shell 命令
// # with accelerate
// accelerate launch -m hcpdiff.train_ac --cfg cfgs/train/cfg_file.yaml
// # with accelerate and only one gpu
// accelerate launch -m hcpdiff.train_ac_single --cfg cfgs/train/cfg_file.yaml
// # with colossal-AI
// torchrun --nproc_per_node 1 -m hcpdiff.train_colo --cfg cfgs/train/cfg_file.yaml
router.post('/', function (ctx, next) {
  // 先开始生成yaml文件，再执行 yaml 命令
  const { info, train_mode, mock = false } = ctx.request.body; // 获取 JSON 格式的请求数据
  const sn = helper.createSn();
  const shellLogFilePath = getShellLogFilePath(ctx.state.serverPath, sn);
  const shellLogFile = helper.createFile(shellLogFilePath);
  const yamlFile = helper.createFile(getBaseYamlFilePath(sn, ctx.state));
  const yamlFilePath = helper.writeYamlFile(yamlFile, info);
  ctx.logger.info(`train yarmfile: ${yamlFilePath}`);

  // 组合命令行参数：三种选项
  let shell = '';
  let shellAgrs = [];
  if (mock) {
    shell = 'sh';
    shellAgrs = ['test2.sh'];
  } else {
    if (train_mode === constants.SHELL.TRAIN.MODE.ACCELERATE) {
      shell = 'accelerate';
      shellAgrs = ['launch', '-m', 'hcpdiff.train_ac', '--cfg', yamlFilePath];
    }
    if (train_mode === constants.SHELL.TRAIN.MODE.ACCELERATE_AND_ONLY_ONE_GPU) {
      shell = 'accelerate';
      shellAgrs = ['launch', '-m', 'hcpdiff.train_ac_single', '--cfg', yamlFilePath];
    }
    if (train_mode === constants.SHELL.TRAIN.MODE.COLOSSAL_AI) {
      shell = 'accelerate';
      shellAgrs = [
        'torchrun',
        '--nproc_per_node',
        '1',
        '-m',
        'hcpdiff.train_colo',
        '--cfg',
        yamlFilePath
      ];
    }
  }

  const shellProccess = helper.execShell(shell, shellAgrs, shellLogFile, (code, signal) => {
    ctx.logger.info(`train child process ${sn} exited with code ${code} and signal ${signal}`);
    // 统一在这里管理 map
    shellProcessMap.delete(sn);
  });

  // 先存储 process
  shellProcessMap.set(sn, shellProccess);

  ctx.body = {
    sn // 用来轮询的唯一标识
  };
});

// 终止训练
router.delete('/progress', function (ctx, next) {
  const sn = ctx.query.sn || '';
  const shellLogFilePath = getShellLogFilePath(ctx.state.serverPath, sn);
  const shellProccess = shellProcessMap.get(+sn);
  if (shellProccess) {
    const code = helper.killShellProccess(shellProccess);
    helper.writeEndingToFile(shellLogFilePath, constants.SHELL_LOG_TAG.ACTIVE_INTERRUPT_END_TIPS)
    ctx.logger.info(`train child process ${sn} killed with code ${code}`);
  } else {
    helper.writeEndingToFile(shellLogFilePath, constants.SHELL_LOG_TAG.ACTIVE_INTERRUPT_END_TIPS)
  }

  ctx.body = {
    sn // 用来轮询的唯一标识
  };
});

// 轮询训练进度接口
router.get('/progress', async function (ctx, next) {
  const sn = ctx.query.sn || ''; // 获取 query 参数 name 的值
  const shellLogFilePath = getShellLogFilePath(ctx.state.serverPath, sn);
  const shellProccess = shellProcessMap.get(+sn);
  const { progress = 100, status } = await getShellProgress(shellLogFilePath, shellProccess);

  ctx.body = {
    sn,
    progress,
    status
  };
});

module.exports = router;
