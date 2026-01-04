# thinking out loud

Minimal blog site built with Eleventy (11ty), ready for Netlify.

## Local dev

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

Output is generated into `_site/`.

## Images in posts

Put images in the same folder as the post markdown file and reference them directly:

```md
![](myimage.png)
```

They will be copied into the post output folder during build.
