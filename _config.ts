import lume from "lume/mod.ts";
import blog from "blog/mod.ts";

const site = lume({
  location: new URL("https://nyosegawa.github.io"),
});

site.use(blog());

export default site;
