// A client is "archived" when info.archived is set — paused clients, or ones
// who temporarily cancelled and might come back. Their data is kept, but they
// drop out of the day-to-day dashboards across every app. isArchived is the
// single source of truth every list filters on.
export const isArchived = (c) => !!(c && c.info && c.info.archived)
