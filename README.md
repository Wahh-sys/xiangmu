# 智航绿脉 · Cloudflare 版

绿色航运决策比赛演示网站，使用 Cloudflare Pages 托管前端、Pages Functions 处理登录与公开海况。无需单独租服务器、购买域名或配置数据库。

访客使用比赛演示账号 **admin / 123456**，无需注册。

## 目录

```text
public/                 网站页面、脚本、样式、地图素材及静态路由配置
functions/              Cloudflare 登录、会话、退出、公开海况接口
package.json            本地开发与命令行部署命令
package-lock.json       锁定开发工具依赖版本
wrangler.toml           Cloudflare Pages 配置
.dev.vars.example       本地环境变量模板，不含真实密钥
CLOUDFLARE部署说明.md    GitHub 到 Cloudflare 的操作步骤
```

## 发布

将本目录的内容放在 GitHub 仓库根目录，在 Cloudflare **Pages** 连接该仓库。框架选 None，构建命令 `exit 0`，输出目录 **public**，项目根目录留空。`functions/` 必须与 `public/` 同级，不能只上传网页文件。

在 Cloudflare 项目设置中添加加密变量 **SESSION_SECRET**（至少 32 字符的随机值），再部署一次。`wrangler.toml` 中的 `name` 应与 Cloudflare 项目名一致；默认是 `ecovoyager-demo`。使用 Cloudflare 分配的 `*.pages.dev` 地址即可访问。

详见 [CLOUDFLARE部署说明.md](CLOUDFLARE部署说明.md)。Cloudflare 网页端直接拖拽 ZIP 不会编译本项目的 Functions，请使用 GitHub 集成或 Wrangler。

## 本地开发（可选）

安装 Node.js 22 或以上版本。在本目录执行：

```powershell
npm ci
Copy-Item .dev.vars.example .dev.vars
# 编辑 .dev.vars，将 SESSION_SECRET 替换为随机密钥
npm run dev
```

访问终端显示的本地地址。命令行发布可用 `npx wrangler login` 后执行 `npm run deploy`，首次使用需按提示选择 Cloudflare 账号和 Pages 项目。

## 功能与数据

- 选择船舶、设置到港要求、比较三种方案、改变环境并查看推荐变化。
- 洋流与浪高支持季节估算和 Open-Meteo Marine 公开模型快照；16 个区域采样点插值，联网异常自动回退。成功响应在边缘节点缓存 30 分钟，失败缓存 60 秒；缓存并非全球共用。
- 台风和拥堵是可交互模拟事件；地图船队、油耗、排放和成本均用于比赛演示，不用于实际航行。
- 航次档案和设置保存在各自浏览器的 localStorage，换设备不共享，清除网站数据会丢失。CSV 报告由浏览器直接下载。
- 登录采用 HttpOnly 签名 Cookie，有效期 8 小时；退出清除当前浏览器 Cookie。无服务端会话数据库，因此已复制的有效 Cookie 不会因单次退出立刻失效；更换 SESSION_SECRET 并重新部署可使旧会话失效。
- 演示账号是公开共享账号，不应在本系统保存敏感资料。Cloudflare Functions 和上游数据接口受各自套餐、配额和服务可用性影响。

地图素材许可见 `public/assets/MAP-LICENSE.txt`。海况数据署名 Open-Meteo Marine / Copernicus，使用 CC BY 4.0；页面和报告已包含来源说明。
