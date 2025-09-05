// 统一装配：稳定不动
(async () => {
  const res = await fetch('/modules/manifest.json', {cache:'no-cache'});
  const mf = await res.json();
  const M = mf.modules;

  // 动态加载模块
  const [core, ui, plots, glue, config] = await Promise.all([
    import(M.core), import(M.ui), import(M.plots), import(M.glue), import(M.config)
  ]);

  // 装配
  await core.init(config.default || config);
  ui.mount();
  plots.mount();

  // 绑定按钮
  ui.onStart(() => glue.run(core, plots, ui, config.default || config));
  ui.onPause(() => glue.pause());
  ui.onReset(() => glue.reset(core, plots, ui, config.default || config));
})();
