// Turns a raw config token ("no_upload_hvv") into a readable label
// ("No Upload Hvv") without needing a real per-language translation —
// underscores become spaces, each word gets capitalized.
export const prettifyToken = (token: string): string =>
  token
    .split("_")
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
