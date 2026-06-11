#!/usr/bin/env bash
# 本地一键部署：Worker + 前端（GitHub → Cloudflare Pages）
# 用法:
#   ./deploy.sh              部署 Worker，并推送前端（有改动时自动 commit）
#   ./deploy.sh worker       只部署 Worker
#   ./deploy.sh web          只推送前端
#   ./deploy.sh all "说明"   全部部署，自定义 commit 信息

set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
WORKER_URL="https://app-idea-lab-api.lixiao918918.workers.dev"
TARGET="${1:-all}"
COMMIT_MSG="${2:-deploy: update site}"

info()  { printf '\033[1;34m→\033[0m %s\n' "$*"; }
ok()    { printf '\033[1;32m✓\033[0m %s\n' "$*"; }
fail()  { printf '\033[1;31m✗\033[0m %s\n' "$*" >&2; exit 1; }

ensure_wrangler() {
  cd "$ROOT/worker"
  if ! npx wrangler whoami >/dev/null 2>&1; then
    info "未登录 Cloudflare，正在打开浏览器授权..."
    npx wrangler login
  fi
  if [[ ! -d node_modules ]]; then
    info "安装 Worker 依赖..."
    npm install
  fi
}

deploy_worker() {
  info "部署 Cloudflare Worker..."
  ensure_wrangler
  cd "$ROOT/worker"
  npx wrangler deploy
  info "验证 Worker /health ..."
  for i in 1 2 3 4 5; do
    if curl -sf --max-time 20 "${WORKER_URL}/health" | grep -q '"ok":true'; then
      ok "Worker 已上线: ${WORKER_URL}"
      return 0
    fi
    [[ $i -lt 5 ]] && sleep 5
  done
  ok "Worker 已部署（/health 暂未响应，可能仍在传播）: ${WORKER_URL}"
  info "请稍后在浏览器打开 ${WORKER_URL}/health 确认"
}

deploy_web() {
  cd "$ROOT"
  if [[ -z "$(git status --porcelain)" ]]; then
    info "前端无本地改动，跳过 commit"
  else
    info "提交并推送前端改动..."
    git add -A
    git commit -m "$COMMIT_MSG"
  fi
  info "推送到 GitHub（Cloudflare Pages 会自动构建）..."
  git push origin main
  ok "前端已推送，约 1～2 分钟后生效: https://idea.lx06.com"
}

case "$TARGET" in
  worker)
    deploy_worker
    ;;
  web)
    deploy_web
    ;;
  all|"")
    deploy_worker
    deploy_web
    ;;
  *)
    fail "未知参数: $TARGET（可用: worker | web | all）"
    ;;
esac

ok "部署完成"
