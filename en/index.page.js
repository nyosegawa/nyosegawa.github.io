export const layout = "layouts/home.vto";

export default function* ({ search, paginate }) {
  const posts = search.pages("type=post lang=en", "date=desc");
  const url = (n) => (n === 1) ? "/en/blog/" : `/en/blog/page/${n}/`;

  let yielded = false;
  for (const page of paginate(posts, { url, size: 5 })) {
    yielded = true;
    const isFirstPage = page.pagination.page === 1;
    const extra = isFirstPage
      ? {}
      : {
          unlisted: true,
          metas: { robots: "noindex, follow" },
          ...(page.pagination.page === 2 ? { oldUrl: "/en/page/2/" } : {}),
        };

    yield {
      ...page,
      title: isFirstPage ? "Blog" : `Blog - Page ${page.pagination.page}`,
      ...extra,
    };
  }

  // Always emit at least an empty Blog index so navigation links don't 404
  if (!yielded) {
    yield {
      url: "/en/blog/",
      title: "Blog",
      results: [],
      pagination: { page: 1, totalPages: 1, totalResults: 0 },
    };
  }
}
