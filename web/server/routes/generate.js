const router = require('koa-router')();
const path = require('path');
const helper = require('../helper');
const constants = require('../constants');
const Ajv = require('ajv');

const baseYamlName = 'base_generate';
const getBaseYamlFilePath = (sn, paths) => {
  const { hostPath, serverPath } = paths;
  const isHost = (sn && !isNaN(sn))
  const baseYamlPathPrefix = isHost ? hostPath : serverPath;
  const baseYamlPathName = isHost
    ? `${constants.DIR.GENERATE.YAML_FILE}/${baseYamlName}_${sn}.yaml`
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
      images: [],
      status: constants.SHELL.STATUS.DELETE_OR_NOT_EXIST
    };
  }

  return await new Promise((resolve) => {
    const images = [];
    let progress = 0.01;

    helper.searchFromFileTail(shellLogFilePath, 20, (buffer) => {
      // 从日志文本最后一行读起
      // 如果读到结束语，向上读获取所有图片，直到没有标记，进度 100
      // 如果读到 image 标记，获取所有图片，向上读获取所有图片，直到没有标记，进度 99
      // 如果读到 progress 标记，返回该进度
      // 如果读到其他的，就往上读完，如果有读到 progress 标记，返回该进度, 没有的话进度 1
      let isEnding = false;
      let isReadImgs = false;
      let isProgress = false;
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
          continue;
        }

        if (line.includes(constants.SHELL_LOG_TAG.IMAGES_PATH_TIPS)) {
          const position =
            line.indexOf(constants.SHELL_LOG_TAG.IMAGES_PATH_TIPS) +
            constants.SHELL_LOG_TAG.IMAGES_PATH_TIPS.length;
          const imagePath = line.substring(position).trim();

          images.unshift(`${constants.DIR.SERVER.STATIC_SOURCE.IMAGE}/${imagePath}`);
          isReadImgs = true;
          continue;
        }

        if (line.includes(constants.SHELL_LOG_TAG.GENERATE_PROGRESS_TIPS)) {
          // 优化算法
          if (isReadImgs) {
            break;
          }

          const beginPosition =
            line.indexOf(constants.SHELL_LOG_TAG.GENERATE_PROGRESS_TIPS) +
            constants.SHELL_LOG_TAG.GENERATE_PROGRESS_TIPS.length;
          const currentProgessRange = line.substring(beginPosition).split('/');
          const currentProgess = (currentProgessRange[0].trim() * 100 / currentProgessRange[1].trim() )

          // 进度为 100，但是还没有获取到图片，需要设置为 99
          progress = currentProgess === 100 ? 99 : currentProgess;
          progress = progress > 0.01 ? progress : 0.01;
          isProgress = true;
          break;
        }
      }

      if (isEnding) {
        progress = 100;
      } else if (isReadImgs) {
        progress = 99;
      }

      // 可以判断进程是否存在或者结束，如果结束或不存在，progress 一定是 100%
      if (!shellProccess && !isEnding) {
        helper.writeEndingToFile(shellLogFilePath, constants.SHELL_LOG_TAG.UNACTIVE_INTERRUPT_END_TIPS);
        progress = 100;
        status = constants.SHELL.STATUS.UNACTIVE_INTERRUPT;
      }

      resolve({ progress, images, status });
    });
  });
};

const ajv = new Ajv({ allErrors: true });
// 定义请求参数的 schema
const postGenerateSchema = {
  type: 'object',
  properties: {
    pretrained_model: { type: 'string', minLength: 1, maxLength: 100 },
  },
  required: ['pretrained_model'],
  additionalProperties: true
};

router.prefix('/api/v1/generate');

// 获取生成图片配置
router.get('/', async function (ctx, next) {
  const sn = ctx.query.sn || '';
  const shellLogFilePath = getShellLogFilePath(ctx.state.serverPath, sn);
  const shellProccess = shellProcessMap.get(+sn);
  const { progress = 100, images = [], status } = await getShellProgress(shellLogFilePath, shellProccess);
  const info = helper.readYamlFile(getBaseYamlFilePath(sn, ctx.state));
  const { hostPath, serverPath } = ctx.state;
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
  const condition_image = helper.readDirFilesToMap(
    hostPath,
    constants.PATH.condition_image.dirPath,
    constants.PATH.condition_image.fileTypes,
    constants.PATH.condition_image.dropSuffix,
  );
  const merge_group_lora_path = helper.readDirFilesToMap(
    hostPath,
    constants.PATH.merge_group_lora_path.dirPath,
    constants.PATH.merge_group_lora_path.fileTypes,
    constants.PATH.merge_group_lora_path.dropSuffix,
  );
  const merge_group_part_path = helper.readDirFilesToMap(
    hostPath,
    constants.PATH.merge_group_part_path.dirPath,
    constants.PATH.merge_group_part_path.fileTypes,
    constants.PATH.merge_group_part_path.dropSuffix,
  );
  const merge_group_plugin_controlnet1_path = helper.readDirFilesToMap(
    hostPath,
    constants.PATH.merge_group_plugin_controlnet1_path.dirPath,
    constants.PATH.merge_group_plugin_controlnet1_path.fileTypes,
    constants.PATH.merge_group_plugin_controlnet1_path.dropSuffix,
  );
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
    pretrained_model_name_or_path,
    condition_image,
    merge_group_lora_path,
    merge_group_part_path,
    merge_group_plugin_controlnet1_path,
    server_yaml_file,
    is_pending: progress < 100,
    progress,
    images,
    status,
    sn
  };
});

// 生成图片：校验 schema，然后备份 yaml 文件，开始执行生成图片 shell 命令
// shell 示范：python -m hcpdiff.visualizer --cfg cfgs/infer/text2img.yaml
router.post('/', function (ctx, next) {
  // 先开始生成yaml文件，再执行 yaml 命令
  const { info, mock = false } = ctx.request.body; // 获取 JSON 格式的请求数据
  // 验证请求参数
  const validate = ajv.compile(postGenerateSchema);
  const valid = validate(info);
  ctx.logger.info('postGenerateSchema valid:', valid);
  if (!valid) {
    const err = new Error('please choose pretrained_model');
    err.statusCode = 500;
    ctx.throw(err);
  }
  const sn = helper.createSn();
  const shellLogFilePath = getShellLogFilePath(ctx.state.serverPath, sn);
  const yamlFile = helper.createFile(getBaseYamlFilePath(sn, ctx.state));
  const yamlFilePath = helper.writeYamlFile(yamlFile, info);
  ctx.logger.info(`generate yarmfile: ${yamlFilePath}`);

  let shell = '';
  let shellAgrs = [];
  if (mock) {
    shell = 'sh';
    shellAgrs = ['test.sh'];
  } else {
    shell = 'python'
    shellAgrs = ['-m', 'hcpdiff.visualizer', '--cfg', yamlFilePath]
  // const shellAgrs = ['-m', 'hcpdiff.visualizer', '--cfg', 'cfgs/infer/text2img.yam', `prompt='${info.prompt}'`, `neg_prompt='${info.neg_prompt}'`, `pretrained_model=${info.pretrained_model}`]
  // python -m hcpdiff.visualizer --cfg cfgs/infer/text2img.yaml prompt='apple' neg_prompt='bad quality' pretrained_model=runwayml/stable-diffusion-v1-5
  }

  const shellProccess = helper.execShell(shell, shellAgrs, shellLogFilePath, (code, signal) => {
    ctx.logger.info(`generate child process ${sn} exited with code ${code} and signal ${signal}`);
    // 统一在这里管理 map
    shellProcessMap.delete(sn);
  });

  // 先存储 process
  shellProcessMap.set(sn, shellProccess);

  ctx.body = {
    sn // 用来轮询的唯一标识
  };
});

// 终止生成图片
router.delete('/progress', function (ctx, next) {
  const sn = ctx.query.sn || '';
  const shellLogFilePath = getShellLogFilePath(ctx.state.serverPath, sn);
  const shellProccess = shellProcessMap.get(+sn);
  if (shellProccess) {
    const code = helper.killShellProccess(shellProccess);
    helper.writeEndingToFile(shellLogFilePath, constants.SHELL_LOG_TAG.ACTIVE_INTERRUPT_END_TIPS)
    ctx.logger.info(`generate child process ${sn} killed with code ${code}`);
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
  const { progress = 100, images = [], status } = await getShellProgress(shellLogFilePath, shellProccess);

  ctx.body = {
    sn,
    progress,
    images,
    status
  };
});

module.exports = router;
