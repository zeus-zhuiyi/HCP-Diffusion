const router = require('koa-router')();

// 初始化入口，负责加载前端打包后的静态页面
router.get('/', async (ctx, next) => {
  await ctx.render('index.html');
});

module.exports = router;
