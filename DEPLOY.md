# 部署指南 — App Idea Lab

## 一、GitHub（需手动）

GitHub MCP 当前 Token 无 `repo` 权限，请手动完成：

1. 在 https://github.com/new 创建仓库 `app-idea-lab`（Public）
2. 本地推送：

```bash
cd /Users/lixiao/MyWorkSpace/WebProjs/appstore-idea-find-main
git init
git add .
git commit -m "Commercial deployment: worker cache, heat, downloads, ads slots"
git branch -M main
git remote add origin https://github.com/lixiao90s/app-idea-lab.git
git push -u origin main
```

或在 Cursor 设置中为 GitHub MCP 开启 **repo** 权限后重试自动推送。

---

## 二、Cloudflare KV + Worker（需手动）

Cloudflare MCP / wrangler 需要 `CLOUDFLARE_API_TOKEN`。

### 2.1 创建 API Token

1. 打开 https://dash.cloudflare.com/profile/api-tokens
2. 创建 Token，权限：**Account → Workers Scripts → Edit**，**Account → Workers KV Storage → Edit**
3. 终端执行：

```bash
export CLOUDFLARE_API_TOKEN=你的token
cd worker
npm install
npm run kv:create
```

3. 复制输出的 `id`，填入 `worker/wrangler.toml` 的 `YOUR_KV_NAMESPACE_ID`

### 2.2 部署 Worker

```bash
cd worker
npm run deploy
```

记录输出的 URL，例如：`https://app-idea-lab-api.xxx.workers.dev`

### 2.3 配置 Cron（wrangler.toml 已含 `0 */6 * * *`）

部署后自动生效，每 6 小时预抓取 27 个类别。

### 2.4 更新前端 API 地址

编辑 `js/data/constants.js`：

```javascript
API_PROXY: 'https://app-idea-lab-api.xxx.workers.dev',
```

提交并推送。

---

## 三、Cloudflare Pages（需手动）

1. Dashboard → **Workers & Pages** → **Create** → **Pages** → Connect to Git
2. 选择 `lixiao90s/app-idea-lab`
3. 构建设置：
   - Build command：**留空**
   - Build output directory：**/**（根目录）
4. Deploy
5. 可选：绑定自定义域名

---

## 四、Google AdSense（需手动）

1. 申请 https://www.google.com/adsense/
2. 审核通过后，编辑 `js/data/constants.js`：

```javascript
ADS_ENABLED: true,
ADSENSE_CLIENT: 'ca-pub-xxxxxxxxxxxxxxxx',
```

3. 在 AdSense 后台为各广告位创建对应单元（或使用自动广告）
4. 确保 `privacy.html` 可访问（已创建）

---

## 五、SEO（需手动）

部署后替换 `robots.txt` 和 `sitemap.xml` 中的 `YOUR_DOMAIN` 为实际域名。

---

## 六、验证清单

- [ ] `https://你的Worker/health` 返回 `{"ok":true}`
- [ ] 首页点击类别能加载排行榜
- [ ] App 详情能加载评论
- [ ] 搜索显示搜索热度徽章
- [ ] 详情页显示下载量估算三档
- [ ] AdSense 广告位显示（启用后）
