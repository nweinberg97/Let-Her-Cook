import { useState } from 'react';
import { Leaf } from 'lucide-react';
import { WallaFeed } from '../components/walla/WallaFeed';
import { TIP_OPTIONS, TIP_URL } from '../lib/tipJar';
import { usePageTitle } from '../lib/usePageTitle';

/**
 * The tip jar. Let 'Em Cook is free forever; people who love it can buy
 * Walla a eucalyptus leaf. Tapping an option plays the feeding scene and,
 * once a tip link is configured, opens it in a new tab at the same moment
 * (so browsers don't block it as a pop-up).
 */
export function FeedWallaPage() {
  usePageTitle('Feed Walla');
  const [play, setPlay] = useState(0);
  const [leaves, setLeaves] = useState(1);
  const [fed, setFed] = useState(false);
  const live = TIP_URL.trim() !== '';

  const feed = (n: number) => {
    if (live) window.open(TIP_URL, '_blank', 'noopener,noreferrer');
    setLeaves(n);
    setPlay((p) => p + 1);
    setFed(true);
  };

  return (
    <div className="page feed-page">
      <section className="feed-hero">
        <div>
          <h1 className="feed-hero__title">
            Free forever. <em>Fueled by eucalyptus.</em>
          </h1>
          <p className="feed-hero__lede">
            No ads, no subscriptions, nothing locked away, and your recipes never leave your device. If Let ’Em Cook helps get dinner on the table, you can buy Walla a eucalyptus leaf.
          </p>
        </div>
        <div className="feed-hero__stage">
          <WallaFeed leaves={leaves} play={play} size={240} />
        </div>
      </section>

      <div className="feed-options" role="group" aria-label="Give Walla eucalyptus">
        {TIP_OPTIONS.map((o) => (
          <button key={o.leaves} type="button" className="feed-option" onClick={() => feed(o.leaves)}>
            <span className="feed-option__leaves" aria-hidden="true">
              {Array.from({ length: o.leaves }, (_, i) => (
                <Leaf key={i} size={20} />
              ))}
            </span>
            <span className="feed-option__label">{o.label}</span>
            {live && <span className="feed-option__price">{o.price}</span>}
          </button>
        ))}
      </div>

      <p className="feed-note" role="status">
        {live
          ? fed
            ? 'Your tip opened in a new tab. Walla says thank you (with her mouth full).'
            : 'Tips open securely in a new tab. Pay what you like — every leaf keeps the app free for everyone.'
          : fed
            ? 'The tip jar opens soon — this one’s on the house. Walla is very grateful anyway.'
            : 'The tip jar opens soon. Until then, feed Walla for free — she won’t complain.'}
      </p>

      <ul className="feed-promise">
        <li>
          <h2>Free forever</h2>
          <p>Every feature, for everyone. Tips are a thank-you, never a paywall.</p>
        </li>
        <li>
          <h2>Private, always</h2>
          <p>No ads, no trackers, and we never sell or share your recipes.</p>
        </li>
        <li>
          <h2>Where leaves go</h2>
          <p>Hosting, new features, and keeping Walla well-fed and motivated.</p>
        </li>
      </ul>
    </div>
  );
}
