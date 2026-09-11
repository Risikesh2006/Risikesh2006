import { mkdir, writeFile } from 'node:fs/promises';

const username = process.env.PROFILE_USERNAME || 'Risikesh2006';
const token = process.env.GITHUB_TOKEN;
if (!token) throw new Error('GITHUB_TOKEN is required to read the contribution calendar.');
const headers = { Authorization: `Bearer ${token}`, 'User-Agent': 'profile-assets', Accept: 'application/vnd.github+json' };
async function api(path, body) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(`https://api.github.com/${path}`, {
      headers, ...(body ? { method: 'POST', body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(30000),
    });
    if (response.ok) {
      const result = await response.json();
      if (result.errors) throw new Error(JSON.stringify(result.errors));
      return result;
    }
    if (response.status < 500 || attempt === 2) throw new Error(`GitHub ${path}: HTTP ${response.status}`);
    await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
  }
}
const [user, result] = await Promise.all([
  api(`users/${username}`),
  api('graphql', { query: `query($login:String!) { user(login:$login) { contributionsCollection { contributionCalendar { totalContributions weeks { contributionDays { date weekday contributionCount contributionLevel } } } } } }`, variables: { login: username } }),
]);
const repos = [];
for (let page = 1; ; page++) {
  const batch = await api(`users/${username}/repos?type=owner&per_page=100&page=${page}`);
  repos.push(...batch);
  if (batch.length < 100) break;
}
const calendar = result.data.user.contributionsCollection.contributionCalendar;
const days = calendar.weeks.flatMap(w => w.contributionDays);
const owned = repos.filter(r => !r.fork);
const stars = owned.reduce((sum, r) => sum + r.stargazers_count, 0);
const activeDays = days.filter(d => d.contributionCount > 0).length;
let longest = 0, streak = 0;
for (const day of days) { streak = day.contributionCount ? streak + 1 : 0; longest = Math.max(longest, streak); }
// Allow the current UTC day to remain unfinished before a streak resets.
const streakDays = days.at(-1)?.contributionCount === 0 ? days.slice(0, -1) : days;
let current = 0;
for (let i = streakDays.length - 1; i >= 0 && streakDays[i].contributionCount > 0; i--) current++;
const languages = new Map();
for (const repo of owned) if (repo.language) languages.set(repo.language, (languages.get(repo.language) || 0) + 1);
const top = [...languages].sort((a, b) => b[1] - a[1]).slice(0, 6);
const esc = text => String(text).replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]);
const text = (x, y, value, size = 16, fill = '#cbd5e1', extra = '') => `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" ${extra}>${esc(value)}</text>`;
const stamp = new Date().toISOString().slice(0, 10);
function svg(title, height, content) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="${height}" viewBox="0 0 960 ${height}" role="img" aria-labelledby="title desc"><title id="title">${esc(title)}</title><desc id="desc">GitHub public profile data for ${esc(username)}. Updated ${stamp} UTC.</desc><defs><linearGradient id="accent"><stop stop-color="#67e8f9"/><stop offset="1" stop-color="#a78bfa"/></linearGradient></defs><rect x="1" y="1" width="958" height="${height - 2}" rx="20" fill="#0d1117" stroke="#263449"/><g font-family="Segoe UI,Arial,sans-serif">${text(30, 40, title, 22, '#f1f5f9', 'font-weight="700"')}${text(930, 38, `UPDATED ${stamp} UTC`, 11, '#94a3b8', 'text-anchor="end"')}${content}</g></svg>\n`;
}
const metrics = [
  ['Public repositories', user.public_repos], ['Stars earned', stars], ['Followers', user.followers],
  ['Contributions · past year', calendar.totalContributions], ['Current streak · days', current], ['Longest streak · past year', longest],
];
let stats = metrics.map(([label, value], i) => {
  const x = 30 + (i % 3) * 310, y = 70 + Math.floor(i / 3) * 105;
  return `<rect x="${x}" y="${y}" width="290" height="88" rx="12" fill="#151e2d"/>${text(x + 18, y + 39, value.toLocaleString('en-US'), 30, '#67e8f9', 'font-weight="700"')}${text(x + 18, y + 66, label, 13)}`;
}).join('');
stats += text(30, 307, 'Public profile metrics · stars exclude forks · streaks use the displayed GitHub calendar', 12, '#94a3b8');
let langs = '';
const colors = ['#67e8f9', '#a78bfa', '#60a5fa', '#34d399', '#fbbf24', '#fb7185'];
top.forEach(([name, count], i) => {
  const x = 30 + (i % 2) * 465, y = 83 + Math.floor(i / 2) * 61;
  langs += text(x, y, name, 15, '#f1f5f9') + text(x + 425, y, `${count} ${count === 1 ? 'repo' : 'repos'}`, 13, '#94a3b8', 'text-anchor="end"');
  langs += `<rect x="${x}" y="${y + 12}" width="425" height="7" rx="3" fill="#1e293b"/><rect x="${x}" y="${y + 12}" width="${425 * count / Math.max(...top.map(t => t[1]))}" height="7" rx="3" fill="${colors[i]}"/>`;
});
langs += text(30, 281, 'Primary language by number of owned, non-fork public repositories; not code percentage.', 12, '#94a3b8');
const milestones = [['Builder', user.public_repos, 'public repositories'], ['Star collector', stars, 'stars earned'], ['Community', user.followers, 'followers'], ['Consistency', activeDays, 'active days this year']];
const trophies = milestones.map(([label, count, unit], i) => {
  const x = 30 + i * 232;
  return `<rect x="${x}" y="64" width="210" height="174" rx="14" fill="#151e2d" stroke="#2c3b52"/><g transform="translate(${x + 88},80)" fill="none" stroke="${colors[i]}" stroke-width="2.5"><path d="M4 0h26v12c0 17-26 17-26 0zM4 5H-3v7c0 8 9 8 9 8M30 5h7v7c0 8-9 8-9 8M17 25v10M6 37h22"/></g>${text(x + 105, 144, label, 16, '#e2e8f0', 'text-anchor="middle"')}${text(x + 105, 185, count, 30, colors[i], 'text-anchor="middle" font-weight="700"')}${text(x + 105, 214, unit, 12, '#94a3b8', 'text-anchor="middle"')}`;
}).join('') + text(30, 266, 'Custom milestone trophies based on real public metrics — not official GitHub awards.', 12, '#94a3b8');
const shades = ['#182334', '#164e63', '#0e7490', '#22b8cf', '#67e8f9'];
const levels = ['NONE', 'FIRST_QUARTILE', 'SECOND_QUARTILE', 'THIRD_QUARTILE', 'FOURTH_QUARTILE'];
let heatmap = text(30, 77, `${calendar.totalContributions.toLocaleString('en-US')} contributions in the past year`, 17, '#67e8f9');
calendar.weeks.forEach((week, x) => week.contributionDays.forEach(d => {
  heatmap += `<rect x="${32 + x * 17}" y="${100 + d.weekday * 18}" width="13" height="14" rx="3" fill="${shades[Math.max(0, levels.indexOf(d.contributionLevel))]}"><title>${d.date}: ${d.contributionCount} contributions</title></rect>`;
}));
heatmap += text(30, 251, `${days[0].date} — ${days.at(-1).date} · ${activeDays} active days`, 12, '#94a3b8');
heatmap += text(756, 251, 'Less', 11, '#94a3b8') + shades.map((c, i) => `<rect x="${790 + 18 * i}" y="240" width="13" height="13" rx="3" fill="${c}"/>`).join('') + text(887, 251, 'More', 11, '#94a3b8');
// Fetch and render everything before replacing any last-known-good assets.
await mkdir('assets', { recursive: true });
await Promise.all([
  ['github-stats.svg', svg('GitHub / by the numbers', 330, stats)],
  ['languages.svg', svg('Languages / repository mix', 305, langs)],
  ['trophies.svg', svg('Milestones / built over time', 290, trophies)],
  ['contributions.svg', svg('Contribution activity / one year of building', 278, heatmap)],
].map(([name, contents]) => writeFile(`assets/${name}`, contents)));
console.log(`Generated 4 profile assets from ${repos.length} public repositories and ${days.length} calendar days.`);
