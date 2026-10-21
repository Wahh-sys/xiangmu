# 智航绿脉：发布到 Cloudflare Pages

本项目已改为 Cloudflare Pages + Pages Functions。你不需要阿里云服务器、Render、Docker 或自有域名。下面使用 GitHub 自动部署方式。

## 1. 更新 GitHub 仓库

打开 `D:\项目\ship-demo`，把里面的内容放到 GitHub 仓库根目录。若继续用之前的 `ecovoyager-demo` 仓库，应当替换旧版本并删除仓库中旧的部署文件。GitHub“上传文件”只会添加或覆盖同名文件，不会自动删除旧文件。

上传后的仓库首页应直接看到：

```text
public/
functions/
.dev.vars.example
.gitattributes
.gitignore
package.json
package-lock.json
wrangler.toml
README.md
CLOUDFLARE部署说明.md
```

不要把整个 `ship-demo` 文件夹套在仓库里面，也不要只上传 `public`。不要上传 `node_modules`、`.wrangler`、`.dev.vars`、ZIP 备份或密钥。旧的 Python、Docker、Render 文件和启动批处理已不再需要。

如用部署包：先解压，再上传解压后的内容到 GitHub。不要在 Cloudflare 网页端直接拖入这个 ZIP，因为该方式不会编译本项目的 `functions/`。

## 2. 在 Cloudflare 选择 Pages

注册并登录 Cloudflare，进入 **Workers & Pages**，点击创建应用，切换到 **Pages**，选择连接 GitHub / 导入现有 Git 仓库。若首先看到 Worker 的部署表单，返回并找到 Pages 入口。

授权 Cloudflare 访问目标仓库，选择你的项目。填写：

| 设置项 | 填写内容 |
| --- | --- |
| 项目名称 | `ecovoyager-demo`，或你选定的可用名称 |
| 生产分支 | `main`，以仓库实际默认分支为准 |
| 框架预设 | `None` / 无 |
| 构建命令 | `exit 0` |
| 构建输出目录 | `public` |
| 根目录 | 留空，表示仓库根目录 |

`wrangler.toml` 中的 `name = "ecovoyager-demo"` 要与 Cloudflare 项目名称一致；若名称被占用，选一个新名称并同步修改该配置。不要把输出目录填成 `/`、`dist` 或 `functions`。

本项目没有前端编译步骤，平台会单独编译根目录下的 Pages Functions。构建环境如需指定 Node.js，使用 22 或以上版本。

## 3. 添加会话密钥

创建项目后，打开 **Settings → Variables and Secrets**，添加：

| 名称 | 类型 | 值 |
| --- | --- | --- |
| `SESSION_SECRET` | Secret / 加密 | 至少 32 字符的随机字符串 |

该值用于给登录会话签名，与演示账号密码不同。可以在本机 PowerShell 运行以下命令，生成一个 64 字符随机值：

```powershell
$sessionBytes = New-Object byte[] 32
$sessionRng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$sessionRng.GetBytes($sessionBytes)
$sessionRng.Dispose()
([System.BitConverter]::ToString($sessionBytes)).Replace('-', '').ToLowerInvariant()
```

将输出值复制到 Cloudflare 加密变量中，不要写入 GitHub。确认环境为 **Production**；若要使用分支预览地址，也给 **Preview** 配置独立随机密钥。

保存后重新部署：在 Deployments 中重试部署，或向 GitHub 提交一次修改触发新部署。变量变更需要在新部署中生效。未设置密钥时，登录会明确提示配置 `SESSION_SECRET`，这是配置未完成。

## 4. 打开公网地址

等部署状态为成功后，打开 Cloudflare 显示的 **生产地址**，通常为 `https://你的项目名.pages.dev`。以控制台实际地址为准，不需要购买域名。

访客账号：**admin**；密码：**123456**。登录页可直接填入演示账号，无需注册。

先用无痕窗口检查登录，再把生产地址发送给评委或同学。`pages.dev` 的实际可访问性和速度取决于访客网络，比赛前请用现场网络试一次。

## 5. 按这个顺序演示

1. 登录后点击“载入推荐变化示例”。
2. 查看所选船舶和到港要求，比较经济、时效、安全三种方案。
3. 点击“切换冬夏海况并重新比较”，观察推荐从经济优先转为安全优先。
4. 尝试台风预演、应用事件、恢复原情景。
5. 获取公开海况后重新生成方案，或使用离线可用的季节估算。
6. 导出 CSV，进入航次档案查看、恢复历史结果。

## 常见问题

| 现象 | 检查方法 |
| --- | --- |
| 登录提示设置 SESSION_SECRET | 给当前部署环境设置加密变量，至少 32 字符，并重新部署 |
| 页面能打开，但登录接口 404 | 必须通过 Pages Git 集成或 Wrangler 部署，并保留仓库根目录 functions/ |
| 项目名与配置不一致 | 修改 wrangler.toml 的 name，提交后再部署 |
| 构建找不到文件或页面 404 | 仓库根目录直接放 public/functions，输出目录填 public |
| 海况获取失败 | 系统会回退季节估算；检查上游网络和平台配额，核心演示仍可继续 |
| 别人的航次档案为空 | 档案保存在每个人自己的浏览器，不是共享数据库 |
| 更新代码后仍看到旧页面 | 确认最新生产部署成功，刷新页面，并使用控制台的生产地址 |

## 已做的检查与发布边界

代码已通过 Wrangler 本地 Pages 编译、62 项接口及运行时检查、桌面和手机浏览器交互检查；本机还成功获取过一次真实 Open-Meteo 海况。测试不代表所有网络和未来上游服务均可用。

此文件和部署包是部署准备结果。公网服务需要在你自己的 Cloudflare 账号连接仓库、配置密钥并完成部署后才会生成。后续向同一 GitHub 分支提交更改即可触发更新。

Cloudflare 官方说明：[Git 集成](https://developers.cloudflare.com/pages/get-started/git-integration/)、[Functions 路由](https://developers.cloudflare.com/pages/functions/routing/)、[密钥设置](https://developers.cloudflare.com/pages/functions/bindings/#secrets)。
