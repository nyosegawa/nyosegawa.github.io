export const layout = "layouts/home.vto";

export default function* ({ search, paginate }) {
  const posts = search.pages("type=post lang=ja", "date=desc");
  const url = (n) => (n === 1) ? "/blog/" : `/blog/page/${n}/`;

  for (const page of paginate(posts, { url, size: 5 })) {
    const isFirstPage = page.pagination.page === 1;
    const extra = isFirstPage
      ? {}
      : {
          unlisted: true,
          metas: { robots: "noindex, follow" },
          ...(page.pagination.page === 2 ? { oldUrl: "/page/2/" } : {}),
        };

    yield {
      ...page,
      title: isFirstPage ? "Blog" : `Blog - Page ${page.pagination.page}`,
      ...extra,
    };
  }
}
