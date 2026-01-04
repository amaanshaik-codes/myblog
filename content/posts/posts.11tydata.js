const fs = require("fs");
const path = require("path");

function parseDateFromText(text) {
  // Supports: "dec 28 2025" (case-insensitive), also with commas.
  const cleaned = String(text).trim().replace(/,/g, "");
  const m = cleaned.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\b\s+(\d{1,2})\s+(\d{4})\b/i);
  if (!m) return null;

  const monthMap = {
    jan: 0,
    feb: 1,
    mar: 2,
    apr: 3,
    may: 4,
    jun: 5,
    jul: 6,
    aug: 7,
    sep: 8,
    sept: 8,
    oct: 9,
    nov: 10,
    dec: 11,
  };

  const month = monthMap[m[1].toLowerCase()];
  const day = Number(m[2]);
  const year = Number(m[3]);
  const date = new Date(Date.UTC(year, month, day));
  return Number.isNaN(date.getTime()) ? null : date;
}

module.exports = {
  layout: "layouts/post.njk",
  tags: ["posts"],

  permalink: (data) => {
    const slug = data.page?.fileSlug || "post";
    return `/posts/${slug}/`;
  },

  eleventyComputed: {
    image: (data) => {
      // Default social/cover image for the post.
      // Expected to exist next to the markdown file and copied to output.
      const baseUrl = data.page?.url || "/";
      const inputPath = data.page?.inputPath;

      if (inputPath) {
        const dir = path.dirname(inputPath);
        try {
          const entries = fs.readdirSync(dir);
          const lower = new Map(entries.map((name) => [String(name).toLowerCase(), name]));
          for (const candidate of ["thumb.png", "thumb.jpg", "thumb.jpeg"]) {
            const found = lower.get(candidate);
            if (found) return `${baseUrl}${found}`;
          }
        } catch {
          // ignore and fall back
        }
      }

      return `${baseUrl}thumb.png`;
    },

    title: (data) => {
      if (data.title) return data.title;
      // fileSlug already normalizes spaces/special chars
      return data.page && data.page.fileSlug
        ? data.page.fileSlug.replace(/-/g, " ")
        : "Post";
    },

    date: (data) => {
      // Prefer explicit front matter date; otherwise parse from filename; otherwise keep Eleventy default.
      if (data.date && data.date instanceof Date) return data.date;

      const fromSlug = parseDateFromText(data.page?.fileSlug);
      if (fromSlug) return fromSlug;

      const fromTitle = parseDateFromText(data.title);
      if (fromTitle) return fromTitle;

      return data.page?.date;
    },

    description: (data) => {
      return data.description || data.title;
    },
  },
};
