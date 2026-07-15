/**
 * NETWORK CONFIGURATION
 *
 * key      → short code used in URL fragments (e.g. "ig" means the fragment key is "ig=")
 * label    → display name shown on viewer cards
 * endpoint → URL prefix prepended to the user's handle to build a clickable link.
 *            Set to null if the platform has no public web profile URL.
 *            Set to 'PASSTHROUGH' for custom full-URL entries (urlType: true).
 * re       → regex that validates the handle. This is the XSS allowlist, be conservative.
 * displayOnly → renders as copyable text instead of a link (for app-only platforms).
 *               Tapping the card copies the handle and offers `site` to open next.
 * site     → homepage opened from the "copied" interstitial on displayOnly cards
 *            (these have no per-user profile URL, so we send people to the app/site).
 * urlType  → value is a full URL the owner pastes, not a username; validated by URL scheme.
 * host     → for a host-locked urlType (e.g. Steam) whose profile URL can't be
 *            rebuilt from a single id, the pasted URL must live on this host (or a
 *            subdomain). The card shows the platform label + the owner's free-text
 *            label as the handle. No interstitial, the destination host is fixed.
 * pathRe   → for a host-locked urlType, the pasted URL's path must also match
 *            this regex. Keeps the link on actual profile pages and off the
 *            host's other routes (e.g. Steam's /linkfilter/ outbound redirect,
 *            which would otherwise ride the trusted host straight off-site).
 * idType   → like a username platform (URL built from endpoint + value, validated
 *            by re), but the value is an opaque id (e.g. a Recon UUID), not a
 *            readable handle. The owner may paste a full profile URL, we extract
 *            the id, or the id itself, may set a label, and the card shows that
 *            label. Only the id travels in the link/QR. No interstitial: the URL
 *            is rebuilt on the platform's own host from a strictly-validated id.
 * hint     → optional one-line guidance shown (wrapping) beneath the field in the
 *            editor, for platforms whose input isn't obvious (e.g. paste-a-link).
 * prefix   → string shown before the handle on viewer cards (default '@'). e.g. 'u/', '$', ''.
 * digits   → input is digits-only; everything else is stripped as you type.
 * suffix   → string appended after the handle to build the link, for platforms that
 *            put the handle in a subdomain rather than a path (e.g. Substack:
 *            endpoint 'https://' + handle + suffix '.substack.com'). The viewer card
 *            shows `handle + suffix` so the full address is visible.
 * noteType → the value is free text the owner wrote, not a handle. Never linked
 *            and never linkified: the card shows the text (side-scrolling) and
 *            opens a read-only dialog with a copy button. The owner may set a
 *            label, which titles both the card and the dialog.
 * maxLen   → caps the editor input. Only set where the value is free text long
 *            enough to matter to link/QR size (notes).
 * addLabel → overrides `label` in the editor's "+ Add another …" button, for the
 *            one platform whose label is plural and reads wrong there.
 * pathLabel → the value may carry one extra path segment (e.g. GitHub's
 *            user/repo). When it does, cards show this label instead of `label`.
 *            Also tells the editor's sanitizer to keep the slash, and to keep
 *            two path segments when a full URL is pasted.
 *
 */
export const REGISTRY = [
  // ── Platforms with public web profiles ────────────────────────────────────
  { key: 'tg',  label: 'Telegram',    endpoint: 'https://t.me/',                  re: /^[A-Za-z0-9_]{5,32}$/ },
  { key: 'x',   label: 'X',           endpoint: 'https://x.com/',                 re: /^[A-Za-z0-9_]{1,15}$/ },
  { key: 'ig',  label: 'Instagram',   endpoint: 'https://instagram.com/',         re: /^[A-Za-z0-9._]{1,30}$/ },
  { key: 'fb',  label: 'Facebook',    endpoint: 'https://facebook.com/',          re: /^[A-Za-z0-9.]{5,50}$/ },
  { key: 'rd',  label: 'Reddit',      endpoint: 'https://www.reddit.com/user/',   re: /^[A-Za-z0-9_-]{3,20}$/, prefix: 'u/' },
  { key: 'bs',  label: 'Bluesky',     endpoint: 'https://bsky.app/profile/',      re: /^[A-Za-z0-9.\-]{1,253}$/ },
  { key: 'sc',  label: 'Snapchat',    endpoint: 'https://snapchat.com/add/',      re: /^[A-Za-z0-9._-]{3,15}$/ },
  { key: 'tt',  label: 'TikTok',      endpoint: 'https://www.tiktok.com/@',       re: /^[A-Za-z0-9._]{2,24}$/ },
  { key: 'th',  label: 'Threads',     endpoint: 'https://www.threads.net/@',      re: /^[A-Za-z0-9._]{1,30}$/ },
  { key: 'yt',  label: 'YouTube',     endpoint: 'https://www.youtube.com/@',      re: /^[A-Za-z0-9._-]{3,30}$/ },
  { key: 'tw',  label: 'Twitch',      endpoint: 'https://twitch.tv/',             re: /^[A-Za-z0-9_]{4,25}$/, prefix: '' },
  { key: 'li',  label: 'LinkedIn',    endpoint: 'https://www.linkedin.com/in/',   re: /^[A-Za-z0-9-]{3,100}$/, prefix: '' },
  { key: 'wa',  label: 'WhatsApp',    endpoint: 'https://wa.me/',                 re: /^[0-9]{7,15}$/, prefix: '+', digits: true,
    placeholder: 'Country code + number',
    hint: 'WhatsApp uses your phone number: country code, then number, digits only (e.g. 15551234567).' },
  { key: 'rc',  label: 'Recon',       endpoint: 'https://www.recon.com/en/profiles/', idType: true, prefix: '',
    hint: 'Paste your Recon profile link or just the profile ID — only the ID is saved.',
    re: /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/ },
  { key: 'of',  label: 'OnlyFans',    endpoint: 'https://onlyfans.com/',       re: /^[A-Za-z0-9._]{1,30}$/ },
  { key: 'jff', label: 'JustForFans', endpoint: 'https://justfor.fans/',       re: /^[A-Za-z0-9._]{1,30}$/ },
  { key: 'fa',  label: 'Fur Affinity', endpoint: 'https://www.furaffinity.net/user/', re: /^[A-Za-z0-9_.~-]{1,40}$/, prefix: '' },

  // ── public web profiles ─────────────────────────────────────────────────
  // Venmo public profile: https://venmo.com/u/{username}
  { key: 'vm',  label: 'Venmo',       endpoint: 'https://venmo.com/u/',        re: /^[A-Za-z0-9_-]{5,30}$/ },
  // Barq share link: https://barq.app/p/{code}
  { key: 'bq',  label: 'Barq',        endpoint: 'https://barq.app/p/',         re: /^[A-Za-z0-9_-]{4,40}$/, prefix: '' },
  // Amazon wish list share link: https://www.amazon.com/hz/wishlist/ls/{listId}
  { key: 'az',  label: 'Amazon Wishlist', endpoint: 'https://www.amazon.com/hz/wishlist/ls/', re: /^[A-Za-z0-9]{10,20}$/, prefix: '',
    hint: 'Paste your wish list share link, or just the list ID (the code after /ls/ in the URL).' },
  // Etsy shop: https://www.etsy.com/shop/{ShopName}
  { key: 'et',  label: 'Etsy',        endpoint: 'https://www.etsy.com/shop/',  re: /^[A-Za-z0-9]{4,20}$/, prefix: '' },
  // Flickr: https://www.flickr.com/photos/{username} (custom URL alias)
  { key: 'fr',  label: 'Flickr',      endpoint: 'https://www.flickr.com/photos/', re: /^[A-Za-z0-9._-]{1,50}$/, prefix: '' },
  // GitHub: https://github.com/{username} or https://github.com/{user}/{repo}
  { key: 'gh',  label: 'GitHub',      endpoint: 'https://github.com/',         re: /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}(?:\/(?!\.{1,2}$)[A-Za-z0-9_.-]{1,100})?$/, prefix: '',
    pathLabel: 'GitHub repo', placeholder: 'username or username/repo',
    hint: 'A username links to your profile; username/repo links to a single repository.' },
  // Medium: https://medium.com/@{username}
  { key: 'md',  label: 'Medium',      endpoint: 'https://medium.com/@',        re: /^[A-Za-z0-9._]{1,50}$/ },
  // PayPal.Me: https://paypal.me/{username}
  { key: 'pp',  label: 'PayPal',      endpoint: 'https://paypal.me/',          re: /^[A-Za-z0-9]{1,20}$/, prefix: '' },
  // Spotify profile: https://open.spotify.com/user/{userId}
  { key: 'sp',  label: 'Spotify',     endpoint: 'https://open.spotify.com/user/', re: /^[A-Za-z0-9._-]{1,40}$/, prefix: '' },
  // Strava athlete: https://www.strava.com/athletes/{numericId}
  { key: 'sv',  label: 'Strava',      endpoint: 'https://www.strava.com/athletes/', re: /^[0-9]{1,20}$/, prefix: '', digits: true },
  // Substack lives on a subdomain: https://{handle}.substack.com
  { key: 'sub', label: 'Substack',    endpoint: 'https://', suffix: '.substack.com', re: /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/, prefix: '' },

  // Profile pages only: /id/{vanity} or /profiles/{steamID64}.
  { key: 'sm',  label: 'Steam',       endpoint: 'PASSTHROUGH', urlType: true, host: 'steamcommunity.com',
    pathRe: /^\/(?:id\/[A-Za-z0-9_-]{1,64}|profiles\/[0-9]{17})\/?$/,
    hint: 'Paste your Steam profile link — steamcommunity.com/id/… or steamcommunity.com/profiles/…' },
  // Calendly: https://calendly.com/{username}
  { key: 'cl',  label: 'Calendly',    endpoint: 'https://calendly.com/',       re: /^[A-Za-z0-9-]{1,50}$/, prefix: '' },

  // ── App-only platforms (no public profile URL, rendered as copyable text) ─
  { key: 'dc',  label: 'Discord',  endpoint: null, displayOnly: true, site: 'https://discord.com',  re: /^[A-Za-z0-9._]{2,32}$/ },
  { key: 'sg',  label: 'Signal',   endpoint: null, displayOnly: true, site: 'https://signal.org',   re: /^[A-Za-z0-9._]{3,32}$/, prefix: '', placeholder: 'username.01' },
  { key: 'fl',  label: 'FetLife',  endpoint: null, displayOnly: true, site: 'https://fetlife.com',  re: /^[A-Za-z0-9._\-]{1,50}$/ },

  // ── Creator support / tips ───────────────────────────────────────────────────
  { key: 'ko',  label: 'Ko-fi',    endpoint: 'https://ko-fi.com/',           re: /^[A-Za-z0-9_]{3,30}$/, prefix: '' },
  { key: 'ca',  label: 'Cash App', endpoint: 'https://cash.app/$',           re: /^[A-Za-z][A-Za-z0-9]{0,19}$/, prefix: '$' },
  { key: 'pa',  label: 'Patreon',  endpoint: 'https://www.patreon.com/',     re: /^[A-Za-z0-9_]{3,50}$/, prefix: '' },

  // ── Phone ────────────────────────────────────────────────────────────────────
  { key: 'ph',  label: 'Phone', endpoint: 'tel:', re: /^[+0-9][0-9 ()\-]{3,19}$/, prefix: '' },

  // ── Email ──────────────────────────────────────────────────────────────────
  { key: 'em',  label: 'Email', endpoint: 'mailto:', re: /^[A-Za-z0-9._+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/ },

  // ── Custom link ──────────────────────────────────
  { key: 'url', label: 'Custom link', endpoint: 'PASSTHROUGH', urlType: true },

  // ── Location ─────────────────────────────────────────────────────────────────
  { key: 'loc', label: 'Location', endpoint: 'GEO', mapType: true, prefix: '',
    re: /^(?=.*[\p{L}\p{N}])[\p{L}\p{N} ,.'#/&()°:+\-]{1,200}$/u },

  // ── Notes ────────────────────────────────────────────────────────────────────
  // Free text. Unlike every other entry above, `re` here is a blocklist rather
  // than an allowlist: a note is arbitrary prose, so enumerating what people are
  // allowed to say isn't possible.
  //
  // What the regex does exclude is the invisible-character classes that enable
  // text spoofing, mirroring text.js's sanitizeText
  { key: 'nt', label: 'Notes', endpoint: null, noteType: true, prefix: '', maxLen: 2048, addLabel: 'note',
    re: /^(?=\s*\S)[^\p{Cc}\p{Cf}\p{Cs}\p{Zl}\p{Zp}]{1,2048}$/u,
    placeholder: 'Anything you want to say',
    hint: 'Plain text only. Links in a note aren’t clickable. Long notes make the QR denser.' },
];

export function urlAllowed(reg, urlStr) {
  if (!reg.host) return true;
  try {
    const u = new URL(urlStr);
    const h = u.hostname.toLowerCase();
    if (h !== reg.host && !h.endsWith('.' + reg.host)) return false;
    return reg.pathRe ? reg.pathRe.test(u.pathname) : true;
  } catch (_) { return false; }
}

export function isValidValue(reg, val) {
  if (reg.urlType) {
    try {
      const u = new URL(val);
      return u.protocol === 'https:' && urlAllowed(reg, u.href);
    } catch (_) { return false; }
  }
  return reg.re.test(val);
}

const PINNED_LAST = ['ph', 'em', 'url', 'loc', 'nt'];
export function byDisplayOrder(a, b) {
  const ap = PINNED_LAST.indexOf(a.key);
  const bp = PINNED_LAST.indexOf(b.key);
  if (ap === -1 && bp === -1) return a.label.localeCompare(b.label);
  if (ap === -1) return -1;
  if (bp === -1) return 1;
  return ap - bp;
}
