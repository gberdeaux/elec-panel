// Transforme le build « singlefile » en fragment HTML publiable comme page claude.ai :
// la plateforme ajoute elle-même doctype, <html>, <head> et <body>.
import { readFileSync, writeFileSync } from "node:fs";

const html = readFileSync("dist-artifact/index.html", "utf8");
const pick = (re) => [...html.matchAll(re)].map((m) => m[0]);

const title = pick(/<title>[\s\S]*?<\/title>/g);
const meta = pick(/<meta name="description"[^>]*>/g);
const links = pick(/<link\s+rel="(?:stylesheet|preconnect)"[^>]*>/g);
const styles = pick(/<style[^>]*>[\s\S]*?<\/style>/g);
const scripts = pick(/<script type="module"[^>]*>[\s\S]*?<\/script>/g);

if (!title.length || !scripts.length) throw new Error("Build inattendu : titre ou script introuvable.");

const fragment = [...title, ...meta, ...links, ...styles, '<div id="root"></div>', ...scripts].join("\n");
writeFileSync("dist-artifact/quinze-cent.html", fragment);
console.log(`dist-artifact/quinze-cent.html : ${(fragment.length / 1024).toFixed(0)} Ko`);
