/** The bits of the URL and history the board needs, behind an interface so tests can fake them. */
export interface Nav {
  /** The board hash in the URL, without '#'; '' for none. */
  hash(): string
  /** A new history entry, so Back returns to the page as it was. */
  pushHash(hash: string): void
  replaceHash(hash: string): void
  href(): string
  reload(): void
}

/**
 * Changes the URL with pushState/replaceState rather than `location.hash`: on
 * plain-http pages iOS Safari turns a location.hash change into a full reload.
 */
export const browserNav: Nav = {
  hash: () => decodeURIComponent(location.hash.replace(/^#/, '')),
  pushHash: (hash) => history.pushState(null, '', '#' + hash),
  replaceHash: (hash) => history.replaceState(null, '', '#' + hash),
  href: () => location.href,
  reload: () => location.reload(),
}
