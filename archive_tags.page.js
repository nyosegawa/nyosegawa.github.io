export const layout = "layouts/archive_result.vto";

// Match Lume's slugifier behavior (alphanumeric: true, lowercase: true)
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
  // Generate a page for each tag
  for (const tag of search.values("tags")) {
    if (!tag) continue;
    const slug = slugify(tag);
    if (!slug) continue;
    const url = (n) => (n === 1) ? `/archive/${slug}/` : `/archive/${slug}/${n}/`;
    const pages = search.pages(`type=post '${tag}'`);

    for (const page of paginate(pages, { url, size: 10 })) {
      yield {
        ...page,
        title: `${i18n.search.by_tag}  "${tag}"`,
        type: "tag",
        tag,
      };
    }
  }

  // Generate a page for each author
  for (const author of search.values("author")) {
    if (!author) continue;
    const slug = slugify(author);
    if (!slug) continue;
    const url = (n) =>
      (n === 1) ? `/author/${slug}/` : `/author/${slug}/${n}/`;
    const pages = search.pages(`type=post author='${author}'`);

    for (const page of paginate(pages, { url, size: 10 })) {
      yield {
        ...page,
        title: `${i18n.search.by_author} ${author}`,
        type: "author",
        author,
      };
    }
  }
}
