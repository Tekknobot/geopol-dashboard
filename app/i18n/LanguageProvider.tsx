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

type TranslationPair={source:string;translated:string};
type TranslationResponse={translations?:TranslationPair[]};


const LanguageContext=createContext<LanguageContextValue|null>(null);
const STORAGE_KEY="atlas-language";
const originalText=new WeakMap<Text,string>();
const originalAttrs=new WeakMap<Element,Map<string,string>>();
const originalContent=new WeakMap<Element,string>();
const translatedContent=new WeakMap<Element,string>();
const contentCache=new Map<string,string>();
const contentTargets=new Map<string,Set<Element>>();
const contentQueue=new Set<string>();
const TRANSLATED_ATTRS=["aria-label","placeholder","title"] as const;
const CONTENT_SELECTOR="[data-atlas-content-translate]";
let queueTimer:number|null=null;
let activeLanguage:AtlasLanguage="en";

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

function applyContentTranslation(source:string,translated:string){
  contentCache.set(source,translated);
  const targets=contentTargets.get(source);
  if(!targets) return;
  for(const element of targets){
    if(!element.isConnected || activeLanguage!=="ta" || originalContent.get(element)!==source) continue;
    if((element.textContent??"")!==translated) element.textContent=translated;
    translatedContent.set(element,translated);
  }
  contentTargets.delete(source);
}

async function flushContentQueue(){
  queueTimer=null;
  if(activeLanguage!=="ta" || !contentQueue.size) return;
  const pending=[...contentQueue];
  contentQueue.clear();
  const batches:string[][]=[];
  let current:string[]=[];
  let characters=0;
  for(const text of pending){
    if(current.length>=24 || characters+text.length>8000){
      batches.push(current);
      current=[];
      characters=0;
    }
    current.push(text);
    characters+=text.length;
  }
  if(current.length) batches.push(current);

  for(const texts of batches){
    try{
      const response=await fetch("/api/translate",{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({texts}),
      });
      if(!response.ok) throw new Error("Translation service unavailable");
      const data=await response.json() as TranslationResponse;
      const pairs=data.translations??[];
      const received=new Set<string>();
      for(const pair of pairs){
        if(!pair.source) continue;
        received.add(pair.source);
        applyContentTranslation(pair.source,pair.translated||pair.source);
      }
      for(const source of texts){
        if(!received.has(source)) applyContentTranslation(source,source);
      }
    }catch{
      for(const source of texts) applyContentTranslation(source,source);
    }
  }
}

function queueContentTranslation(element:Element,source:string){
  const cached=contentCache.get(source);
  if(cached!==undefined){
    if(activeLanguage==="ta" && originalContent.get(element)===source){
      if((element.textContent??"")!==cached) element.textContent=cached;
      translatedContent.set(element,cached);
    }
    return;
  }
  let targets=contentTargets.get(source);
  if(!targets){targets=new Set();contentTargets.set(source,targets);}
  targets.add(element);
  contentQueue.add(source);
  if(queueTimer===null) queueTimer=window.setTimeout(()=>void flushContentQueue(),25);
}

function translateContentElement(element:Element,language:AtlasLanguage){
  const current=(element.textContent??"").trim();
  if(!current) return;
  const known=originalContent.get(element);
  const lastTranslated=translatedContent.get(element);

  if(language==="en"){
    if(known!==undefined && lastTranslated!==undefined && current===lastTranslated){
      element.textContent=known;
    }else if(known!==undefined && current!==known){
      originalContent.set(element,current);
    }
    translatedContent.delete(element);
    return;
  }

  let source=known;
  if(source===undefined || (current!==source && current!==lastTranslated)){
    source=current;
    originalContent.set(element,source);
    translatedContent.delete(element);
  }
  if(!source) return;
  queueContentTranslation(element,source);
}

function translateTree(root:Node,language:AtlasLanguage){
  if(root.nodeType===Node.TEXT_NODE){
    const parent=(root as Text).parentElement;
    const contentParent=parent?.closest(CONTENT_SELECTOR);
    if(contentParent){translateContentElement(contentParent,language);return;}
    if(parent?.closest("[data-atlas-no-ui-translate]")) return;
    translateTextNode(root as Text,language);return;
  }
  if(root.nodeType!==Node.ELEMENT_NODE && root.nodeType!==Node.DOCUMENT_FRAGMENT_NODE) return;
  if(root.nodeType===Node.ELEMENT_NODE){
    const element=root as Element;
    const contentElement=element.matches(CONTENT_SELECTOR)?element:element.closest(CONTENT_SELECTOR);
    if(contentElement){translateContentElement(contentElement,language);return;}
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
    activeLanguage=language;
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
