# 部署指南 — App Idea Lab

> **完整步骤：[手动操作指南.md](./手动操作指南.md)**

## 域名

- 工具站：**https://idea.lx06.com**（lx06.com 二级域名，无需新买域名）
- 游戏官网：https://lx06.com（保持不变）

## 快速步骤

1. **GitHub** → push 到 `lixiao90s/app-idea-lab`
2. **Worker** → KV + `npm run deploy` → 配置 `API_PROXY`
3. **Pages** → 连接 GitHub，Build 留空，Output `/`
4. **域名** → Pages 绑定 **`idea.lx06.com`**
5. **AdSense**（可选）→ 站点填 `idea.lx06.com`
6. **微信码**（可选）→ `assets/support/wechat-qr.png`

SEO 文件已预设 `idea.lx06.com`。

详细说明 → **[手动操作指南.md](./手动操作指南.md)**
