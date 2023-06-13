const router = require('koa-router')();
const path = require('path');
const helper = require('../helper');
const constants = require('../constants');
const shellProcessMap = new Map();
const Ajv = require('ajv');

const baseTrainYamlName = 'base_pt';
const getShellLogFilePath = (basePath, sn) => {
  return `${basePath}/${constants.DIR.SERVER.SHELL_LOG}/${baseTrainYamlName}_${sn}.log`;
};

const ajv = new Ajv({ allErrors: true });
// 定义请求参数的 schema
const postPTSchema = {
  type: 'object',
  properties: {
    pretrained_model: { type: 'string', minLength: 1, maxLength: 100 },
    word_name: { type: 'string', minLength: 1, maxLength: 100 },
    length_of_word: {
      type: 'number',
      minimum: 1,
      maximum: 100
    }
  },
  required: ['pretrained_model', 'word_name', 'length_of_word'],
  additionalProperties: true
};

router.prefix('/api/v1/pt');

// 获取配置
router.get('/', async function (ctx, next) {
  const sn = ctx.query.sn || '';

  ctx.body = {
    sn
  };
});

// 生成 pt
router.post('/', function (ctx, next) {
  const { info = {}, mock = false } = ctx.request.body; // 获取 JSON 格式的请求数据
  // 验证请求参数
  const validate = ajv.compile(postPTSchema);
  const valid = validate(info);
  ctx.logger.info('postPTSchema valid:', valid);
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
    const { pretrained_model, word_name, length_of_word } = info;
    shell = 'python';
    shellAgrs = [
      '-m',
      'hcpdiff.tools.create_embedding',
      pretrained_model,
      word_name,
      length_of_word
    ];
  }

  const shellProccess = helper.execShell(shell, shellAgrs, shellLogFile, (code, signal) => {
    ctx.logger.info(`pt child process ${sn} exited with code ${code} and signal ${signal}`);
    // 统一在这里管理 map
    shellProcessMap.delete(sn);
  });

  // 先存储 process
  shellProcessMap.set(sn, shellProccess);

  ctx.body = {
    sn // 用来轮询的唯一标识
  };
});

module.exports = router;
