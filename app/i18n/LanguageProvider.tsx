"use client";

import {createContext,useCallback,useContext,useEffect,useMemo,useState,type ReactNode} from "react";
import {translateAtlasText,type AtlasLanguage} from "./translations";

type LanguageContextValue={
  language:AtlasLanguage;
  locale:"en-CA"|"ta-LK";
  setLanguage:(language:AtlasLanguage)=>void;
  toggleLanguage:()=>void;
  t:(text:string)=>string;
};

const LanguageContext=createContext<LanguageContextValue|null>(null);
const STORAGE_KEY="atlas-language";
const originalText=new WeakMap<Text,string>();
const originalAttrs=new WeakMap<Element,Map<string,string>>();
const TRANSLATED_ATTRS=["aria-label","placeholder","title"] as const;

function translateTextNode(node:Text,language:AtlasLanguage){
  const current=node.nodeValue??"";
  const known=originalText.get(node);
  if(language==="en"){
    if(known!==undefined){
      const translated=translateAtlasText(known,"ta");
      if(current===translated && current!==known) node.nodeValue=known;
      else if(current!==known) originalText.set(node,current);
    }
    return;
  }
  if(known===undefined){
    originalText.set(node,current);
  }else{
    const expected=translateAtlasText(known,"ta");
    if(current!==expected && current!==known) originalText.set(node,current);
  }
  const source=originalText.get(node)??current;
  const translated=translateAtlasText(source,"ta");
  if(current!==translated) node.nodeValue=translated;
}

function translateElementAttrs(element:Element,language:AtlasLanguage){
  let stored=originalAttrs.get(element);
  if(!stored){stored=new Map(); originalAttrs.set(element,stored);}
  for(const attr of TRANSLATED_ATTRS){
    if(!element.hasAttribute(attr)) continue;
    const current=element.getAttribute(attr)??"";
    const known=stored.get(attr);
    if(language==="en"){
      if(known!==undefined){
        const translated=translateAtlasText(known,"ta");
        if(current===translated && current!==known) element.setAttribute(attr,known);
        else if(current!==known) stored.set(attr,current);
      }
      continue;
    }
    if(known===undefined){stored.set(attr,current);}
    else{
      const expected=translateAtlasText(known,"ta");
      if(current!==expected && current!==known) stored.set(attr,current);
    }
    const source=stored.get(attr)??current;
    const translated=translateAtlasText(source,"ta");
    if(current!==translated) element.setAttribute(attr,translated);
  }
}

function translateTree(root:Node,language:AtlasLanguage){
  if(root.nodeType===Node.TEXT_NODE){
    const parent=(root as Text).parentElement;
    if(parent?.closest("[data-atlas-no-ui-translate]")) return;
    translateTextNode(root as Text,language);return;
  }
  if(root.nodeType!==Node.ELEMENT_NODE && root.nodeType!==Node.DOCUMENT_FRAGMENT_NODE) return;
  if(root.nodeType===Node.ELEMENT_NODE){
    const element=root as Element;
    if(element.closest("[data-atlas-no-ui-translate]")) return;
    if(["SCRIPT","STYLE","CODE","PRE"].includes(element.tagName)) return;
    translateElementAttrs(element,language);
  }
  root.childNodes.forEach((child)=>translateTree(child,language));
}

export function LanguageProvider({children}:{children:ReactNode}){
  const [language,setLanguageState]=useState<AtlasLanguage>("en");

  const setLanguage=useCallback((next:AtlasLanguage)=>{
    setLanguageState(next);
    try{localStorage.setItem(STORAGE_KEY,next);}catch{}
  },[]);
  const toggleLanguage=useCallback(()=>setLanguage(language==="en"?"ta":"en"),[language,setLanguage]);

  useEffect(()=>{
    try{
      const saved=localStorage.getItem(STORAGE_KEY);
      if(saved==="ta"||saved==="en") setLanguageState(saved);
    }catch{}
  },[]);

  useEffect(()=>{
    const locale=language==="ta"?"ta-LK":"en";
    document.documentElement.lang=locale;
    document.documentElement.dataset.atlasLanguage=language;
    translateTree(document.body,language);
    let scheduled=false;
    const observer=new MutationObserver((records)=>{
      if(scheduled)return;
      scheduled=true;
      queueMicrotask(()=>{
        scheduled=false;
        for(const record of records){
          if(record.type==="characterData") translateTree(record.target,language);
          for(const node of record.addedNodes) translateTree(node,language);
          if(record.type==="attributes" && record.target) translateTree(record.target,language);
        }
      });
    });
    observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:[...TRANSLATED_ATTRS]});
    window.dispatchEvent(new CustomEvent("atlas-language-change",{detail:{language}}));
    return()=>observer.disconnect();
  },[language]);

  const value=useMemo<LanguageContextValue>(()=>({
    language,
    locale:language==="ta"?"ta-LK":"en-CA",
    setLanguage,
    toggleLanguage,
    t:(text:string)=>translateAtlasText(text,language),
  }),[language,setLanguage,toggleLanguage]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(){
  const context=useContext(LanguageContext);
  if(!context) throw new Error("useLanguage must be used inside LanguageProvider");
  return context;
}
