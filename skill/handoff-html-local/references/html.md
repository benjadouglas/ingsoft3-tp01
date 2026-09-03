# Reviewable plan HTML

Generate a complete, self-contained HTML5 document that is readable on mobile and desktop. Use inline CSS, no external assets, no forms, and no JavaScript. The Borrador viewer handles all interaction; the plan only supplies content, styling, and block IDs.

## Block IDs

A block is an HTML element with an `id`. It is the unit the user can comment on.

- IDs must be unique within the document.
- Use short semantic kebab-case IDs such as `scope`, `data-model`, or `api-create-plan`.
- Put IDs on meaningful containers, not on both a container and its heading.
- Preserve an ID across versions when the block still represents the same concept.
- Never reuse a removed ID for an unrelated concept.
- Allow at most two commentable levels: a top-level block may contain blocks with IDs, but an inner block must not contain another element with an ID.
- Avoid incidental IDs used only for CSS or anchors; every ID becomes commentable.

Good structure:

```html
<main>
  <section id="scope">
    <h2>Scope</h2>
    <p>...</p>
  </section>

  <section id="implementation">
    <h2>Implementation</h2>

    <article id="api">
      <h3>API</h3>
      <p>...</p>
    </article>

    <article id="frontend">
      <h3>Frontend</h3>
      <p>...</p>
    </article>
  </section>
</main>
```

Do not put IDs below `api` or `frontend` in this example.
