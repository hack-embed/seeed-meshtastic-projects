export const L2 = Object.freeze({
  title: 'Build with Wio Tracker L2 Pro',
  activity: 'l2-pro',
  product: 'Wio Tracker L2 Pro',
  purchaseUrl: null,
  wikiUrl: 'https://wiki.seeedstudio.com/meshtastic_wio_tracker_l2_intro/',
  contact: 'sensecap@seeed.cc',
  imageSource: 'https://files.seeedstudio.com/wiki/SenseCAP/Wio_Tracker_L2/L2First.png',
});
export const MILESTONES = Object.freeze([
  {id:'reddit', name:'Reddit', threshold:100, metric:'upvotes', hosts:['reddit.com','www.reddit.com'], detail:'on a single post'},
  {id:'facebook', name:'Facebook', threshold:50, metric:'reactions', hosts:['facebook.com','www.facebook.com','m.facebook.com'], detail:'on a single post'},
  {id:'x', name:'X', threshold:30, metric:'likes', hosts:['x.com','www.x.com','twitter.com','www.twitter.com'], detail:'on a single post'},
  {id:'youtube', name:'YouTube', threshold:500, metric:'organic views', hosts:['youtube.com','www.youtube.com','m.youtube.com','youtu.be'], detail:'on a standard video'},
  {id:'youtube-shorts', name:'YouTube Shorts', threshold:1000, metric:'organic views', hosts:['youtube.com','www.youtube.com','m.youtube.com'], detail:'on a single Short'},
]);
export function validPostUrl(value, platform) {
  const rule = MILESTONES.find(m => m.id === platform);
  try {
    const url = new URL(value);
    if (!rule || url.protocol !== 'https:' || url.username || url.password || !rule.hosts.includes(url.hostname)) return false;
    if (platform === 'reddit') return /\/comments\/[a-z0-9]+/i.test(url.pathname);
    if (platform === 'facebook') return /\/(posts|videos|reel|share)\/[^/]+/.test(url.pathname) || ['/permalink.php','/story.php','/photo.php'].includes(url.pathname) && url.searchParams.has('id');
    if (platform === 'x') return /^\/[^/]+\/status\/\d+/.test(url.pathname);
    if (platform === 'youtube-shorts') return /^\/shorts\/[\w-]+/.test(url.pathname);
    return (url.hostname === 'youtu.be' && /^\/[\w-]+$/.test(url.pathname)) || (url.pathname === '/watch' && /^[\w-]+$/.test(url.searchParams.get('v') || ''));
  } catch { return false; }
}
