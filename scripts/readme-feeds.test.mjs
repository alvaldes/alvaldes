// Run with `node --test scripts/` (Node's built-in test runner, no dependencies).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseFeed, renderGrid, replaceSection } from "./readme-feeds.mjs";

const item = ({ title = "A &amp; B", link = "https://example.com/a/", description = "It&apos;s &lt;fast&gt;", image = "https://example.com/a.jpeg" } = {}) =>
	`<item><title>${title}</title><link>${link}</link><description>${description}</description>` +
	(image ? `<media:content url="${image}" medium="image" type="image/jpeg" width="600" height="600"/>` : "") +
	"</item>";
const feed = (...items) => `<?xml version="1.0"?><rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/"><channel><title>Feed</title>${items.join("")}</channel></rss>`;

describe("parseFeed", () => {
	it("reads every item in feed order, decoding XML entities", () => {
		const items = parseFeed(feed(item(), item({ title: "Second", link: "https://example.com/b/" })));
		assert.deepEqual(items, [
			{ title: "A & B", link: "https://example.com/a/", description: "It's <fast>", image: "https://example.com/a.jpeg" },
			{ title: "Second", link: "https://example.com/b/", description: "It's <fast>", image: "https://example.com/a.jpeg" },
		]);
	});

	it("leaves the image empty when an item has no media:content", () => {
		assert.equal(parseFeed(feed(item({ image: null })))[0].image, "");
	});
});

describe("renderGrid", () => {
	const entry = (n) => ({ title: `T${n}`, link: `https://example.com/${n}/`, description: `D${n}`, image: `https://example.com/${n}.jpeg` });

	it("lays the items out in rows of the given number of columns", () => {
		const html = renderGrid([1, 2, 3, 4, 5].map(entry), { columns: 2 });
		assert.equal(html.match(/<tr>/g).length, 3);
		assert.equal(html.match(/<td /g).length, 5);
		assert.match(html, /<td width="50%" valign="top">/);
	});

	it("links the thumbnail and the title of each item to its page", () => {
		const html = renderGrid([entry(1)], { columns: 3 });
		assert.match(html, /<a href="https:\/\/example.com\/1\/"><img src="https:\/\/example.com\/1.jpeg" alt="T1" width="100%"><\/a>/);
		assert.match(html, /<a href="https:\/\/example.com\/1\/"><b>T1<\/b><\/a>/);
		assert.match(html, /D1/);
	});

	it("escapes text so a title or description cannot break the HTML", () => {
		const html = renderGrid([{ ...entry(1), title: 'A <b> & "q"', description: "x < y" }], { columns: 1 });
		assert.match(html, /<b>A &lt;b&gt; &amp; &quot;q&quot;<\/b>/);
		assert.match(html, /x &lt; y/);
	});

	it("leaves the thumbnail out when an item has no image", () => {
		assert.doesNotMatch(renderGrid([{ ...entry(1), image: "" }], { columns: 1 }), /<img/);
	});
});

describe("replaceSection", () => {
	const readme = "# Hi\n\n<!-- POSTS:START -->\nold\n<!-- POSTS:END -->\n\n## Stack\n";

	it("replaces only what is between the markers, on lines of its own", () => {
		assert.equal(
			replaceSection(readme, "POSTS", "<table></table>"),
			"# Hi\n\n<!-- POSTS:START -->\n<table></table>\n<!-- POSTS:END -->\n\n## Stack\n",
		);
	});

	it("fixes content pasted on the marker line by an earlier tool", () => {
		const glued = "<!-- POSTS:START -->- [a](b)\n- [c](d)\n<!-- POSTS:END -->";
		assert.equal(replaceSection(glued, "POSTS", "new"), "<!-- POSTS:START -->\nnew\n<!-- POSTS:END -->");
	});

	it("fails when the README has no markers for the section", () => {
		assert.throws(() => replaceSection(readme, "PROJECTS", "x"), /PROJECTS:START/);
	});
});
