"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { label: "World", href: "/", glyph: "⌂" },
  { label: "Intel", href: "/intelligence", glyph: "◎" },
  { label: "Canada", href: "/simulator", glyph: "◫" },
  { label: "Entertainment", href: "/entertainment", glyph: "✦" },
  { label: "Sports", href: "/sports", glyph: "◉" },
  { label: "Live", href: "/#events-section", glyph: "⌁" },
  { label: "Risk", href: "/#risk-section", glyph: "△" },
  { label: "Markets", href: "/#market-section", glyph: "▥" },
  { label: "Indicators", href: "/#indicators-section", glyph: "⌇" },
  { label: "Briefings", href: "/#stories-section", glyph: "▤" },
  { label: "Saved", href: "/#saved-section", glyph: "◇" },
];

export default function MobileSiteNav(){
  const pathname = usePathname();
  return <nav className="atlas-mobile-site-nav" aria-label="ATLAS mobile site navigation">
    <div className="atlas-mobile-site-nav-track">
      {items.map((item)=>{
        const route = item.href.split("#")[0] || "/";
        const active = item.href.includes("#") ? false : pathname===route;
        return <Link key={item.label} href={item.href} className={active?"active":""} aria-current={active?"page":undefined}>
          <span aria-hidden>{item.glyph}</span><small>{item.label}</small>
        </Link>;
      })}
    </div>
  </nav>;
}
