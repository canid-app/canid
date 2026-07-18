export const FAQ_ITEMS = [
  {
    q: 'What is canid?',
    a: [
      'A free digital contact card. You add the handles and links you want to share, ' +
      'sort them into groups, and hand them out as a QR code, an NFC tag, or a link.',
      'It’s important to remember that you don’t ‘post’ a card to canid. It’s formatted directly in the viewer’s browser whenever they click the link, not stored anywhere as a webpage.'
    ],
  },
  {
    q: 'Who is canid for?',
    a: [
      'Anyone who wants to hand out their contact info quickly and on their own terms. ' +
      'canid is especially handy if you keep different parts of your life separate, or move ' +
      'between scenes and communities. For example alt, kink, and fetish communities, the ' +
      'furry and pup scenes, drag performers and nightlife folks, sex workers and creators, ' +
      'as well as people networking at conventions, markets, and meetups. It’s also helpful if you generally need a link aggregator or online contact list that you don’t want aggregated by search engines or sold. ' +
      'canid is a neutral tool. It just formats and shares whatever handles you enter, and ' +
      'takes no position on what you share or which communities you belong to.',
    ],
  },
  {
    q: 'Staying safe',
    a: [
      'Because there is no database and no servers, canid cannot verify any information entered into a card. Please make sure you only click links from people you trust, and review any URLs carefully. Links to supported networks go directly to those networks, and custom URLs show a warning before you navigate to them. Please pay attention!',
    ],
  },
  {
    q: 'Who’s responsible for what’s on a card?',
    a: [
      'You are. Because canid stores nothing and checks nothing, you’re responsible for the handles and links you add and for having the right to share them. Only put things on a card that are yours, or that you have permission to share. The <a href="/terms">terms</a> cover this in full.',
    ],
  },
  {
    q: 'How does it work?',
    a: [
      'Everything on your card is packed into the link itself (the part after the ' +
      '“#”). When you share a link or QR, you are handing someone that packed-up card ' +
      'directly. Their device unpacks it and shows the handles. Nothing is looked up ' +
      'on a server, because there is no server holding your card.',
      'Plainly: canid is just a visual formatter. The web address contains all of the data, and the site simply displays it on the viewer’s device.',
    ],
  },
  {
    q: 'Which platforms can I add?',
    a: [
      'A lot, with more on the way. Right now canid supports:',
      '<strong>Messaging &amp; social:</strong> Telegram, Signal, WhatsApp, Discord, X, Bluesky, Threads, Instagram, Facebook, Snapchat, Reddit, Fur Affinity, TikTok, YouTube, and Twitch.',
      '<strong>Community &amp; dating:</strong> Recon, FetLife, and Barq.',
      '<strong>Creators &amp; support:</strong> OnlyFans, JustForFans, Patreon, Ko-fi, Substack, and Medium.',
      '<strong>Money &amp; shops:</strong> PayPal, Venmo, Cash App, Amazon Wishlist, and Etsy.',
      'Plus LinkedIn, GitHub, Steam, Spotify, Strava, Flickr, and Calendly. You can always add any other site as a custom link.',
      'You can also add a phone number, email address, and a location. Whoever opens your card can download it straight to their contacts as a .vcf file.',
      'Don’t see one you want? Email <a href="mailto:dev@canid.app">dev@canid.app</a> and it may get added.',
    ],
  },
  {
    q: 'Why does my link look like random characters?',
    a: [
      'Your card is scrambled into the link so it doesn’t sit there as plain text. That way a casual bot or scraper crawling a link you posted somewhere can’t simply read your handles out of the address bar.',
      'Important: scrambled is not the same as encrypted or private. There is no secret key. The viewer page unscrambles the link on its own, so anyone you hand the link or QR to can open it and see everything in that group. Only put things on a card that you’re comfortable having out in the world.',
    ],
  },
  {
    q: 'Can I use this as a link-in-bio, or embed it anywhere else?',
    a: [
      'Yes! canid links are long and ugly, but on services where you can add a hyperlink with a title, this is not an issue. You can also run canid links through a shortener, but this introduces a server (and often a tracker) into the chain. canid URLs can also be loaded on NFC tags and stickers depending on ' +
      'the tag’s capacity and how long the canid URL is. Embedding the card itself on a webpage is not supported.'
    ],
  },
  {
    q: 'Can I write my card to an NFC tag?',
    a: [
      'Yes, right from canid (or with a standalone NFC app). If you’re using <strong>Chrome on Android</strong>, an NFC icon appears in the top bar. Tap it, then hold the top of your phone against a blank NFC tag, and the active group’s link is written to it. Anyone can then tap the tag with their phone to open your card.',
      'This uses your browser’s built-in NFC support, which today is only available in Chrome on Android, so the icon won’t show on iPhone or on desktop. Writing never locks the tag, so you can reuse and overwrite it as often as you like.',
      'Tags come in different capacities. A longer card link needs a roomier tag (for example an NTAG215 or NTAG216 rather than a basic NTAG213). canid will hint if your link is on the long side, and if a tag is too small the write will fail.'
    ],
  },
  {
    q: 'Can you (canid) see my handles?',
    a: [
      'No. The part of a web address after the “#” is never sent to any server — your ' +
      'browser keeps it on your device. So your handles never reach canid, and they never ' +
      'reach Cloudflare either. The server simply hosts the front-end files that decode the ' +
      'card on your own device.',
      'For honesty: the site is delivered through Cloudflare, which protects it from attacks ' +
      'and outages. Like any network provider, Cloudflare can see that some device requested a ' +
      'canid page, along with basic connection details such as an IP address but never the ' +
      'contents of your card, because that part of the link is never transmitted. ' +
      'To count how many people use the site we use Simple Analytics, a privacy-first, ' +
      'cookieless service that tallies page visits anonymously. It never sees your card ' +
      'and never tracks you across sites. It runs only on the landing and information pages — ' +
      'not in the editor, and not on the viewer page that opens a card — so there is still no ' +
      'way for anyone to see who opened your card or what was inside it.',
    ],
  },
  {
    q: 'Can I un-share or “revoke” a link I already gave out?',
    a: [
      'No. A link or QR is a ' +
      'snapshot of your card at the moment you shared it. Once someone has it, they ' +
      'keep that snapshot, exactly like a paper card you handed over. There is no ' +
      'server to switch off and no way to reach into their phone.',
      'So only put things on a card that you are comfortable having out in the world, ' +
      'and share the more personal groups with people you trust.',
    ],
  },
  {
    q: 'I edited my card. Why do I have to share it again?',
    a: [
      'Because the old link is a snapshot encoded in the URL, it still points to your card as it was ' +
      'when you shared it. Your edits live on your device, not in links you already ' +
      'handed out. To share the new version, copy a fresh link or show your QR again. ' +
      'The Copy button tells you when your link is out of date.',
    ],
  },
  {
    q: 'What happens if I clear my browser or get a new phone?',
    a: [
      'Your editable card lives only on the device you made it on. A full backup restores ' +
      'everything — every group and profile — so it’s the copy to rely on. A share link you ' +
      'saved for yourself works as a partial fallback: paste it into Back up &amp; restore and ' +
      'canid rebuilds that card’s handles as a new profile (a link only carries one group, so ' +
      'the rest isn’t in it). Without either, clearing your data or switching phones means ' +
      'starting from scratch. Use Back up &amp; restore to save a copy you can move to another ' +
      'device or keep in a password manager.',
      'One thing to know on iPhone and iPad: if you use canid in a Safari tab without ' +
      'installing it, Apple may automatically delete its saved data after about a week of ' +
      'not opening it. Installing canid to your Home Screen avoids that.',
    ],
  },
  {
    q: 'What happens if canid ever shuts down?',
    a: [
      'Your data isn’t held hostage. There’s no server-side copy of your card to lose in ' +
      'the first place. But the viewer page that turns a link back into a card is served ' +
      'from canid.app, so if the site ever went offline, shared links would stop rendering ' +
      'until someone put a viewer back up.',
      'That’s why canid is open source (AGPL): the code ' +
      'and the link format are public, so anyone can run their own viewer or decode a card ' +
      'without us. Your backup file is plain JSON and stays readable no matter what happens ' +
      'to the site.',
    ],
  },
  {
    q: 'Can I save cards other people share with me?',
    a: [
      'Yes. When you open a card someone shared, tap <strong>Save</strong> to keep it in your ' +
      'Saved cards. Give each one a name when you ' +
      'save it so it’s easy to find later, and remove any card whenever you like.',
      'Saved cards work like everything else in canid: they live only on your device and are never ' +
      'uploaded anywhere, so canid still can’t see them. Saving a card doesn’t verify it or vouch ' +
      'for whoever made it so the same “only trust cards from people you know” rule applies.',
      'Because they’re stored on your device, the same caveats apply: clearing your browser can remove ' +
      'them, and an uninstalled Safari tab on iPhone may drop them after about a week. Use ' +
      '<strong>Back up</strong> on the Saved cards page to keep a copy, and <strong>Add by link</strong> ' +
      'to save a card on iPhone, where shared links open in the browser rather than the app.',
    ],
  },
  {
    q: 'Are the groups really private?',
    a: [
      'Whoever scans a particular code or clicks a link sees only the group you shared, and can’t tell the other ' +
      'groups exist. But a group is only as private as the link. Anyone who gets that ' +
      'particular link or QR sees everything in that group. And because each link is a ' +
      'snapshot, anyone you already shared with keeps the version they got; later edits ' +
      'only appear in a fresh link.',
    ],
  },
  {
    q: 'What’s the difference between groups and profiles?',
    a: [
      'A profile holds a few groups (say Everyone, Friends, Close), all drawing from the same set of handles. Each group is its own shareable card, and you choose which one a given link or QR reveals.',
      'Profiles are the level above: each is a completely separate set of cards, with its own handles, its own groups, its own display name, and its own color. Different profiles share nothing. Use the bar at the top of the editor to name, switch between, and manage them — and to see at a glance which profile you’re about to share from.',
      'Like everything else, profiles live only on your device and are never uploaded. One backup covers all of them at once, so you don’t need to track a separate one per profile.',
    ],
  },
  {
    q: 'Is it really free? Any tracking or ads?',
    a: [
      'Free, with no accounts, no cookies, and no ads. The only third-party script is Simple Analytics' +
      ' — a privacy-first, cookieless tool that counts page visits anonymously, ' +
      'doesn’t track you across sites, and never sees your card. It runs on the landing and ' +
      'information pages — not in the editor or on the viewer page that opens a card. (The site is ' +
      'delivered through Cloudflare for security and speed; see “Can you (canid) see my ' +
      'handles?” above for exactly what that can and can’t see.) There’s no card data to ' +
      'monetize, and that isn’t the point of canid anyway.',
    ],
  },
  {
    q: 'Is canid open source?',
    a: [
      'Yes. The full source code is on <a href="https://github.com/canid-app/canid" target="_blank" rel="noopener">GitHub</a>, ' +
      'licensed under AGPL-3.0. Bug reports and contributions are welcome.',
    ],
  },
  {
    q: 'Why did you make this?',
    a: [
      'I don’t like surveillance capitalism, sharing contacts in chaotic environments is difficult, and I want to be able to share different handles with different groups. That’s pretty much it.',
    ],
  },
  {
    q: 'Found a bug, or have feedback?',
    a: [
      'Email <a href="mailto:dev@canid.app">dev@canid.app</a>.'
    ],
  },
  {
    q: 'Credits',
    a: [
      'Type is set in <em>Karrik</em>, by Jean-Baptiste Morizot and Lucas Le Bihan, distributed by <a href="https://velvetyne.fr/fonts/karrik/" target="_blank" rel="noopener">velvetyne.fr</a>.',
    ],
  },
];

export function renderFAQ(container) {
  container.innerHTML = '';
  for (const item of FAQ_ITEMS) {
    const details = document.createElement('details');
    details.className = 'faq-item';

    const summary = document.createElement('summary');
    summary.className = 'faq-q';
    summary.textContent = item.q;
    details.appendChild(summary);

    const body = document.createElement('div');
    body.className = 'faq-a';
    for (const para of item.a) {
      const p = document.createElement('p');
      p.innerHTML = para; // trusted static copy
      body.appendChild(p);
    }
    details.appendChild(body);
    container.appendChild(details);
  }
}
