const Koa = require('koa');
const app = new Koa();
const views = require('koa-views');
const json = require('koa-json');
const onerror = require('koa-onerror');
const bodyparser = require('koa-body');
const logger = require('koa-logger');
const serve = require('koa-static');
const mount = require('koa-mount');
const log4js = require('log4js');
const config = require('./config/log4js.json'); // 引入 Log4js 配置文件
const constants = require('./constants');
const helper = require('./helper');

const os = require('os');
const path = require('path');
const fs = require('fs');

// routes
const index = require('./routes/index');
const train = require('./routes/train');
const generate = require('./routes/generate');
const file = require('./routes/file');
const pt = require('./routes/pt');
const dataset = require('./routes/dataset');

const interfaces = os.networkInterfaces();
const addresses = [];
for (const name in interfaces) {
  const networkInterface = interfaces[name];
  for (const info of networkInterface) {
    if (info.family === 'IPv4' && !info.internal) {
      addresses.push(info.address);
    }
  }
}

// 根据配置文件初始化 Log4js
log4js.configure(config);

// 将 Log4js 绑定到 Koa
app.context.logger = log4js.getLogger('default');

// error handler
onerror(app);

// middlewares
app.use(json());
app.use(logger());

// static variable && mkdir
app.use((ctx, next) => {
  ctx.state.address = addresses[0];
  ctx.state.port = ctx.request.socket.localPort;
  ctx.state.serverPath = __dirname; // server 地址：server
  ctx.state.webPath = path.resolve(__dirname, '../'); // webUI 地址：WebUI
  ctx.state.hostPath = path.resolve(__dirname, '../../'); // 宿主地址：HCP-Diffusion
  ctx.state.uploadDir = path.join(ctx.state.hostPath, constants.DIR.HOST.UPLOAD); // 指定上传图片的路径
  ctx.state.distDir = path.resolve(ctx.state.webPath, constants.DIR.WEB.DIST); // 静态页面加载的路径

  // TODO: 用户加载页面时创建必需的目录(可以使用遍历)
  helper.mkDir(path.resolve(ctx.state.hostPath, constants.DIR.GENERATE.YAML_FILE));
  helper.mkDir(path.resolve(ctx.state.hostPath, constants.DIR.GENERATE.PRETRAINED_MODE));
  helper.mkDir(path.resolve(ctx.state.hostPath, constants.DIR.GENERATE.OUT_DIR));
  helper.mkDir(path.resolve(ctx.state.hostPath, constants.DIR.GENERATE.EMB_DIR));
  helper.mkDir(path.resolve(ctx.state.hostPath, constants.DIR.GENERATE.CONDITION_IMAGE));
  helper.mkDir(path.resolve(ctx.state.hostPath, constants.DIR.GENERATE.MERGE_GROUP_LORA_PATH));
  helper.mkDir(path.resolve(ctx.state.hostPath, constants.DIR.GENERATE.MERGE_GROUP_PART_PATH));
  helper.mkDir(
    path.resolve(ctx.state.hostPath, constants.DIR.GENERATE.MERGE_GROUP_PLUGIN_CONTROLNET1_PATH)
  );
  helper.mkDir(path.resolve(ctx.state.hostPath, constants.DIR.TRAIN.YAML_FILE));
  helper.mkDir(path.resolve(ctx.state.hostPath, constants.DIR.TRAIN.EMB_DIR));
  helper.mkDir(path.resolve(ctx.state.hostPath, constants.DIR.TRAIN.PROMPT_TEMPLATE_DIR));
  helper.mkDir(path.resolve(ctx.state.hostPath, constants.DIR.TRAIN.PROMPT_FILE_DIR));

  helper.mkDir(path.resolve(ctx.state.hostPath, constants.DIR.HOST.UPLOAD));
  helper.mkDir(path.resolve(ctx.state.serverPath, constants.DIR.SERVER.SHELL_LOG));

  return next();
});

// static source
app.use((ctx, next) =>
  bodyparser({
    multipart: true,
    timeout: 120000, // 设置超时时间为 120000ms（2分钟）
    formidable: {
      uploadDir: ctx.state.uploadDir,
      keepExtensions: true,
      maxFileSize: 20 * 1024 * 1024, // 限制上传文件最大为 2MB
      // 避免文件重名
      onFileBegin: (name, file) => {
        file.path = `${ctx.state.uploadDir}/${Date.now()}-${file.name}`;
      }
    }
  })(ctx, next)
);
app.use((ctx, next) => serve(ctx.state.distDir)(ctx, next));
app.use((ctx, next) => serve(ctx.state.uploadDir)(ctx, next));
app.use((ctx, next) =>
  mount(constants.DIR.SERVER.STATIC_SOURCE.IMAGE, serve(ctx.state.hostPath))(ctx, next)
);

// 页面模版
app.use(
  views(__dirname + '/views', {
    extension: 'ejs'
  })
);

// 全局错误处理中间件
app.use(async (ctx, next) => {
  try {
    await next(); // 执行后面的中间件

    ctx.logger.info(`[${ctx.method}] ${ctx.url} - ${ctx.status}`); // 请求成功时记录 info 级别日志

    // 如果没有更多的中间件处理响应，而且请求路径没有匹配任何路由，则表示该路径不存在，返回 404 状态码
    if (ctx.status === 404) {
      ctx.throw(404);
    }
  } catch (error) {
    ctx.logger.error(`[${ctx.method}] ${ctx.url} - ${ctx.status} - ${error.message}`); // 请求失败时记录 error 级别日志

    // 如果中间件执行过程中出现错误，则根据错误状态码和消息返回响应
    ctx.body = {
      code: error.status || 500,
      status: 'fail',
      message: error.message
    };
  }
});

// 统一响应格式中间件
app.use(async (ctx, next) => {
  await next(); // 执行后面的中间件

  // 如果处理响应时没有遇到错误，则根据响应内容返回成功的响应
  if (ctx.status >= 200 && ctx.status < 300) {
    ctx.body = {
      code: 0,
      status: 'success',
      data: ctx.body
    };
  }
});

// logger
app.use(async (ctx, next) => {
  const start = new Date();
  await next();
  const ms = new Date() - start;
  console.log(`${ctx.method} ${ctx.url} - ${ms}ms`);
});

// routes
app.use(index.routes(), index.allowedMethods());
app.use(train.routes(), train.allowedMethods());
app.use(generate.routes(), generate.allowedMethods());
app.use(file.routes(), file.allowedMethods());
app.use(pt.routes(), pt.allowedMethods());
app.use(dataset.routes(), dataset.allowedMethods());

// error-handling
app.on('error', (err, ctx) => {
  console.error('server error', err, ctx);
});

module.exports = app;
