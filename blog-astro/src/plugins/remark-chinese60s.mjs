// src/plugins/remark-chinese60s.mjs
// Chuyển đổi custom directives trong Markdown → HTML có class/style của Chinese60s
//
// Cài đặt: npm install remark-directive
// Thêm vào astro.config.mjs:
//   import remarkDirective from 'remark-directive';
//   import remarkChinese60s from './src/plugins/remark-chinese60s.mjs';
//   markdown: { remarkPlugins: [remarkDirective, remarkChinese60s] }

import { visit } from 'unist-util-visit';
import { h } from 'hastscript';

/**
 * Các directive được hỗ trợ:
 *
 * :::lead
 * Đoạn văn dẫn nhập nổi bật (nền xanh nhạt)
 * :::
 *
 * :::tip
 * Hộp gợi ý màu vàng (icon mặc định 💡)
 * :::
 *
 * :::tip{icon="✅"}
 * Hộp gợi ý với icon tuỳ chọn
 * :::
 *
 * :::tip{style="background:var(--green-pale)"}
 * Hộp gợi ý với nền tuỳ chọn
 * :::
 *
 * :::step{num="1" id="step1" title="Tiêu đề bước"}
 * Nội dung mô tả bước
 * :::
 */
export default function remarkChinese60s() {
  return (tree) => {
    visit(tree, (node) => {
      // Chỉ xử lý containerDirective (:::name ... :::)
      if (node.type !== 'containerDirective') return;

      const name  = node.name;
      const attrs = node.attributes || {};

      /* ─── :::lead ─── */
      if (name === 'lead') {
        node.data = node.data || {};
        node.data.hName = 'div';
        node.data.hProperties = { class: 'lead' };
        return;
      }

      /* ─── :::tip ─── */
      if (name === 'tip') {
        const icon       = attrs.icon || '💡';
        const extraStyle = attrs.style || '';

        node.data = node.data || {};
        node.data.hName = 'div';
        node.data.hProperties = {
          class: 'tip-box',
          'data-icon': icon,
          ...(extraStyle ? { style: extraStyle } : {}),
        };

        // Chèn span icon làm node con đầu tiên
        node.children.unshift({
          type: 'html',
          value: `<span class="tip-icon">${icon}</span>`,
        });
        return;
      }

      /* ─── :::step ─── */
      if (name === 'step') {
        const num   = attrs.num   || '?';
        const id    = attrs.id    || '';
        const title = attrs.title || '';

        node.data = node.data || {};
        node.data.hName = 'div';
        node.data.hProperties = {
          class: 'step-card',
          ...(id ? { id } : {}),
        };

        // Bọc nội dung gốc trong .step-body, thêm .step-num và h4 title
        node.children = [
          {
            type: 'html',
            value: `<div class="step-num">${num}</div><div class="step-body"><h4>${title}</h4>`,
          },
          ...node.children,
          {
            type: 'html',
            value: `</div>`,
          },
        ];
        return;
      }
    });
  };
}
