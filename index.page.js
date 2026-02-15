export const layout = "layouts/home.vto";

export default function* ({ search, paginate }) {
  const posts = search.pages("type=post", "date=desc");
  const url = (n) => (n === 1) ? "/" : `/page/${n}/`;

  for (const page of paginate(posts, { url, size: 5 })) {
    yield {
      ...page,
      title: page.pagination.page === 1 ? "Home" : `Page ${page.pagination.page}`,
    };
  }
}
