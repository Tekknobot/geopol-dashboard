import type { Metadata } from "next";
import DeskPage, { type DeskConfig } from "../components/DeskPage";

export const metadata:Metadata={title:"Entertainment | ATLAS",description:"Live film, television, music, gaming, arts and culture headlines with pictures and a global map."};

const config:DeskConfig={
  desk:"entertainment",
  eyebrow:"ATLAS CULTURE DESK / LIVE",
  title:"Entertainment, everywhere.",
  intro:"A visual, source-first view of film, television, music, games, books, theatre, creators and the global arts economy.",
  categories:[
    {name:"Film",glyph:"◐",description:"Cinema, festivals, releases and filmmakers"},
    {name:"Television",glyph:"▣",description:"Series, broadcasting and the small screen"},
    {name:"Music",glyph:"♪",description:"Artists, albums, tours and festivals"},
    {name:"Streaming",glyph:"▶",description:"Platforms, releases and viewing culture"},
    {name:"Awards",glyph:"✦",description:"Nominations, ceremonies and major prizes"},
    {name:"Gaming",glyph:"⌘",description:"Games, studios, platforms and players"},
    {name:"Books & Publishing",glyph:"▤",description:"Authors, publishing and literary prizes"},
    {name:"Theatre",glyph:"◒",description:"Stage, Broadway, West End and performance"},
    {name:"Celebrity & Creators",glyph:"◎",description:"Public figures and digital creators"},
    {name:"Arts & Design",glyph:"◇",description:"Art, museums, exhibitions and design"},
  ],
  lenses:[
    {title:"On screen",copy:"Follow cinema, television and the shifting streaming landscape.",topics:["Film","Television","Streaming"]},
    {title:"Sound & stage",copy:"Albums, tours, theatre, festivals and live performance.",topics:["Music","Theatre","Awards"]},
    {title:"Play & create",copy:"Games, books, visual art and the people shaping culture.",topics:["Gaming","Books & Publishing","Arts & Design"]},
  ],
};

export default function EntertainmentPage(){return <DeskPage config={config}/>;}
