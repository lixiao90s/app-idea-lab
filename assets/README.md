# 游戏 UI 资源（来自 Raw/）

从 `Raw/` 挑选适合 Web 的资源，按用途分类存放。超大背景（>1MB）未拷贝，避免拖慢加载。

## 目录结构

| 目录 | 用途 | 来源 |
|------|------|------|
| `bg/` | 页面背景 | `backup.png`, `Result/Background3.png` |
| `brand/` | Logo、吉祥物 | `zi.png`, `cat.png` |
| `ui/` | 按钮、面板、进度条、边框 | `Result/*`, `Button*.png`, `setting/*` 等 |
| `ui/card-bg/` | 类别卡片底纹 | `cellBg/cell1~8.png` |

## 网页中的使用

- **Header**：`panel-headline.png` + `radial-shine.png` + 吉祥物
- **按钮**：`button-primary.png` / `button-secondary.png`
- **类别卡片**：`card-bg/cell*.png` + 扫描后 `card-selected.png`
- **详情面板**：`panel-result.png` / `panel-goal.png`
- **App 图标框**：`avatar-border.png`
- **进度条**：`progress-track.png` / `progress-fill.png`
- **排名 #1**：`rank-badge.png`

## 图标

类别与 UI 图标使用 [Lucide Icons](https://lucide.dev/) CDN，见 `js/data/genres.js` 与 `js/ui/icons.js`。
