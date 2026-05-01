export function toLetterboxdSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function getLetterboxdUrl(title: string): string {
  return `https://letterboxd.com/film/${toLetterboxdSlug(title)}/`;
}
