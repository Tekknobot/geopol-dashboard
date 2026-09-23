"use client";

import {useLanguage} from "./LanguageProvider";

export default function LanguageToggle({compact=false}:{compact?:boolean}){
  const {language,setLanguage}=useLanguage();
  return <div className={`atlas-language-toggle${compact?" compact":""}`} role="group" aria-label="Language / மொழி">
    <button type="button" className={language==="en"?"active":""} aria-pressed={language==="en"} onClick={()=>setLanguage("en")}>EN</button>
    <span aria-hidden>/</span>
    <button type="button" lang="ta-LK" className={language==="ta"?"active":""} aria-pressed={language==="ta"} title="தலைப்புகளும் சுருக்கங்களும் தானாக தமிழாக்கம் செய்யப்படும். மூலக் கட்டுரை மாற்றமில்லை." onClick={()=>setLanguage("ta")}>தமிழ்</button>
  </div>;
}
