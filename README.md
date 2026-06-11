# App Idea Lab

App Store 机会发现工具 — 支持下载量估算、搜索热度、Cloudflare Worker 全站缓存。

基于 [appstore-idea-find](https://github.com/vccyb/appstore-idea-find) 改造。

## 架构

- **前端**：Cloudflare Pages（静态 HTML/JS/CSS）
- **API 代理**：Cloudflare Worker `worker/api-proxy.js`（KV 缓存 + 限流 + Cron 预抓取）

## 本地开发

1. 用任意静态服务器打开根目录
2. 部署 Worker 后，在 `js/data/constants.js` 设置 `API.API_PROXY`

## Worker 部署

```bash
cd worker
npx wrangler kv namespace create CACHE
# 将返回的 id 填入 wrangler.toml
npx wrangler deploy
```

## 配置

| 变量 | 文件 | 说明 |
|------|------|------|
| `API.API_PROXY` | `js/data/constants.js` | Worker URL |
| `CONFIG.ADS_ENABLED` | `js/data/constants.js` | 广告开关 |
| `CONFIG.ADSENSE_CLIENT` | `js/data/constants.js` | AdSense ca-pub ID |

## License

See upstream project for license terms.
