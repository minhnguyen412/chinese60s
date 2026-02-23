// src/content/config.ts
import { defineCollection, z } from 'astro:content'

const navLink = z.object({
  href:  z.string(),
  title: z.string(),
})

// ── BLOG collection ──────────────────────────────────────────────
const blog = defineCollection({
  type: 'content',
  schema: z.object({
    title:       z.string(),
    description: z.string().optional().default(''),
    tag:         z.string().optional().default('📚 Learning Guide'),
    date:        z.string().optional().default('2025'),
    readTime:    z.string().optional().default('5 min read'),
    author:      z.string().optional().default('Chinese60s Team'),
    heroChar:    z.string().optional().default('学'),
    toc: z.array(z.object({ id: z.string(), label: z.string() })).optional().default([]),
    prevPost: navLink.optional(),
    nextPost: navLink.optional(),
  }),
})

// ── DOUYIN collection ────────────────────────────────────────────
// imagesData KHÔNG còn trong schema — data được fetch từ /public/data/imagesData.json

const scriptLines = z.object({
  cn: z.array(z.string()),
  py: z.array(z.string()),
  en: z.array(z.string()),
})

const douyin = defineCollection({
  type: 'content',
  schema: z.object({
    title:        z.string(),
    description:  z.string().optional().default(''),
    tag:          z.string().optional().default('🎬 Douyin Script'),
    date:         z.string().optional().default('2025'),
    readTime:     z.string().optional().default('6 min read'),
    level:        z.string().optional().default('HSK 2–3 Level'),
    heroChar:     z.string().optional().default('学'),
    heroBg:       z.string().optional().default('var(--yellow-pale)'),
    lead:         z.string().optional().default(''),
    toc:          z.array(z.object({ id: z.string(), label: z.string() })).optional().default([]),
    script:       scriptLines,
    vocab: z.array(z.object({
      word:    z.string(),
      pinyin:  z.string(),
      meaning: z.string(),
    })).optional().default([]),
    grammar: z.array(z.object({
      id:      z.string(),
      title:   z.string(),
      body:    z.string(),
      example: z.string().optional(),
      note:    z.string().optional(),
    })).optional().default([]),
    quickVocab: z.array(z.object({
      cn:     z.string(),
      pinyin: z.string(),
      def:    z.string(),
    })).optional().default([]),
    relatedPosts: z.array(z.object({
      href:  z.string(),
      num:   z.union([z.number(), z.string()]),
      label: z.string(),
    })).optional().default([]),
    ctaItems: z.array(z.string()).optional().default([]),
    prevPost: navLink.optional(),
    nextPost: navLink.optional(),
  }),
})

export const collections = { blog, douyin }
