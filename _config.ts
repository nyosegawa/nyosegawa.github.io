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

// Post-process HTML
site.process([".html"], (pages) => {
  for (const page of pages) {
    const doc = page.document;
    if (!doc) continue;

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

export default site;
