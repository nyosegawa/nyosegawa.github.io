export const layout = "layouts/archive.vto";

function url(n) {
  if (n === 1) return "/archive/";
  return `/archive/${n}/`;
}

export default function* ({ search, paginate, i18n }) {
  const posts = search.pages("type=post", "date=desc");

  for (const data of paginate(posts, { url, size: 10 })) {
    const isFirstPage = data.pagination.page === 1;

    if (isFirstPage) {
      data.menu = {
        visible: true,
        order: 1,
      };
    }

    yield {
      ...data,
      title: i18n.nav.archive_title,
      ...(isFirstPage ? {} : {
        unlisted: true,
        metas: { robots: "noindex, follow" },
      }),
    };
  }
}
