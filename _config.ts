import lume from "lume/mod.ts";
import blog from "blog/mod.ts";

const site = lume({
  location: new URL("https://nyosegawa.github.io"),
});

site.use(blog());

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

export default site;
