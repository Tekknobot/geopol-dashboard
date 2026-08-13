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
];

export const uploadsPlaylistFor = (channelId: string) =>
  channelId.startsWith("UC") ? `UU${channelId.slice(2)}` : channelId;
