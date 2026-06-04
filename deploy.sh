#!/bin/bash
# ============================================================
# Bar Soutsu ジン教本 — ワンコマンド公開スクリプト
#
# これ1つで「本文の作り直し → キャッシュ版数上げ → コミット → 公開」を
# まとめて実行します。手順の忘れ（特に版数上げ忘れ）を防ぎます。
#
# 使い方（gin-textbook フォルダ内で）:
#   ./deploy.sh "更新メモ"      ← 本番公開する
#   ./deploy.sh                 ← メッセージ省略（日時が自動で入る）
#   ./deploy.sh --dry-run       ← 公開せず「何が起きるか」だけ確認
#
# ※ deploy は「いま変更されている全ファイル」を公開します。
#   途中の作業を公開したくないときは実行しないでください。
# ============================================================
set -e
cd "$(dirname "$0")"   # スクリプトのある gin-textbook フォルダへ移動

DRYRUN=0
if [ "$1" = "--dry-run" ]; then DRYRUN=1; shift; fi
MSG="${1:-サイト更新 $(date '+%Y-%m-%d %H:%M')}"

echo "▶ 本文を作り直しています（build_content.py）..."
python3 build_content.py >/dev/null
echo "  完了"

CHANGED="$(git status --porcelain)"
if [ -z "$CHANGED" ]; then
  echo "変更はありません。公開をスキップします。"
  exit 0
fi

# キャッシュ版数を1つ上げる関数（$1=service-workerのパス, $2=接頭辞）
bump() {
  local f="$1" pre="$2" n next
  n="$(grep -oE "${pre}-v[0-9]+" "$f" | head -1 | grep -oE '[0-9]+')"
  next=$((n + 1))
  if [ "$DRYRUN" = "1" ]; then
    echo "  （予定）${pre}: v${n} → v${next}"
  else
    sed -i '' "s/${pre}-v${n}/${pre}-v${next}/" "$f"
    echo "  ${pre}: v${n} → v${next}"
  fi
}

echo "▶ 変更内容に応じてキャッシュ版数を更新..."
# 本体（本文・用語集・見た目など、ルート直下のファイル）
echo "$CHANGED" | grep -qE '^.. (content\.js|glossary\.js|styles\.css|app\.js|index\.html|manifest\.json)$' && bump service-worker.js ginbook || true
# クイズ
echo "$CHANGED" | grep -qE '^.. quiz\.js$' && bump quiz/service-worker.js ginquiz || true
# チートシート
echo "$CHANGED" | grep -qE '^.. cheatsheet\.js$' && bump cheatsheet/service-worker.js gincheat || true

echo "▶ 公開する変更ファイル:"
git status --short

if [ "$DRYRUN" = "1" ]; then
  echo "（ドライラン）ここで終了。実際に公開するには引数なしで実行してください。"
  exit 0
fi

echo "▶ コミットして公開（push）します..."
git add -A
git commit -m "$MSG" >/dev/null
git push origin main
echo "✅ 公開しました： https://sousuyou.github.io/gin-textbook/  （反映まで1〜2分）"
