module.exports = {
  // Prevent generating routes under /content/* in the output.
  // Real site pages (like posts) should define their own permalinks.
  permalink: false,
  eleventyExcludeFromCollections: true,
};
