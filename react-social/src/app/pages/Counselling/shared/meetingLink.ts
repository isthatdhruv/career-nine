/**
 * Counselling sessions run on Microsoft Teams or Google Meet — no other
 * provider's link is accepted (mirrors backend MeetingLinkService).
 */
export const isValidMeetingLink = (link?: string) =>
  /^https:\/\/(teams\.(microsoft|live)\.com|meet\.google\.com)\//i.test((link || '').trim())

export const MEETING_LINK_LABEL = 'Meeting link (Microsoft Teams or Google Meet)'

export const MEETING_LINK_PLACEHOLDER =
  'https://teams.microsoft.com/l/meetup-join/... or https://meet.google.com/...'

export const MEETING_LINK_ERROR =
  'Enter a Microsoft Teams or Google Meet link (teams.microsoft.com, teams.live.com or meet.google.com)'
