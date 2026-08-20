"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

export type SavedStory = {
  id:number;
  desk:"world"|"entertainment"|"sports";
  category:string;
  region:string;
  publishedAt:string;
  title:string;
  summary:string;
  source:string;
  read:string;
  tags:string[];
  articleUrl:string;
  imageUrl?:string;
};

const STORAGE_KEY="atlas:saved-stories:v1";
const CHANGE_EVENT="atlas:saved-stories-changed";

const readSaved=():SavedStory[]=>{
  if(typeof window==="undefined")return [];
  try{
    const value=JSON.parse(window.localStorage.getItem(STORAGE_KEY)??"[]") as unknown;
    if(!Array.isArray(value))return [];
    return value.filter((item):item is SavedStory=>Boolean(item&&typeof item==="object"&&"id" in item&&"title" in item&&"articleUrl" in item));
  }catch{return [];}
};

const writeSaved=(stories:SavedStory[])=>{
  window.localStorage.setItem(STORAGE_KEY,JSON.stringify(stories));
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
};

export function useSavedStories(){
  const [savedStories,setSavedStories]=useState<SavedStory[]>([]);

  useEffect(()=>{
    const sync=()=>setSavedStories(readSaved());
    sync();
    window.addEventListener("storage",sync);
    window.addEventListener(CHANGE_EVENT,sync);
    return()=>{window.removeEventListener("storage",sync);window.removeEventListener(CHANGE_EVENT,sync);};
  },[]);

  const savedIds=useMemo(()=>savedStories.map((story)=>story.id),[savedStories]);
  const isSaved=useCallback((id:number)=>savedStories.some((story)=>story.id===id),[savedStories]);
  const toggleSaved=useCallback((story:SavedStory)=>{
    const current=readSaved();
    const next=current.some((item)=>item.id===story.id)?current.filter((item)=>item.id!==story.id):[story,...current].slice(0,200);
    writeSaved(next);
  },[]);

  return{savedStories,savedIds,isSaved,toggleSaved};
}
