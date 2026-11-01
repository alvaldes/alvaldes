// Fills the README sections between <!-- TAG:START --> and <!-- TAG:END --> with cards
// built from the portfolio's RSS feeds. Run with `node scripts/readme-feeds.mjs`.
import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const SECTIONS = [
	// Projects keep the order of the portfolio's Works page; the feed has no dates.
	{ tag: "PROJECT-LIST", feed: "https://www.alvaldes.dev/works/rss.xml", limit: 6, columns: 3 },
	{ tag: "BLOG-POST-LIST", feed: "https://www.alvaldes.dev/rss.xml", limit: 4, columns: 2 },
];

const XML_ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function decodeXml(text) {
	return text
		.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
		.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (match, entity) => {
			if (entity[0] === "#") {
				const code = entity[1].toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
				return String.fromCodePoint(code);
			}
			return XML_ENTITIES[entity] ?? match;
		})
		.trim();
}

function escapeHtml(text) {
	return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** The items of an RSS feed, in feed order. The feeds are our own, so a small parser is enough. */
export function parseFeed(xml) {
	return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, body]) => {
		const field = (name) => decodeXml(body.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))?.[1] ?? "");
		return {
			title: field("title"),
			link: field("link"),
			description: field("description"),
			image: decodeXml(body.match(/<media:content[^>]*\burl="([^"]*)"/)?.[1] ?? ""),
		};
	});
}

/**
 * A table of cards, `columns` per row: the thumbnail and the title link to the item,
 * with its description below. GitHub strips CSS from READMEs, so a table is the layout.
 */
export function renderGrid(items, { columns }) {
	const width = `${Math.floor(100 / columns)}%`;
	const cell = ({ title, link, description, image }) => {
		const href = escapeHtml(link);
		const thumbnail = image ? `<a href="${href}"><img src="${escapeHtml(image)}" alt="${escapeHtml(title)}" width="100%"></a><br>` : "";
		return `<td width="${width}" valign="top">${thumbnail}<a href="${href}"><b>${escapeHtml(title)}</b></a><br><sub>${escapeHtml(description)}</sub></td>`;
	};

	const rows = [];
	for (let i = 0; i < items.length; i += columns) {
		rows.push(`<tr>\n${items.slice(i, i + columns).map(cell).join("\n")}\n</tr>`);
	}
	return `<table>\n${rows.join("\n")}\n</table>`;
}

/** Replaces what is between the section's markers, keeping each marker on a line of its own. */
export function replaceSection(readme, tag, content) {
	const start = `<!-- ${tag}:START -->`;
	const end = `<!-- ${tag}:END -->`;
	const from = readme.indexOf(start);
	const to = readme.indexOf(end, from);
	if (from === -1 || to === -1) {
		throw new Error(`README.md has no "${start}" ... "${end}" markers.`);
	}
	return `${readme.slice(0, from)}${start}\n${content}\n${readme.slice(to)}`;
}

async function main() {
	const path = new URL("../README.md", import.meta.url);
	let readme = await readFile(path, "utf8");

	for (const { tag, feed, limit, columns } of SECTIONS) {
		const response = await fetch(feed);
		if (!response.ok) {
			throw new Error(`${feed} answered ${response.status}.`);
		}
		const items = parseFeed(await response.text()).slice(0, limit);
		if (items.length === 0) {
			throw new Error(`${feed} has no items; leaving README.md as it is.`);
		}
		readme = replaceSection(readme, tag, renderGrid(items, { columns }));
	}

	await writeFile(path, readme);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
	await main();
}
