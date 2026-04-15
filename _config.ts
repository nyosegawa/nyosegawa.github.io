import lume from "lume/mod.ts";
import blog from "blog/mod.ts";
import katex from "lume/plugins/katex.ts";
import redirects from "lume/plugins/redirects.ts";

const site = lume({
  location: new URL("https://nyosegawa.com"),
});

site.use(katex());
site.use(blog({
  date: {
    formats: {
      HUMAN_DATE: "yyyy-MM-dd",
    },
  },
}));
site.use(redirects({ output: "html" }));

// Override theme's archive_result.page.js to fix empty tag/author bug
site.ignore("archive_result.page.js");
site.ignore("README.md");
site.ignore("draft");

// Theme's index.vto is overridden by our local index.vto (portfolio page)

// Copy static assets to output
site.copy("og");
site.copy("img");
site.copy("CNAME");
site.copy("icon.png");

// Auto-set OG image for posts based on slug. JA uses /og/{slug}.jpg, EN uses /og/en/{slug}.jpg
site.preprocess([".md"], (pages) => {
  for (const page of pages) {
    if (page.data.image) continue;
    if (page.src.path.startsWith("/posts/")) {
      const slug = page.src.path.replace(/^\/posts\//, "");
      if (slug) page.data.image = `/og/${slug}.jpg`;
    } else if (page.src.path.startsWith("/en/posts/")) {
      const slug = page.src.path.replace(/^\/en\/posts\//, "");
      if (slug) page.data.image = `/og/en/${slug}.jpg`;
    }
  }
});

// Compute CSS hash for cache busting
let cssHash = "";
site.process([".css"], (pages) => {
  for (const page of pages) {
    if (page.data.url === "/styles.css") {
      const content = page.content as string;
      let hash = 0;
      for (let i = 0; i < content.length; i++) {
        hash = ((hash << 5) - hash + content.charCodeAt(i)) | 0;
      }
      cssHash = (hash >>> 0).toString(16);
      break;
    }
  }
});

// Post-process HTML
site.process([".html"], (pages) => {
  // Collect all URLs to determine if a translated counterpart exists for each page
  const urlSet = new Set(pages.map((p) => p.data.url).filter(Boolean));

  // Compute the alt-language URL of a given URL.
  // / ↔ /en/, /posts/foo/ ↔ /en/posts/foo/, etc.
  const computeAltUrl = (u: string) => {
    if (u.startsWith("/en/")) return u.slice(3);
    if (u === "/en") return "/";
    return "/en" + u;
  };

  const SITE_NAMES = {
    ja: { home: "逆瀬川ちゃんのほーむぺーじ", blog: "逆瀬川ちゃんのブログ" },
    en: { home: "Sakasegawa's Homepage", blog: "Sakasegawa's Blog" },
  };

  for (const page of pages) {
    const doc = page.document;
    if (!doc) continue;

    // Cache-bust CSS with content hash
    if (cssHash) {
      const cssLink = doc.querySelector("link[href='/styles.css']");
      if (cssLink) {
        cssLink.setAttribute("href", `/styles.css?v=${cssHash}`);
      }
    }

    const title = doc.querySelector("title");
    const url = page.data.url as string | undefined;
    const isEn = !!url?.startsWith("/en/") || url === "/en";
    const lang: "ja" | "en" = isEn ? "en" : "ja";
    const stripped = isEn ? url!.slice(3) || "/" : url || "/";
    const isBlogPage =
      stripped.startsWith("/blog/") ||
      stripped.startsWith("/posts/") ||
      stripped.startsWith("/archive/") ||
      stripped.startsWith("/author/");
    const { home: homeSiteName, blog: blogSiteName } = SITE_NAMES[lang];

    // Swap site name for blog/post pages
    if (isBlogPage) {
      if (title) {
        title.textContent = title.textContent.replace(homeSiteName, blogSiteName);
      }
      const navbarHome = doc.querySelector(".navbar-home strong");
      if (navbarHome) {
        navbarHome.textContent = blogSiteName;
      }
    }

    // Remove "Portfolio - " prefix from top page title
    if (title?.textContent?.startsWith("Portfolio - ")) {
      title.textContent = title.textContent.replace("Portfolio - ", "");
    }

    // Language toggle: rewrite href based on whether alt-language counterpart exists
    if (url) {
      const alt = computeAltUrl(url);
      const altExists = urlSet.has(alt);
      const toggleHref = altExists ? alt : (isEn ? "/" : "/en/");
      const toggle = doc.querySelector("a.lang-toggle");
      if (toggle) {
        toggle.setAttribute("href", toggleHref);
      }

      // hreflang relations (only when alt counterpart exists)
      const headEl = doc.querySelector("head");
      if (headEl && altExists) {
        const jaUrl = isEn ? alt : url;
        const enUrl = isEn ? url : alt;
        const addAlt = (hreflang: string, href: string) => {
          const link = doc.createElement("link");
          link.setAttribute("rel", "alternate");
          link.setAttribute("hreflang", hreflang);
          link.setAttribute("href", `https://nyosegawa.com${href}`);
          headEl.appendChild(link);
        };
        addAlt("ja", jaUrl);
        addAlt("en", enUrl);
        addAlt("x-default", jaUrl);
      }
    }

    // Rewrite intra-blog links on EN pages to the English counterpart when one exists
    if (isEn) {
      doc.querySelectorAll("a[href]").forEach((link) => {
        const href = link.getAttribute("href");
        if (!href) return;

        let pathPart: string;
        let isAbsolute = false;
        if (href.startsWith("/posts/")) {
          pathPart = href;
        } else if (href.startsWith("https://nyosegawa.com/posts/")) {
          pathPart = href.slice("https://nyosegawa.com".length);
          isAbsolute = true;
        } else {
          return;
        }

        // Split off any #fragment or ?query before checking page existence
        const match = pathPart.match(/^(\/posts\/[^?#]*)(.*)$/);
        if (!match) return;
        const [, basePath, suffix] = match;
        const enBase = "/en" + basePath;
        if (!urlSet.has(enBase)) return;

        const enHref = (isAbsolute ? "https://nyosegawa.com" : "") + enBase + suffix;
        link.setAttribute("href", enHref);
      });
    }

    // Open external links in new tab
    doc.querySelectorAll("a[href^='http']").forEach((link) => {
      const href = link.getAttribute("href");
      if (href && !href.startsWith("https://nyosegawa.com")) {
        link.setAttribute("target", "_blank");
        link.setAttribute("rel", "noopener noreferrer");
      }
    });

    const head = doc.querySelector("head");
    if (!head) continue;

    // Fix og:title for portfolio page
    if (url === "/" || url === "/en/") {
      const ogTitle = head.querySelector("meta[property='og:title']");
      if (ogTitle) {
        ogTitle.setAttribute("content", homeSiteName);
      }
    }

    // Swap og:site_name for blog/post pages
    if (isBlogPage) {
      const ogSiteName = head.querySelector("meta[property='og:site_name']");
      if (ogSiteName) {
        ogSiteName.setAttribute("content", blogSiteName);
      }
    }

    // Change og:type to "article" for blog posts
    const isPost = url?.startsWith("/posts/") || url?.startsWith("/en/posts/");
    if (isPost) {
      const ogType = head.querySelector("meta[property='og:type']");
      if (ogType) {
        ogType.setAttribute("content", "article");
      }
    }

    // Add copy page button to post pages
    if (isPost) {
      const postTitle = doc.querySelector("h1.post-title");
      if (postTitle) {
        const postsPrefix = isEn ? "/en/posts/" : "/posts/";
        const slug = url?.replace(new RegExp(`^${postsPrefix}`), "").replace(/\/$/, "");
        const mdUrl = `${postsPrefix}${slug}.md`;

        const wrapper = doc.createElement("div");
        wrapper.className = "post-title-row";
        postTitle.before(wrapper);
        wrapper.appendChild(postTitle);

        const btn = doc.createElement("button");
        btn.className = "copy-page-btn";
        btn.setAttribute("data-md-url", mdUrl);
        btn.setAttribute("title", isEn ? "Copy article as Markdown" : "記事をMarkdownでコピー");
        btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
        wrapper.appendChild(btn);
      }
    }

    // Add copy button to code blocks
    doc.querySelectorAll("pre").forEach((pre) => {
      const btn = doc.createElement("button");
      btn.className = "copy-btn";
      btn.textContent = "Copy";
      pre.prepend(btn);
    });

    // Inject copy button script (once per page, at end of body)
    const body = doc.querySelector("body");
    if (body && doc.querySelector("pre .copy-btn")) {
      const script = doc.createElement("script");
      script.textContent = `document.addEventListener("click",function(e){var b=e.target;if(!b.classList.contains("copy-btn"))return;var code=b.parentElement.querySelector("code");if(!code)return;navigator.clipboard.writeText(code.textContent).then(function(){b.textContent="Copied!";setTimeout(function(){b.textContent="Copy"},1500)})})`;
      body.append(script);
    }

    // Inject copy page script for post pages
    if (body && doc.querySelector(".copy-page-btn")) {
      const cpScript = doc.createElement("script");
      cpScript.textContent = `document.addEventListener("click",function(e){var b=e.target.closest(".copy-page-btn");if(!b)return;e.preventDefault();fetch(b.getAttribute("data-md-url")).then(function(r){return r.text()}).then(function(t){return navigator.clipboard.writeText(t)}).then(function(){b.classList.add("copied");setTimeout(function(){b.classList.remove("copied")},1500)})})`;
      body.append(cpScript);
    }

    // Add og:image dimensions and twitter:image
    const ogImage = head.querySelector("meta[property='og:image']");
    if (ogImage) {
      const imageUrl = ogImage.getAttribute("content");

      const addMeta = (attr: string, key: string, value: string) => {
        const meta = doc.createElement("meta");
        meta.setAttribute(attr, key);
        meta.setAttribute("content", value);
        ogImage.after(meta);
      };

      addMeta("property", "og:image:width", "1200");
      addMeta("property", "og:image:height", "630");
      addMeta("property", "og:image:type", "image/jpeg");

      if (imageUrl && !head.querySelector("meta[name='twitter:image']")) {
        addMeta("name", "twitter:image", imageUrl);
      }
    }
  }
});

// Copy raw markdown files to output with absolute URLs
site.addEventListener("afterBuild", async () => {
  const baseUrl = "https://nyosegawa.com";

  const writeRawMarkdown = async (srcDir: string, urlPrefix: string, outDir: string) => {
    try {
      for await (const entry of Deno.readDir(srcDir)) {
        if (entry.isFile && entry.name.endsWith(".md")) {
          let content = await Deno.readTextFile(`${srcDir}/${entry.name}`);
          const slug = entry.name.replace(/\.md$/, "");

          // Add url to frontmatter
          content = content.replace(/^---\n/, `---\nurl: ${baseUrl}${urlPrefix}${slug}/\n`);

          // Convert relative paths to absolute URLs in markdown links/images
          content = content.replace(/\]\(\//g, `](${baseUrl}/`);

          await Deno.writeTextFile(`${outDir}/${entry.name}`, content);
        }
      }
    } catch (_e) {
      // Source directory may not exist (e.g., en/posts before any English post is written)
    }
  };

  await writeRawMarkdown("posts", "/posts/", "_site/posts");
  await Deno.mkdir("_site/en/posts", { recursive: true });
  await writeRawMarkdown("en/posts", "/en/posts/", "_site/en/posts");

  // Write custom robots.txt (overrides sitemap plugin's default)
  const robotsTxt = `User-agent: *
Disallow: /pagefind/
Disallow: /cdn-cgi/
Disallow: /*.md$

Sitemap: ${baseUrl}/sitemap.xml
`;
  await Deno.writeTextFile("_site/robots.txt", robotsTxt);
});

export default site;
