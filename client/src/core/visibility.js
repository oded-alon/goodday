/** Which entries are shown: everything when the family game is off; otherwise the shared ones plus the private ones of the member being viewed as (none by default). */
export const visibleEntries = (entries, familyOn, viewerId) =>
  familyOn ? entries.filter((e) => e.shared || (viewerId && e.profileId === viewerId)) : entries
