export const layout = "layouts/archive.vto";

function url(n) {
  if (n === 1) return "/en/archive/";
  return `/en/archive/${n}/`;
}

export default function* ({ search, paginate, i18n }) {
  const posts = search.pages("type=post lang=en", "date=desc");

  let yielded = false;
  for (const data of paginate(posts, { url, size: 10 })) {
    yielded = true;
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

  // Always emit at least an empty Archive page so the nav entry has a target
  if (!yielded) {
    yield {
      url: "/en/archive/",
      title: i18n.nav.archive_title,
      results: [],
      pagination: { page: 1, totalPages: 1, totalResults: 0 },
      menu: { visible: true, order: 1 },
    };
  }
}
