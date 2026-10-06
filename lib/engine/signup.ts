/** Known signup pages for "Claim" links (host suffix → URL). Others fall back to the site homepage. */
const SIGNUP: Record<string, string> = {
  "github.com": "https://github.com/signup",
  "gitlab.com": "https://gitlab.com/users/sign_up",
  "bitbucket.org": "https://id.atlassian.com/signup",
  "medium.com": "https://medium.com/m/signin?operation=register",
  "pinterest.com": "https://www.pinterest.com/",
  "soundcloud.com": "https://soundcloud.com/signin",
  "spotify.com": "https://www.spotify.com/signup",
  "vimeo.com": "https://vimeo.com/join",
  "dribbble.com": "https://dribbble.com/signup/new",
  "behance.net": "https://www.behance.net/signup",
  "deviantart.com": "https://www.deviantart.com/join",
  "patreon.com": "https://www.patreon.com/signup",
  "kofi.com": "https://ko-fi.com/account/register",
  "ko-fi.com": "https://ko-fi.com/account/register",
  "buymeacoffee.com": "https://www.buymeacoffee.com/signup",
  "linktr.ee": "https://linktr.ee/register",
  "about.me": "https://about.me/signup",
  "producthunt.com": "https://www.producthunt.com/login",
  "hackerone.com": "https://hackerone.com/users/sign_up",
  "leetcode.com": "https://leetcode.com/accounts/signup/",
  "codepen.io": "https://codepen.io/accounts/signup",
  "replit.com": "https://replit.com/signup",
  "npmjs.com": "https://www.npmjs.com/signup",
  "pypi.org": "https://pypi.org/account/register/",
  "dev.to": "https://dev.to/enter?state=new-user",
  "hashnode.com": "https://hashnode.com/onboard",
  "keybase.io": "https://keybase.io/",
  "chess.com": "https://www.chess.com/register",
  "lichess.org": "https://lichess.org/signup",
  "roblox.com": "https://www.roblox.com/",
  "itch.io": "https://itch.io/register",
  "kick.com": "https://kick.com/",
  "bsky.app": "https://bsky.app/",
  "threads.net": "https://www.threads.net/",
  "mastodon.social": "https://mastodon.social/auth/sign_up",
  "telegram.me": "https://telegram.org/",
  "t.me": "https://telegram.org/",
  "snapchat.com": "https://accounts.snapchat.com/accounts/signup",
  "tumblr.com": "https://www.tumblr.com/register",
  "flickr.com": "https://identity.flickr.com/sign-up",
  "imgur.com": "https://imgur.com/register",
  "letterboxd.com": "https://letterboxd.com/create-account/",
  "goodreads.com": "https://www.goodreads.com/user/sign_up",
  "duolingo.com": "https://www.duolingo.com/register",
  "strava.com": "https://www.strava.com/register",
  "fiverr.com": "https://www.fiverr.com/join",
  "etsy.com": "https://www.etsy.com/join",
  "ebay.com": "https://signup.ebay.com/",
  "substack.com": "https://substack.com/sign-in",
  "wattpad.com": "https://www.wattpad.com/signup",
  "myanimelist.net": "https://myanimelist.net/register.php",
  "anilist.co": "https://anilist.co/signup",
  "speedrun.com": "https://www.speedrun.com/",
  "kaggle.com": "https://www.kaggle.com/account/login?phase=startRegisterTab",
  "huggingface.co": "https://huggingface.co/join",
  "trello.com": "https://trello.com/signup",
  "wordpress.com": "https://wordpress.com/start",
  "blogger.com": "https://www.blogger.com/",
  "quora.com": "https://www.quora.com/",
  "vk.com": "https://vk.com/join",
  "ok.ru": "https://ok.ru/",
};

export function signupUrlFor(urlTemplateOrMain: string | undefined): string | undefined {
  if (!urlTemplateOrMain) return undefined;
  let host = "";
  try {
    host = new URL(urlTemplateOrMain.replace(/\{u\}/g, "x")).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return undefined;
  }
  for (const [suffix, url] of Object.entries(SIGNUP)) {
    if (host === suffix || host.endsWith(`.${suffix}`)) return url;
  }
  return undefined;
}
