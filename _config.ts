import lume from "lume/mod.ts";
import blog from "blog/mod.ts";

const site = lume({
  location: new URL("https://nyosegawa.github.io"),
});

site.use(blog({
  date: {
    formats: {
      HUMAN_DATE: "yyyy-MM-dd",
    },
  },
}));

// Override theme's archive_result.page.js to fix empty tag/author bug
site.ignore("archive_result.page.js");

// Copy generated OG images to output
site.copy("og");

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
  }
});

export default site;
