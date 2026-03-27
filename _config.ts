import lume from "lume/mod.ts";
import blog from "blog/mod.ts";
import katex from "lume/plugins/katex.ts";

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

// Override theme's archive_result.page.js to fix empty tag/author bug
site.ignore("archive_result.page.js");

// Theme's index.vto is overridden by our local index.vto (portfolio page)

// Copy static assets to output
site.copy("og");
site.copy("img");
site.copy("CNAME");
site.copy("icon.png");

// Auto-set OG image for posts based on slug
site.preprocess([".md"], (pages) => {
  for (const page of pages) {
    if (page.src.path.startsWith("/posts/") && !page.data.image) {
      // Extract slug from path: "/posts/hello-lume" -> "hello-lume"
      const slug = page.src.path.replace(/^\/posts\//, "");
      if (slug) {
        page.data.image = `/og/${slug}.jpg`;
      }
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
    const url = page.data.url;
    const isBlogPage = url?.startsWith("/blog/") || url?.startsWith("/posts/") || url?.startsWith("/archive/") || url?.startsWith("/author/");
    const homeSiteName = "逆瀬川ちゃんのほーむぺーじ";
    const blogSiteName = "逆瀬川ちゃんのブログ";

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

    // Move "お仕事募集のお知らせ" link to first position in navbar
    const navbarLinks = doc.querySelector(".navbar-links");
    if (navbarLinks) {
      const oshigotoLink = navbarLinks.querySelector("a[href='/posts/oshigoto-wanted/']");
      if (oshigotoLink) {
        const li = oshigotoLink.parentElement;
        if (li && navbarLinks.firstElementChild) {
          navbarLinks.insertBefore(li, navbarLinks.firstElementChild);
        }
        oshigotoLink.classList.add("nav-oshigoto");
      }
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
    if (url === "/") {
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
    const isPost = url?.startsWith("/posts/");
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
        const slug = url?.replace(/^\/posts\//, "").replace(/\/$/, "");
        const mdUrl = `/posts/${slug}.md`;

        const wrapper = doc.createElement("div");
        wrapper.className = "post-title-row";
        postTitle.before(wrapper);
        wrapper.appendChild(postTitle);

        const btn = doc.createElement("button");
        btn.className = "copy-page-btn";
        btn.setAttribute("data-md-url", mdUrl);
        btn.setAttribute("title", "記事をMarkdownでコピー");
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
  for await (const entry of Deno.readDir("posts")) {
    if (entry.isFile && entry.name.endsWith(".md")) {
      let content = await Deno.readTextFile(`posts/${entry.name}`);
      const slug = entry.name.replace(/\.md$/, "");

      // Add url to frontmatter
      content = content.replace(/^---\n/, `---\nurl: ${baseUrl}/posts/${slug}/\n`);

      // Convert relative paths to absolute URLs in markdown links/images
      content = content.replace(/\]\(\//g, `](${baseUrl}/`);

      await Deno.writeTextFile(`_site/posts/${entry.name}`, content);
    }
  }
});

export default site;
