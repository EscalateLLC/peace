import { type ComponentPropsWithRef, type CSSProperties } from 'react';
import { cx } from '../cx';
import './chat-bubble.css';

/** Derive two-letter initials from a name (fallback when `initials` is omitted). */
function deriveInitials (name: string): string {
  const parts = name.trim().split(/\s+/);

  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

export interface ChatBubbleProps extends Omit<ComponentPropsWithRef<'div'>, 'onClick'> {

  /** Display name of the speaker. */
  speaker: string;

  /** Any CSS color for the speaker's avatar + name (defaults to the accent token). */
  speakerColor?: string;

  /** Avatar initials/glyph; derived from `speaker` when omitted. */
  initials?: string;

  /** Pre-formatted timestamp (e.g. "02:14"). */
  time?: string;

  /** `bot` renders peace's own turns (muted/italic). */
  variant?: 'default' | 'bot';

  /** `compact` = dense feed (hover zooms-for-visibility); `comfortable` = reading view. */
  density?: 'compact' | 'comfortable';

  /** Streaming, not-yet-committed — shows the writing caret. */
  interim?: boolean;

  /** Same speaker as the previous message — groups (hides avatar/head in comfortable). */
  grouped?: boolean;

  /** Selected / cross-link-highlighted. */
  selected?: boolean;

  /** The control's own action (content can carry one) — click + Enter/Space. */
  onActivate?: () => void;
}

/**
 * A transcript message as a `content`-intent control: it highlights + zooms for
 * legibility on hover (it never maximizes its surface) and runs `onActivate` on
 * click. Ships an opinionated default look (chat-bubble.css) that is fully
 * overrideable — retheme via `--pk-*`, restyle via the `.pk-bubble*` classes /
 * `data-part` hooks, or merge your own `className`/`style`.
 */
export function ChatBubble ({
  speaker,
  speakerColor,
  initials,
  time,
  variant = 'default',
  density = 'compact',
  interim = false,
  grouped = false,
  selected = false,
  onActivate,
  className,
  style,
  children,
  ...rest
}: ChatBubbleProps) {
  const activate = () => onActivate?.();

  return (
    <div
      {...rest}
      data-part="bubble"
      data-intent="content"
      data-density={density}
      data-variant={variant === 'bot' ? 'bot' : undefined}
      data-interim={interim || undefined}
      data-grouped={grouped || undefined}
      data-selected={selected || undefined}
      role="button"
      tabIndex={0}
      className={cx('pk-bubble', className)}
      style={{
        ...speakerColor ? { '--c': speakerColor } : {},
        ...style
      } as CSSProperties}
      onClick={activate}
      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && activate()}
    >
      <span
        data-part="avatar"
        className="pk-bubble__avatar"
      >
        {initials ?? deriveInitials(speaker)}
      </span>
      <span
        data-part="main"
        className="pk-bubble__main"
      >
        <span
          data-part="head"
          className="pk-bubble__head"
        >
          <span
            data-part="name"
            className="pk-bubble__name"
          >
            {speaker}
          </span>
          {time && (
            <span
              data-part="time"
              className="pk-bubble__time"
            >
              {time}
            </span>
          )}
        </span>
        <span
          data-part="text"
          className="pk-bubble__text"
        >
          {children}
          {interim && <span
            data-part="caret"
            className="pk-bubble__caret"
          />}
        </span>
      </span>
    </div>
  );
}
