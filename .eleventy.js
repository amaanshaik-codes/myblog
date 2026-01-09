const markdownIt = require("markdown-it");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");

function toTitleCaseFromSlug(slug) {
  return String(slug)
    .replace(/[-_]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((word) => {
      const lower = word.toLowerCase();
      const keepLower = new Set(["a", "an", "and", "as", "at", "but", "by", "for", "in", "nor", "of", "on", "or", "the", "to", "with"]);
      if (keepLower.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ")
    .replace(/^./, (c) => c.toUpperCase());
}

function stripHtml(html) {
  return String(html)
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function excerptFromHtml(html, maxLen = 180) {
  const text = stripHtml(html);
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).replace(/\s+\S*$/, "").trim() + "…";
}

module.exports = function (eleventyConfig) {
  eleventyConfig.setQuietMode(true);

  eleventyConfig.addFilter("absoluteUrl", (url, base) => {
    try {
      return new URL(String(url), String(base)).toString();
    } catch {
      return url;
    }
  });

  eleventyConfig.addFilter("rssDate", (dateObj) => {
    try {
      return new Date(dateObj).toUTCString();
    } catch {
      return "";
    }
  });

  eleventyConfig.addCollection("posts", (collectionApi) => {
    return collectionApi.getFilteredByTag("posts").sort((a, b) => a.date - b.date);
  });

  // Make it simple to add images: place them next to the markdown file and reference
  // them like `![](myimage.png)`. This hook copies those image files into the post's
  // output folder after build so relative URLs resolve naturally.
  eleventyConfig.on("eleventy.after", async ({ results }) => {
    const exts = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".txt"]);
    if (!Array.isArray(results)) return;

    const copyJobs = [];
    for (const result of results) {
      const inputPath = result && result.inputPath;
      const outputPath = result && result.outputPath;
      if (!inputPath || !outputPath) continue;
      // Check for content/posts path (handle both Windows and Unix separators)
      const normalizedInput = inputPath.replace(/\\/g, '/');
      if (!normalizedInput.includes('/content/posts/')) continue;
      if (!inputPath.toLowerCase().endsWith(".md")) continue;

      const inputDir = path.dirname(inputPath);
      const outputDir = path.dirname(outputPath);

      let entries;
      try {
        entries = await fsp.readdir(inputDir, { withFileTypes: true });
      } catch {
        continue;
      }

      for (const entry of entries) {
        if (!entry.isFile()) continue;
        const ext = path.extname(entry.name).toLowerCase();
        if (!exts.has(ext)) continue;

        const src = path.join(inputDir, entry.name);
        const dst = path.join(outputDir, entry.name);
        copyJobs.push(
          (async () => {
            try {
              await fsp.copyFile(src, dst);
            } catch {
              // ignore copy failures to keep builds resilient
            }
          })()
        );
      }
    }

    await Promise.all(copyJobs);
  });

  eleventyConfig.setLibrary(
    "md",
    markdownIt({
      html: true,
      breaks: false,
      linkify: true,
    })
  );

  eleventyConfig.addFilter("titleFromSlug", (slug) => toTitleCaseFromSlug(slug));
  eleventyConfig.addFilter("readableDate", (dateObj) => {
    try {
      return new Intl.DateTimeFormat("en", {
        year: "numeric",
        month: "short",
        day: "2-digit",
      }).format(dateObj);
    } catch {
      return "";
    }
  });
  eleventyConfig.addFilter("formatDate", (dateObj) => {
    try {
      const d = new Date(dateObj);
      const day = String(d.getDate()).padStart(2, '0');
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = months[d.getMonth()];
      const year = d.getFullYear();
      return `${day}.${month}.${year}`;
    } catch {
      return "";
    }
  });
  eleventyConfig.addFilter("excerpt", (html, maxLen) => excerptFromHtml(html, maxLen));

  eleventyConfig.addPassthroughCopy({ "assets": "assets" });
  // Note: Images in content/posts are copied via eleventy.after hook to the correct output folder

  return {
    dir: {
      input: ".",
      includes: "src/_includes",
      data: "src/_data",
      output: "_site",
    },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    templateFormats: ["md", "njk", "html"],
  };
};
