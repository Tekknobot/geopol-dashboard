import type { Metadata } from "next";
import DeskPage, { type DeskConfig } from "../components/DeskPage";

export const metadata:Metadata={title:"Sports | ATLAS",description:"Live global sports headlines with picture carousels, categories and a world map."};

const config:DeskConfig={
  desk:"sports",
  eyebrow:"ATLAS SPORTS DESK / LIVE",
  title:"The world in play.",
  intro:"Global sports coverage across leagues, tournaments, athletes, host cities and the business behind competition—without betting content.",
  categories:[
    {name:"Football",glyph:"●",description:"Global association football and soccer"},
    {name:"American Football",glyph:"⬡",description:"NFL, college and international gridiron"},
    {name:"Basketball",glyph:"◉",description:"Professional, college and international hoops"},
    {name:"Baseball",glyph:"◌",description:"Major leagues and the global game"},
    {name:"Hockey",glyph:"◆",description:"Ice hockey, international play and leagues"},
    {name:"Tennis",glyph:"⊙",description:"Tours, grand slams and rising players"},
    {name:"Cricket",glyph:"│",description:"Tests, one-day cricket and T20"},
    {name:"Motorsport",glyph:"»",description:"Formula racing, endurance and motorsport"},
    {name:"Rugby",glyph:"⬭",description:"Union, league and international tournaments"},
    {name:"Golf",glyph:"⚑",description:"Tours, majors and international golf"},
    {name:"Athletics",glyph:"↗",description:"Track, field, road racing and marathons"},
    {name:"Cycling",glyph:"∞",description:"Grand tours, road and track cycling"},
    {name:"Winter Sports",glyph:"❄",description:"Snow, ice and winter competition"},
    {name:"Olympics & Paralympics",glyph:"◎",description:"Host cities, athletes and the Games"},
    {name:"Women's Sport",glyph:"✦",description:"Women's leagues, teams and athletes"},
    {name:"Esports",glyph:"⌘",description:"Competitive gaming and major events"},
    {name:"Sports Business",glyph:"▥",description:"Media rights, ownership and sponsorship"},
  ],
  lenses:[
    {title:"Global games",copy:"Football, American football, cricket and rugby across international competitions.",topics:["Football","American Football","Cricket","Rugby"]},
    {title:"Courts & diamonds",copy:"Basketball, baseball, hockey and tennis headline wires.",topics:["Basketball","Baseball","Hockey","Tennis"]},
    {title:"Speed & endurance",copy:"Motorsport, athletics, cycling and winter competition.",topics:["Motorsport","Athletics","Cycling","Winter Sports"]},
  ],
};

export default function SportsPage(){return <DeskPage config={config}/>;}
