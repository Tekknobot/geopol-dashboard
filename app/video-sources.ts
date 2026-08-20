export type VideoDesk =
  | "Wires"
  | "Europe"
  | "Americas"
  | "Middle East"
  | "Asia-Pacific"
  | "Africa"
  | "Markets";

export type VideoSource = {
  id: string;
  name: string;
  channelId: string;
  channelUrl: string;
  focus: string;
  region: string;
  desk: VideoDesk;
  room?: "sports" | "entertainment";
};

export const VIDEO_DESKS: Array<"All" | VideoDesk> = [
  "All",
  "Wires",
  "Europe",
  "Americas",
  "Middle East",
  "Asia-Pacific",
  "Africa",
  "Markets",
];

export const VIDEO_SOURCES: VideoSource[] = [
  { id: "reuters", name: "Reuters", channelId: "UChqUTb7kYRX8-EiaN3XFrSQ", channelUrl: "https://www.youtube.com/@Reuters", focus: "Breaking news, diplomacy and global markets", region: "Global wire", desk: "Wires" },
  { id: "associated-press", name: "Associated Press", channelId: "UC52X5wxOL_s5yw0dQk7NtgA", channelUrl: "https://www.youtube.com/@AssociatedPress", focus: "On-the-ground reporting and major world events", region: "Global wire", desk: "Wires" },
  { id: "bbc-news", name: "BBC News", channelId: "UC16niRr50-MSBwiO3YDb3RA", channelUrl: "https://www.youtube.com/@BBCNews", focus: "Breaking news, explainers and international reporting", region: "United Kingdom / Global", desk: "Europe" },
  { id: "dw-news", name: "DW News", channelId: "UCknLrEdhRCp1aegoMqRaCZg", channelUrl: "https://www.youtube.com/@dwnews", focus: "European affairs, security and international analysis", region: "Germany / Global", desk: "Europe" },
  { id: "france-24", name: "France 24 English", channelId: "UCQfwfsi5VrQ8yKZ-UWmAEFg", channelUrl: "https://www.youtube.com/@France24_en", focus: "International breaking news and regional coverage", region: "France / Global", desk: "Europe" },
  { id: "sky-news", name: "Sky News", channelId: "UCoMdktPbSTixAyNGwb-UYkQ", channelUrl: "https://www.youtube.com/@SkyNews", focus: "Live reporting, politics and international affairs", region: "United Kingdom / Global", desk: "Europe" },
  { id: "euronews", name: "Euronews", channelId: "UCSrZ3UV4jOidv8ppoVuvW9Q", channelUrl: "https://www.youtube.com/@euronews", focus: "European institutions, politics and cross-border news", region: "Europe", desk: "Europe" },
  { id: "pbs-newshour", name: "PBS NewsHour", channelId: "UC6ZFN9Tx6xh-skXCuRHCDpQ", channelUrl: "https://www.youtube.com/@PBSNewsHour", focus: "Public-service reporting, interviews and analysis", region: "United States / Global", desk: "Americas" },
  { id: "al-jazeera-english", name: "Al Jazeera English", channelId: "UCNye-wNBqNL5ZzHSJj3l8Bg", channelUrl: "https://www.youtube.com/@aljazeeraenglish", focus: "Middle East coverage and under-reported global stories", region: "Middle East / Global", desk: "Middle East" },
  { id: "cna", name: "CNA", channelId: "UC83jt4dlz1Gjl58fzQrrKZg", channelUrl: "https://www.youtube.com/@channelnewsasia", focus: "Asian affairs, trade and international developments", region: "Singapore / Asia", desk: "Asia-Pacific" },
  { id: "abc-news-australia", name: "ABC News Australia", channelId: "UCVgO39Bk5sMo66-6o6Spn6Q", channelUrl: "https://www.youtube.com/@abcnewsaustralia", focus: "Australia, Pacific affairs and international reporting", region: "Australia / Pacific", desk: "Asia-Pacific" },
  { id: "nhk-world-japan", name: "NHK World-Japan", channelId: "UCSPEjw8F2nQDtmUKPFNF7_A", channelUrl: "https://www.youtube.com/@NHKWORLDJAPAN", focus: "Japan, East Asia and regional public-service reporting", region: "Japan / Asia", desk: "Asia-Pacific" },
  { id: "africanews", name: "Africanews", channelId: "UC1_E8NeF5QHY2dtdLRBCCLA", channelUrl: "https://www.youtube.com/@africanews", focus: "Pan-African politics, economies and regional affairs", region: "Africa", desk: "Africa" },
  { id: "cnbc-international", name: "CNBC International", channelId: "UCo7a6riBFJ3tkeHjvkXPn1g", channelUrl: "https://www.youtube.com/@CNBCInternational", focus: "Global business, economies, energy and markets", region: "Global markets", desk: "Markets" },
  { id: "espn", name: "ESPN", channelId: "UCiWLfSweyRNmLpgEHekhoAg", channelUrl: "https://www.youtube.com/@espn", focus: "Scores, interviews and major competitions", region: "United States / Global", desk: "Americas", room: "sports" },
  { id: "nba", name: "NBA", channelId: "UCWJ2lWNubArHWmf3FIHbfcQ", channelUrl: "https://www.youtube.com/@NBA", focus: "Official basketball highlights and reports", region: "Global basketball", desk: "Americas", room: "sports" },
  { id: "nfl", name: "NFL", channelId: "UCDVYQ4Zhbm3S2dlz7P1GBDg", channelUrl: "https://www.youtube.com/@NFL", focus: "Official American football highlights", region: "United States", desk: "Americas", room: "sports" },
  { id: "mlb", name: "MLB", channelId: "UCoLrcjPV5PbUrUyXq5mjc_A", channelUrl: "https://www.youtube.com/@MLB", focus: "Official baseball highlights and news", region: "Americas / Global", desk: "Americas", room: "sports" },
  { id: "formula-one", name: "Formula 1", channelId: "UCBV0ghP9x4k2e6rv1MjNZLg", channelUrl: "https://www.youtube.com/@Formula1", focus: "Official Formula 1 highlights and features", region: "Global motorsport", desk: "Europe", room: "sports" },
  { id: "fifa", name: "FIFA", channelId: "UCpcTrCXblq78GZrTUTLWeBw", channelUrl: "https://www.youtube.com/@fifa", focus: "Official international football coverage", region: "Global football", desk: "Europe", room: "sports" },
  { id: "netflix", name: "Netflix", channelId: "UCWOA1ZGywLbqmigxE4Qlvuw", channelUrl: "https://www.youtube.com/@Netflix", focus: "Official trailers and series previews", region: "Global entertainment", desk: "Wires", room: "entertainment" },
  { id: "sony-pictures", name: "Sony Pictures", channelId: "UCz97F7dMxBNOfGYu3rx8aCw", channelUrl: "https://www.youtube.com/@SonyPictures", focus: "Official film trailers and features", region: "Global film", desk: "Americas", room: "entertainment" },
  { id: "warner-bros", name: "Warner Bros. Pictures", channelId: "UCjmJDM5pRKbUlVIzDYYWb6g", channelUrl: "https://www.youtube.com/@WarnerBrosPictures", focus: "Official film trailers and announcements", region: "Global film", desk: "Americas", room: "entertainment" },
  { id: "ign", name: "IGN", channelId: "UCKy1dAqELo0zrOtPkf0eTMw", channelUrl: "https://www.youtube.com/@IGN", focus: "Games, film and entertainment coverage", region: "Global gaming", desk: "Wires", room: "entertainment" },
  { id: "gamespot", name: "GameSpot", channelId: "UCbu2SsF-Or3Rsn3NxqODImw", channelUrl: "https://www.youtube.com/@GameSpot", focus: "Game trailers, reviews and industry news", region: "Global gaming", desk: "Wires", room: "entertainment" },
  { id: "npr-music", name: "NPR Music", channelId: "UC4eYXhJI4-7wSWc8UNRwD4A", channelUrl: "https://www.youtube.com/@nprmusic", focus: "Music performances, interviews and discovery", region: "United States / Global", desk: "Americas", room: "entertainment" },
];

export const uploadsPlaylistFor = (channelId: string) =>
  channelId.startsWith("UC") ? `UU${channelId.slice(2)}` : channelId;
