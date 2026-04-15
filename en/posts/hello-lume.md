---
title: "How I Built This Blog with Lume"
description: "The story of building this blog with Lume, a Deno-powered SSG, plus a walkthrough of its features and setup."
date: 2026-02-12T10:00:00
tags: [Lume, Deno, SSG]
author: 逆瀬川ちゃん
lang: en
---

Hi there! This is Sakasegawa-chan!

Today I want to talk about Lume, the SSG I used to build this blog. It's also my first post here, so I'll throw in a short self-introduction along the way.

<!--more-->

## About this blog

This is Sakasegawa-chan's tech blog. Most of the posts are written with the help of coding agents. I plan to write up whatever I've been learning or any tech topics that catch my eye.

So, to start a blog, you first need a blog foundation. There are a ton of SSGs (Static Site Generators) out there, and this time I went with Lume.

## Why Lume?

There are a lot of SSG options. Here's a rough comparison.

| SSG | Language | Notes |
|-----|----------|-------|
| Hugo | Go | Blazing fast builds. Template syntax is a bit quirky |
| Eleventy | Node.js | Very flexible. Config is in JS |
| Astro | Node.js | Islands Architecture. Great for rich UIs |
| Lume | Deno | Simple. No node_modules. Flexible |

Hugo and Eleventy are also great SSGs, but here's why I picked Lume this time:

- No node_modules. Deno's HTTPS imports fetch only what you actually need
- Setup finishes in a single command
- Themes are provided, so you can spin up a blog immediately
- Plenty of template engine choices (Markdown, Vento, Nunjucks, JSX, Pug, etc.)
- It doesn't emit any client-side JS. The output is just plain static HTML

The "no node_modules" part is especially nice. Since it's Deno-based, you just run `deno run` and it works. Freedom from dependency management pain.

## Setting up Lume

Setup is genuinely simple. If you already have Deno installed, one command spins up a project.

```bash
# Install Deno (if you haven't yet)
curl -fsSL https://deno.land/install.sh | sh

# Initialize a Lume project (with the Simple Blog theme)
deno run -A https://lume.land/init.ts --theme=simple-blog
```

That gives you this file layout:

```
project/
├── _config.ts     # Lume config file
├── _data.yml      # Site-wide metadata
├── deno.json      # Deno config (includes task definitions)
├── posts/         # Directory for blog posts
├── 404.md         # 404 page
└── favicon.png    # Favicon
```

And here's the entire contents of `_config.ts`:

```typescript
import lume from "lume/mod.ts";
import blog from "blog/mod.ts";

const site = lume();
site.use(blog());

export default site;
```

Just four lines. This kind of simplicity is what makes Lume great. The theme sets up all the plugins you need behind the scenes (Markdown processing, date formatting, feed generation, on-site search, and so on).

Once the project is ready, let's start the dev server.

```bash
deno task serve
```

Open `http://localhost:3000` and the blog shows up. Hot reload is on by default, so edits are reflected instantly.

## How to write posts

Posts are Markdown files placed in the `posts` directory. You describe metadata via frontmatter.

```markdown
---
title: "Post title"
description: "Post description"
date: 2026-02-12
tags: [Lume, Deno]
author: 逆瀬川ちゃん
---

And then the body goes here.
```

If you insert a `<!--more-->` tag in the body, everything above it becomes the excerpt shown on the top page. It gives you the classic "read more" behavior in the post list, which is handy.

## Deploying to GitHub Pages

This blog is hosted on GitHub Pages. The entire build and deploy pipeline runs on GitHub Actions, so publishing is just a matter of pushing a post.

The workflow file looks like this:

```yaml
name: Build and deploy
on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: denoland/setup-deno@v2
      - run: deno task build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: _site
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
    steps:
      - uses: actions/deploy-pages@v4
```

Deno has an official GitHub Action, so setup is painless. `deno task build` emits the static files into `_site`, and all this workflow does is upload that directory to GitHub Pages.

## Wrap-up

- Lume is a Deno-based SSG with a satisfying set of tradeoffs: no node_modules, one-command setup, and zero client JS
- With the Simple Blog theme, you can go from setup to deployment in under 30 minutes
- I'll be writing about various tech topics on this blog going forward, so thanks for stopping by

## References

- [Lume - Static site generator for Deno](https://lume.land/)
- [lumeland/lume - GitHub](https://github.com/lumeland/lume)
- [Simple Blog Theme - Lume](https://lume.land/theme/simple-blog/)
- [How to build a static site with Lume - Deno Blog](https://deno.com/blog/build-a-static-site-with-lume)
