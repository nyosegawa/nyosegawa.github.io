import lume from "lume/mod.ts";
import blog from "blog/mod.ts";
import katex from "lume/plugins/katex.ts";

const site = lume({
  location: new URL("https://nyosegawa.github.io"),
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

// Override theme's index.vto with custom paginated home page
site.ignore("index.vto");

// Copy static assets to output
site.copy("og");
site.copy("img");

// Auto-set OG image for posts based on slug
site.preprocess([".md"], (pages) => {
  for (const page of pages) {
    if (page.src.path.startsWith("/posts/") && !page.data.image) {
      // Extract slug from path: "/posts/hello-lume" -> "hello-lume"
      const slug = page.src.path.replace(/^\/posts\//, "");
      if (slug) {
        page.data.image = `/og/${slug}.png`;
      }
    }
  }
});

// Post-process HTML
site.process([".html"], (pages) => {
  for (const page of pages) {
    const doc = page.document;
    if (!doc) continue;

    // Remove "Home - " prefix from top page title
    const title = doc.querySelector("title");
    if (title?.textContent?.startsWith("Home - ")) {
      title.textContent = title.textContent.replace("Home - ", "");
    }

    // Open external links in new tab
    doc.querySelectorAll("a[href^='http']").forEach((link) => {
      const href = link.getAttribute("href");
      if (href && !href.startsWith("https://nyosegawa.github.io")) {
        link.setAttribute("target", "_blank");
        link.setAttribute("rel", "noopener noreferrer");
      }
    });

    const head = doc.querySelector("head");
    if (!head) continue;

    // Change og:type to "article" for blog posts
    const isPost = page.data.url?.startsWith("/posts/");
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
      addMeta("property", "og:image:type", "image/png");

      if (imageUrl && !head.querySelector("meta[name='twitter:image']")) {
        addMeta("name", "twitter:image", imageUrl);
      }
    }
  }
});

export default site;
