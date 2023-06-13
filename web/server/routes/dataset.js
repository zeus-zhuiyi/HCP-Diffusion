const router = require('koa-router')();
const path = require('path');
const helper = require('../helper');
const constants = require('../constants');
const shellProcessMap = new Map();
const Ajv = require('ajv');

const baseTrainYamlName = 'base_dataset';
const getShellLogFilePath = (basePath, sn) => {
  return `${basePath}/${constants.DIR.SERVER.SHELL_LOG}/${baseTrainYamlName}_${sn}.log`;
};

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
    let progress = 0;

    helper.searchFromFileTail(shellLogFilePath, 20, (buffer) => {
      // 从日志文本最后一行读起
      // 如果读到结束语，向上读获取所有图片，直到没有标记，进度 100
      // 如果读到 progress 标记，返回该进度
      // 如果读到其他的，就往上读完，如果有读到 progress 标记，返回该进度, 没有的话进度 1
      let isEnding = false;
      let status = constants.SHELL.STATUS.LOADING;

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
      }

      if (isEnding) {
        progress = 100;
      } else {
        // 可以判断进程是否不存在或者结束，如果不存在或者已结束，progress 一定是 100%
        if (!shellProccess) {
          helper.writeEndingToFile(shellLogFilePath, constants.SHELL_LOG_TAG.UNACTIVE_INTERRUPT_END_TIPS);
          progress = 100;
          status = constants.SHELL.STATUS.UNACTIVE_INTERRUPT;
        }
      }

      resolve({ progress, status });
    });
  });
};

const ajv = new Ajv({ allErrors: true });
// 定义请求参数的 schema
const postPTSchema = {
  type: 'object',
  properties: {
    model: { type: 'string', minLength: 1, maxLength: 100 },
    prompt_file: { type: 'string', minLength: 1, maxLength: 100 },
    out_dir: { type: 'string', minLength: 1, maxLength: 100 }
  },
  required: ['model', 'prompt_file', 'out_dir'],
  additionalProperties: true
};

router.prefix('/api/v1/dataset');

// 获取配置
router.get('/', async function (ctx, next) {
  const sn = ctx.query.sn || '';
  const { hostPath, serverPath } = ctx.state;
  const shellLogFilePath = getShellLogFilePath(serverPath, sn);
  const shellProccess = shellProcessMap.get(+sn);
  const { progress = 100, status } = await getShellProgress(shellLogFilePath, shellProccess);
  const prompt_file = helper.readDirFilesToMap(
    hostPath,
    constants.PATH.prompt_file.dirPath,
    constants.PATH.prompt_file.fileTypes
  );

  ctx.body = {
    prompt_file,
    progress,
    status,
    sn
  };
});

// 生成 pt
router.post('/', function (ctx, next) {
  const { info = {}, mock = false  } = ctx.request.body; // 获取 JSON 格式的请求数据
  // 验证请求参数
  const validate = ajv.compile(postPTSchema);
  const valid = validate(info);
  ctx.logger.info('postDatasetSchema valid:', valid);
  if (!valid) {
    const err = new Error('参数内容不符合要求');
    err.statusCode = 500;
    ctx.throw(err);
  }
  const sn = helper.createSn();
  const shellLogFilePath = getShellLogFilePath(ctx.state.serverPath, sn);
  const shellLogFile = helper.createFile(shellLogFilePath);

  let shell = '';
  let shellAgrs = [];
  if (mock) {
    shell = 'sh';
    shellAgrs = ['test.sh'];
  } else {
    const { model, prompt_file, out_dir } = info;
    shell = 'python';
    shellAgrs = [
      '-m',
      'hcpdiff.tools.gen_from_ptlist',
      '--model',
      model,
      '--prompt_file',
      prompt_file,
      '--out_dir',
      out_dir
    ];
  }

  const shellProccess = helper.execShell(shell, shellAgrs, shellLogFile, (code, signal) => {
    ctx.logger.info(`dataset child process ${sn} exited with code ${code} and signal ${signal}`);
    // 统一在这里管理 map
    shellProcessMap.delete(sn);
  });

  // 先存储 process
  shellProcessMap.set(sn, shellProccess);

  ctx.body = {
    sn // 用来轮询的唯一标识
  };
});

// 终止
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

// 轮询生成进度接口 Done
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
