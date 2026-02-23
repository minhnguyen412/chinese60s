// astro.config.mjs
import { defineConfig } from 'astro/config';
import remarkDirective from 'remark-directive';
import remarkChinese60s from './src/plugins/remark-chinese60s.mjs';
import rehypeSlug from 'rehype-slug';

export default defineConfig({
  markdown: {
    remarkPlugins: [
      remarkDirective,    // 1. parse :::directive syntax
      remarkChinese60s,   // 2. transform → styled HTML
    ],
    rehypePlugins: [
      rehypeSlug,         // 3. tự động thêm id vào tất cả heading từ text
    ],
  },
  base: '/blog',
  outDir: '../blog'
});
