#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
既存のジン記事（../gin_chapters/*.md）を読み込み、
ジン教本アプリ用のデータファイル content.js を生成する。

中身を加筆・修正したいときは、元の Markdown（../gin_chapters/*.md）を
編集してから、このスクリプトを再実行すれば content.js が更新される。

  python3 build_content.py
"""

import os
import re
import json
import html

# 章ファイル（読み込む順番に並べる）
SRC_FILES = [
    "../gin_chapters/chapter_01_02.md",
    "../gin_chapters/chapter_03_04.md",
    "../gin_chapters/chapter_05_06.md",
    "../gin_chapters/chapter_07_08.md",
    "../gin_chapters/chapter_09_13.md",
    "../gin_chapters/chapter_16_17.md",
]

# 章ごとのカテゴリ（クイズ道場・色分けで使用）
CHAPTER_CATEGORY = {
    1: "basics", 2: "history", 3: "production", 4: "botanical",
    5: "classification", 6: "brands", 7: "japan", 8: "tasting",
    9: "culture", 10: "guide", 11: "market", 12: "gintonic",
    13: "homemade", 14: "service", 15: "service", 16: "tasting",
}

HERE = os.path.dirname(os.path.abspath(__file__))


def esc(text):
    return html.escape(text, quote=False)


def render_inline(text):
    """太字・コードなどのインライン記法をHTML化する。"""
    text = esc(text)
    # **太字**
    text = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", text)
    # `コード`
    text = re.sub(r"`(.+?)`", r"<code>\1</code>", text)
    return text


def render_table(rows):
    """Markdownテーブル（行のリスト）をHTMLテーブルに変換。"""
    cells = [[c.strip() for c in r.strip().strip("|").split("|")] for r in rows]
    # 2行目が区切り（---）かどうか
    header = cells[0]
    body = cells[2:] if len(cells) > 1 and re.match(r"^[\s:\-]+$", "".join(cells[1])) else cells[1:]
    out = ['<div class="table-wrap"><table>']
    out.append("<thead><tr>" + "".join(f"<th>{render_inline(c)}</th>" for c in header) + "</tr></thead>")
    out.append("<tbody>")
    for row in body:
        out.append("<tr>" + "".join(f"<td>{render_inline(c)}</td>" for c in row) + "</tr>")
    out.append("</tbody></table></div>")
    return "".join(out)


def md_to_html(lines):
    """Markdownの行リストをHTML文字列に変換する（章タイトル#は除外済み）。"""
    out = []
    i = 0
    n = len(lines)
    para = []

    def flush_para():
        if para:
            out.append("<p>" + render_inline(" ".join(para)).strip() + "</p>")
            para.clear()

    while i < n:
        line = lines[i].rstrip("\n")
        stripped = line.strip()

        # テーブル
        if stripped.startswith("|") and "|" in stripped[1:]:
            flush_para()
            tbl = []
            while i < n and lines[i].strip().startswith("|"):
                tbl.append(lines[i])
                i += 1
            out.append(render_table(tbl))
            continue

        # 見出し（## → h3, ### → h4, #### → h5）
        m = re.match(r"^(#{2,5})\s+(.*)$", stripped)
        if m:
            flush_para()
            level = len(m.group(1)) + 1  # ## は h3
            level = min(level, 5)
            title = m.group(2).strip()
            anchor = re.sub(r"[^\w぀-ヿ一-鿿]+", "-", title).strip("-")
            out.append(f'<h{level} id="sec-{anchor}">{render_inline(title)}</h{level}>')
            i += 1
            continue

        # 水平線
        if re.match(r"^-{3,}$", stripped) or re.match(r"^\*{3,}$", stripped):
            flush_para()
            out.append("<hr>")
            i += 1
            continue

        # 引用
        if stripped.startswith(">"):
            flush_para()
            quote = []
            while i < n and lines[i].strip().startswith(">"):
                quote.append(lines[i].strip().lstrip(">").strip())
                i += 1
            out.append("<blockquote>" + render_inline(" ".join(quote)) + "</blockquote>")
            continue

        # 箇条書き（- / * / 数字.）
        if re.match(r"^(\s*)([-*]|\d+\.)\s+", line):
            flush_para()
            ordered = bool(re.match(r"^\s*\d+\.\s+", line))
            tag = "ol" if ordered else "ul"
            items = []
            while i < n and re.match(r"^(\s*)([-*]|\d+\.)\s+", lines[i]):
                item = re.sub(r"^(\s*)([-*]|\d+\.)\s+", "", lines[i].rstrip("\n"))
                items.append("<li>" + render_inline(item) + "</li>")
                i += 1
            out.append(f"<{tag}>" + "".join(items) + f"</{tag}>")
            continue

        # 空行
        if stripped == "":
            flush_para()
            i += 1
            continue

        # 通常の段落行
        para.append(stripped)
        i += 1

    flush_para()
    return "\n".join(out)


def split_chapters(text):
    """ファイルテキストを # 第N章 単位で分割する。"""
    chapters = []
    lines = text.split("\n")
    cur = None
    for line in lines:
        m = re.match(r"^#\s+第(\d+)章[:：]?\s*(.*)$", line)
        if m:
            if cur:
                chapters.append(cur)
            num = int(m.group(1))
            title = m.group(2).strip()
            cur = {"num": num, "title": title, "lines": []}
        elif cur is not None:
            cur["lines"].append(line)
    if cur:
        chapters.append(cur)
    return chapters


def extract_sections(lines):
    """章内の ## 見出し（節）を抽出。目次・検索用。"""
    secs = []
    for line in lines:
        m = re.match(r"^##\s+(.*)$", line.strip())
        if m:
            secs.append(m.group(1).strip())
    return secs


def plain_text(lines):
    """検索用のプレーンテキスト（記法を除去）。"""
    text = "\n".join(lines)
    text = re.sub(r"[#*`>|]", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def main():
    chapters = []
    for rel in SRC_FILES:
        path = os.path.join(HERE, rel)
        with open(path, encoding="utf-8") as f:
            text = f.read()
        for ch in split_chapters(text):
            num = ch["num"]
            chapters.append({
                "num": num,
                "title": ch["title"],
                "category": CHAPTER_CATEGORY.get(num, "basics"),
                "sections": extract_sections(ch["lines"]),
                "html": md_to_html(ch["lines"]),
                "text": plain_text(ch["lines"])[:6000],
            })

    chapters.sort(key=lambda c: c["num"])

    out_path = os.path.join(HERE, "content.js")
    with open(out_path, "w", encoding="utf-8") as f:
        f.write("// 自動生成ファイル — build_content.py により ../gin_chapters/*.md から生成\n")
        f.write("// 中身を変えたいときは元のMarkdownを編集して再実行すること。\n")
        f.write("window.GIN_CONTENT = ")
        json.dump(chapters, f, ensure_ascii=False, indent=0)
        f.write(";\n")

    total = sum(len(c["html"]) for c in chapters)
    print(f"生成完了: {out_path}")
    print(f"章数: {len(chapters)}  HTML合計: {total:,} 文字")
    for c in chapters:
        print(f"  第{c['num']}章 {c['title']}  （節 {len(c['sections'])}）")


if __name__ == "__main__":
    main()
