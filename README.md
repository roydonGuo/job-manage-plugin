# 此刻 · Edge 日期时间插件

基于 Vue 3、TypeScript、Vite、shadcn-vue、Tailwind CSS 4 和 Manifest V3。在工具栏弹窗中查看实时时间、日期、星期、时区、下班倒计时和日薪，并接收工作日的下班通知。离线可用，不请求任何网站访问权限。

## 工作设置与下班提醒

点击主页右上角「设置」打开设置弹窗：

界面采用深蓝底色与冰紫强调色，首页以环形工作进度、下班倒计时和收入翻牌为主。提醒条目可直接打开通知设置；设置通过 shadcn-vue Tabs 分为「工作安排」与「提醒通知」，保留字段标签、正负数说明和错误提示。设置页在较矮窗口中滚动，底部取消与保存按钮保持可见。

- 工作日：支持周一到周日自由勾选，默认周一至周五。
- 上下班时间：默认 `09:30`、`18:30`，精确到分钟，支持当天班次。下班时间必须晚于上班时间。
- 日薪：以人民币元为单位，最多两位小数，默认 `0`；保存后在主页显示。
- 下班提醒：支持开启 / 关闭，默认提前 `10` 分钟；提前量不能超过当天工作时长。
- 下班打卡提醒：独立开关，默认关闭、偏移 `+5` 分钟。填写正数在下班后提醒（如 `5`），负数在下班前提醒（如 `-5`），`0` 在下班时提醒；支持 `-1440`～`1440` 的整数分钟。

点击「保存设置」后立即生效并持久保存；「取消」、右上角关闭按钮及 Esc 都会放弃当前未保存的修改。

主页使用 `HH:mm:ss` 显示距离当天下班时间的倒计时。上班前显示「尚未上班」，下班后倒计时归零，非工作日显示「今天休息」并归零。工作日依据每周配置判断，暂不自动识别法定节假日或调休。

「今日已赚」按 `日薪 × 当天已工作时长 ÷ 当天总工作时长` 计算，每秒从系统时间重新计算；关闭后重新打开仍能恢复正确金额。上班前和休息日为 0，下班后封顶为日薪，跨日后重新计算。金额展示保留两位小数，不足一分钱的部分向下取整，同时展示时薪、每秒收入和工作进度。当前按上下班之间的连续时长估算，未单独扣除午休。

金额采用比分牌式逐位翻转：发生变化的数字先翻下上半片，再展开新的下半片，未变化的数字和分隔符保持稳定；支持小数和整数进位，遵循系统「减少动态效果」设置。配合每秒收入提示和工作进度动画，界面图标按需引用 Lucide。

提醒由扩展 service worker 使用 `chrome.alarms` 调度，通知内容为 `还有xx分钟就下班了！`，关闭插件弹窗后仍可提醒。设置保存后会重新安排闹钟，关闭提醒会清除相关闹钟。同一工作日最多发送一次正式提醒；修改配置不会重置当天已发送记录。

打卡提醒与原下班提醒各自调度和去重，每个工作日各一次，可同时开启。例如 `+5` 分钟会提示「已下班5分钟，别忘了打卡！」，`-5` 分钟会提示「还有5分钟下班，记得打卡！」，`0` 会提示「下班时间到了，别忘了打卡！」。偏移跨午夜时按所属工作日计算，例如周五下班后的提醒落在周六，仍作为周五的提醒。设备恢复后仅在打卡提醒原定时间的一小时内补发，并按当时实际相对下班时间生成文案；超过一小时跳过。修改配置不重置当天已经发送过的打卡提醒。

设置中的铃铛图标对应下班提醒，打卡清单图标对应下班打卡提醒。两者各有独立的测试通知按钮。旧版配置升级时只补齐新的打卡字段，保留已有工作日、时间、日薪和原提醒。

系统通知需要 Edge 仍在运行，并允许 Edge 的系统通知。电脑休眠或浏览器关闭时无法准点展示通知；恢复时如果还在提醒时间段内，会按实际剩余分钟补发一次，下班后不再补发。浏览器闹钟属于尽力调度，可能延迟，勿作为必须精准触发的计时器。详见 [Alarms 官方说明](https://developer.chrome.com/docs/extensions/reference/api/alarms)。

安装到 Edge 后，可在设置中点击「发送测试通知」检查系统通知是否能正常显示；测试通知不会影响当天正式提醒。

## 本地开发

需要 Node.js 22.18+（建议 Node.js 24 LTS）和 npm。

```sh
npm install
npm run dev
```

打开终端给出的本地地址预览界面。网页预览使用 `localStorage` 保存设置，支持表单与倒计时，但不发送系统通知。Edge 插件使用 `chrome.storage.local`，与预览设置相互独立。安装到 Edge 时使用构建后的 `dist` 目录。

## 构建并安装到 Edge

```sh
npm run build
```

1. 在 Edge 地址栏输入 `edge://extensions`。
2. 打开「开发人员模式」。
3. 点击「加载解压缩的扩展」，选择本项目的 **dist** 目录。
4. 在工具栏「扩展」菜单中显示 / 固定「此刻 · 日期与时间」，点击图标查看。

修改代码后再次运行 `npm run build`，在扩展管理页点击插件的「重新加载」，然后重新打开弹窗。

从 0.1.0 升级到 0.2.0 增加了 `storage`（保存工作设置）、`alarms`（后台定时提醒）、`notifications`（系统通知）权限。如 Edge 提示确认新权限，请确认后再使用提醒功能。所有设置仅保存在本机。

也可以运行 `npm run build:watch` 自动生成构建文件；构建完成后仍需在 Edge 中重新加载插件。

## 检查

```sh
npm run typecheck
npm test
npm run build
```

自动化测试覆盖时间补零、跨年午夜、闰年、时区偏移、工作状态、配置校验、周末跳过、提醒调度、通知去重、worker 重启、关闭提醒、通知失败恢复、打卡提醒的正负与零偏移、跨午夜、独立开关和旧设置迁移。通知测试使用扩展 API 模拟，实际系统通知仍需在 Edge 验证。

Edge 手动验收：

1. 保存工作日、上下班时间、日薪和提醒分钟数，关闭弹窗并重新打开，检查设置仍在。
2. 点击「发送测试通知」，检查 Windows 通知实际出现。
3. 将今天选为工作日，上班时间设为当前时间之前，下班时间设为约两分钟后，提醒提前一分钟，保存后关闭弹窗，检查提醒到达。
4. 正式提醒同一天只发送一次，再次试验请使用「发送测试通知」。测试结束后还原工作设置。
5. 检查休息日和下班后倒计时归零，关闭提醒后不再接收正式通知。

## 代码结构

- `public/manifest.json`：插件配置；Vite 会原样复制到构建目录。
- `public/icons/`：可直接使用的 PNG 图标。
- `src/App.vue`：弹窗界面。
- `src/components/SettingsDialog.vue`：工作设置弹窗、表单校验和测试通知。
- `src/components/WorkTimePicker.vue`：由 shadcn-vue Popover、Select、Field 和 Button 组合的小时 / 分钟选择器，支持 00:00～23:59；取消或关闭不会应用未确认的时间。
- `src/components/EarningsCard.vue`：今日收入、日薪、时薪、每秒收入和数字动画，大额金额自动缩小以适应插件宽度。
- `src/components/FlipAmount.vue`、`FlipDigit.vue`：金额逐位比分牌翻转动画和进位对齐。
- `src/components/Hint.vue`、`IconHint.vue`：基于 shadcn-vue Tooltip 的图标悬停及键盘焦点说明。
- `src/components/ui/`：官方 CLI 生成的 shadcn-vue 组件，底层为 Reka UI。
- `src/composables/useClock.ts`：系统时间同步、秒边界刷新和事件清理。
- `src/utils/clock.ts`：日期、时间和时区格式化。
- `src/utils/work.ts`：工作设置、倒计时和提醒时间计算。
- `src/services/settings.ts`：插件存储与本地预览存储。
- `src/services/reminders.ts`：后台通知调度及去重。
- `src/background.ts`：扩展后台入口和事件注册。
- `src/style.css`：Tailwind 主题与基础样式，无远程字体或样式请求。
- `tests/`：时间边界和后台提醒测试。

组件来源：[shadcn-vue](https://github.com/unovue/shadcn-vue)，样式集成：[Tailwind CSS Vite 文档](https://tailwindcss.com/docs/installation/using-vite)。组件由官方 CLI 2.8.2 生成并保留在源码，组件生成器不作为项目依赖。`src/styles/shadcn.css` 为同版本官方工具样式的本地副本；授权见 `THIRD_PARTY_NOTICES.md`。

UI 控件统一使用 shadcn-vue：状态使用 Badge，弹窗使用 Dialog，设置分类使用 Tabs，工作进度使用扩展了环形样式的 Progress，表单使用 Field / FieldSet / FieldGroup / FieldLabel / FieldError，输入使用 Input，选择使用 Checkbox / Switch，按钮使用 Button，分隔线使用 Separator，提示使用 Alert，加载使用 Spinner。上下班时间由 shadcn 的 Popover、Select、Field 和 Button 组合实现，小时和分钟均使用 shadcn 下拉选项。布局、数据展示和普通文字使用语义 HTML 与 Tailwind，不在业务页面手写按钮、输入框或其它交互控件。

首页、设置页和时间选择弹层采用 Lucide 图标搭配必要文字：栏目名称、表单标签、单位、正负偏移规则和错误提示直接展示，辅助说明使用 Tooltip。图标按钮保留明确的无障碍名称。主题、字体和图标均在本地提供，无远程字体或图片依赖。

图标已生成并包含在项目中。Windows 下需要重新生成时，可运行 `powershell -ExecutionPolicy Bypass -File scripts/generate-icons.ps1`。

弹窗随浏览器的行为在失焦时关闭；重新打开会立即读取最新系统时间。后台使用事件驱动的 service worker，开启提醒时每分钟进行恢复检查，以适应休眠和时区变化。时间来源为设备时钟，不包含联网校时。

Manifest 配置参考：[Microsoft Edge 官方扩展文档](https://learn.microsoft.com/en-us/microsoft-edge/extensions/getting-started/manifest-format)。
