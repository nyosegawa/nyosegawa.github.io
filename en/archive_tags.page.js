export const layout = "layouts/archive_result.vto";

function slugify(str) {
  return str
    .replaceAll(/[^a-z\d/-]/giu, (char) => {
      char = char.normalize("NFKD").replaceAll(/[\u0300-\u036F]/g, "");
      char = /[\p{L}\u0300-\u036F]+/u.test(char) ? char : "-";
      return /[^\w-]+/.test(char) ? "" : char;
    })
    .toLowerCase()
    .replaceAll(/(?<=^|[/.])-+(?=[^/.-])|(?<=[^/.-])-+(?=$|[/.])/g, "")
    .replaceAll(/[-]+/g, "-");
}

export default function* ({ search, i18n, paginate }) {
  for (const tag of search.values("tags", "type=post lang=en")) {
    if (!tag) continue;
    const slug = slugify(tag);
    if (!slug) continue;
    const url = (n) => (n === 1) ? `/en/archive/${slug}/` : `/en/archive/${slug}/${n}/`;
    const pages = search.pages(`type=post lang=en '${tag}'`);

    for (const page of paginate(pages, { url, size: 10 })) {
      yield {
        ...page,
        title: `${i18n.search.by_tag}  "${tag}"`,
        type: "tag",
        tag,
        unlisted: true,
        metas: { robots: "noindex, follow" },
      };
    }
  }

  for (const author of search.values("author", "type=post lang=en")) {
    if (!author) continue;
    const slug = slugify(author);
    if (!slug) continue;
    const url = (n) =>
      (n === 1) ? `/en/author/${slug}/` : `/en/author/${slug}/${n}/`;
    const pages = search.pages(`type=post lang=en author='${author}'`);

    for (const page of paginate(pages, { url, size: 10 })) {
      yield {
        ...page,
        title: `${i18n.search.by_author} ${author}`,
        type: "author",
        author,
        unlisted: true,
        metas: { robots: "noindex, follow" },
      };
    }
  }
}
