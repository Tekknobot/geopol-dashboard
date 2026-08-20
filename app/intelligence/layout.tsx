import type {Metadata} from "next";
import "./intelligence.css";

export const metadata:Metadata={
  title:"ATLAS Intelligence Map",
  description:"An interactive global operating picture combining located publisher headlines, official natural-event feeds and strategic reference layers.",
};

export default function IntelligenceLayout({children}:{children:React.ReactNode}){return children;}
