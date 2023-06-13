const router = require('koa-router')();
const path = require('path');
const helper = require('../helper');
const constants = require('../constants');

router.prefix('/api/v1/file');

router.post('/upload', function (ctx, next) {
  // 获取上传的文件
  const file = ctx.request.files.file;
  // 获取文件路径
  const filePath = file.path.split(path.sep).slice(-1).join(path.sep);
  // 将文件路径暴露给浏览器可以访问到的 URL
  ctx.body = {
    url: filePath
  };
});

// 查询目录文件列表接口
router.get('/dir', function (ctx, next) {
  const { dirPath = '', fileTypes, dropSuffix = false } = constants.PATH[ctx.query.path] || {}; // 获取 query 参数 path 的值
  let files = [];
  if (dirPath) {
    const hostPath = ctx.state.hostPath;
    files = dirPath ? helper.readDirFilesToMap(hostPath, dirPath, fileTypes, dropSuffix) : [];
  }

  ctx.body = {
    files
  };
});

module.exports = router;
