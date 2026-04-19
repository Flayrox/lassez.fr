const fs = require('fs');

let c = fs.readFileSync('app/(frontend)/radar-admin/daemon/page.tsx', 'utf8');

c = c.replace(
  /<input type="number" step="0.1" value={daemonProfiles\.rss\.scan_interval_hours}.*?\/>/g,
  `<div className="flex gap-4 items-center">
      <input type="range" min="0.1" max="24" step="0.1" value={daemonProfiles.rss.scan_interval_hours} onChange={e => updateDaemonProfile('rss', 'scan_interval_hours', e.target.value)} className="flex-1 accent-stone-900 h-2 bg-stone-300 rounded-none cursor-pointer appearance-none" />
      <div className="w-16 bg-white border-2 border-stone-900 p-2 text-center font-black text-xs">{daemonProfiles.rss.scan_interval_hours}h</div>
  </div>`
);

c = c.replace(
  /<input type="number" value={daemonProfiles\.rss\.max_articles}.*?\/>/g,
  `<div className="flex gap-4 items-center">
      <input type="range" min="1" max="500" step="1" value={daemonProfiles.rss.max_articles} onChange={e => updateDaemonProfile('rss', 'max_articles', e.target.value)} className="flex-1 accent-stone-900 h-2 bg-stone-300 rounded-none cursor-pointer appearance-none" />
      <div className="w-16 bg-white border-2 border-stone-900 p-2 text-center font-black text-xs">{daemonProfiles.rss.max_articles}</div>
  </div>`
);

c = c.replace(
  /<input type="number" value={daemonProfiles\.rss\.rss_lookback_hours}.*?\/>/g,
  `<div className="flex gap-4 items-center">
      <input type="range" min="1" max="168" step="1" value={daemonProfiles.rss.rss_lookback_hours} onChange={e => updateDaemonProfile('rss', 'rss_lookback_hours', e.target.value)} className="flex-1 accent-stone-900 h-2 bg-stone-300 rounded-none cursor-pointer appearance-none" />
      <div className="w-16 bg-white border-2 border-stone-900 p-2 text-center font-black text-xs">{daemonProfiles.rss.rss_lookback_hours}h</div>
  </div>`
);


c = c.replace(
  /<input type="number" step="0.1" value={daemonProfiles\.publisher\.scan_interval_hours}.*?\/>/g,
  `<div className="flex gap-4 items-center">
      <input type="range" min="0.1" max="24" step="0.1" value={daemonProfiles.publisher.scan_interval_hours} onChange={e => updateDaemonProfile('publisher', 'scan_interval_hours', e.target.value)} className="flex-1 accent-stone-900 h-2 bg-stone-300 rounded-none cursor-pointer appearance-none" />
      <div className="w-16 bg-white border-2 border-stone-900 p-2 text-center font-black text-xs">{daemonProfiles.publisher.scan_interval_hours}h</div>
  </div>`
);

c = c.replace(
  /<input type="number" value={daemonProfiles\.publisher\.max_articles}.*?\/>/g,
  `<div className="flex gap-4 items-center">
      <input type="range" min="1" max="500" step="1" value={daemonProfiles.publisher.max_articles} onChange={e => updateDaemonProfile('publisher', 'max_articles', e.target.value)} className="flex-1 accent-stone-900 h-2 bg-stone-300 rounded-none cursor-pointer appearance-none" />
      <div className="w-16 bg-white border-2 border-stone-900 p-2 text-center font-black text-xs">{daemonProfiles.publisher.max_articles}</div>
  </div>`
);


c = c.replace(
  /<input type="number" value={daemonProfiles\.publisher\.min_delay_min}.*?\/>/g,
  `<div className="flex gap-4 items-center">
      <input type="range" min="1" max="60" step="1" value={daemonProfiles.publisher.min_delay_min} onChange={e => updateDaemonProfile('publisher', 'min_delay_min', e.target.value)} className="flex-1 accent-stone-900 h-2 bg-stone-300 rounded-none cursor-pointer appearance-none" />
      <div className="w-16 bg-white border-2 border-stone-900 p-2 text-center font-black text-xs">{daemonProfiles.publisher.min_delay_min}m</div>
  </div>`
);


c = c.replace(
  /<input type="number" value={daemonProfiles\.publisher\.max_delay_min}.*?\/>/g,
  `<div className="flex gap-4 items-center">
      <input type="range" min="1" max="120" step="1" value={daemonProfiles.publisher.max_delay_min} onChange={e => updateDaemonProfile('publisher', 'max_delay_min', e.target.value)} className="flex-1 accent-stone-900 h-2 bg-stone-300 rounded-none cursor-pointer appearance-none" />
      <div className="w-16 bg-white border-2 border-stone-900 p-2 text-center font-black text-xs">{daemonProfiles.publisher.max_delay_min}m</div>
  </div>`
);

fs.writeFileSync('app/(frontend)/radar-admin/daemon/page.tsx', c);
console.log('Replaced numeric inputs with sliders!');
