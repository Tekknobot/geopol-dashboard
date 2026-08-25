import type { Metadata } from "next";
import WorldGrid from "./WorldGrid";

export const metadata: Metadata = {
  title: "World Grid | ATLAS",
  description: "A visual live grid of ATLAS world, sports and entertainment headlines from publisher feeds.",
};

export default function WorldGridPage(){
  return <WorldGrid/>;
}
