import{aG as m,bC as r,aW as f,i as y,f as h}from"./outliner-CkFdQ2z6.js";import"./react-vendor-DeWpAztq.js";async function p(s,c){const d=Math.round(c/60),l=c>=180,o=f.buildPromptBlock(),t=`Analiza esta transcripción de audio de ${d} ${d===1?"minuto":"minutos"}.
${o?`
${o}
`:""}
Responde ÚNICAMENTE con JSON válido, sin markdown ni texto adicional.

Formato exacto:
{
  "title": "Título breve descriptivo (máximo 7 palabras)",
  "summary": "${l?"Resumen ejecutivo estructurado con los puntos clave, decisiones tomadas y conclusiones principales. Usa saltos de línea para separar bloques.":"Resumen breve de 2-4 frases con la idea principal y el contexto."}",
  "tasks": ["tarea 1", "tarea 2"],
  "context": null
}

Reglas:
- "tasks": array de strings con las acciones concretas mencionadas. VACÍO si no hay tareas claras y explícitas.
- "context": nombre de proyecto o área si se menciona con claridad (ej: "la-isla", "cafe-ole", "media-sector"). null si no es evidente.
- No inventes información que no esté en el audio.

Transcripción:
${s}`;let n="";try{await y(t,void 0,e=>{n+=e})}catch(e){throw e instanceof h?(window.dispatchEvent(new CustomEvent("from:paywall",{detail:{reason:"ai_limit"}})),new Error("TOKENS")):e}const a=n.match(/\{[\s\S]*\}/);if(!a)throw new Error("AI no devolvió JSON válido");try{const e=JSON.parse(a[0]);return{title:(e.title||"Grabación").slice(0,80),summary:(e.summary||"").trim(),tasks:Array.isArray(e.tasks)?e.tasks.filter(Boolean):[],context:typeof e.context=="string"&&e.context?e.context:null}}catch{throw new Error("Error al parsear respuesta de la IA")}}function x(s,c=40){if(!s.trim())return[];const d=s.match(/[^.!?…]+[.!?…]*\s*/g)??[s],l=[];let o="",t=0;for(const n of d){const a=n.trim().split(/\s+/).length;t+a>c&&o?(l.push(o.trim()),o=n,t=a):(o+=(o?" ":"")+n.trim(),t+=a)}return o.trim()&&l.push(o.trim()),l}function g(s){return s.split(`
`).map(c=>c.trim()).filter(Boolean)}async function w(s){const c=r.nodes.get(s);if(!c)return;let d={};try{d=JSON.parse(c.extraData||"{}")}catch{return}const l=typeof d._audioTranscript=="string"?d._audioTranscript:"";if(!l.trim())return;const o=!!d._aiAutoTitle;try{const t=await p(l,0);let n=t.summary||"";t.tasks&&t.tasks.length>0&&(n+=(n?`

`:"")+`**Tareas:**
`+t.tasks.map(e=>`- [ ] ${e}`).join(`
`));const a={};if(t.title&&o){a.text=`🎙 ${t.title}`;const e={...d};delete e._aiAutoTitle,a.extraData=JSON.stringify(e)}n.trim()&&(a.body=n),Object.keys(a).length>0&&r.updateNode(s,a)}catch{}}async function T(s,c){const d=m(),l=new Date;let t=`Nota de voz ${`${l.getHours().toString().padStart(2,"0")}:${l.getMinutes().toString().padStart(2,"0")}`}`,n=null;try{const i=await p(s,c);i.title&&(t=i.title),n=i.context}catch{}const a=n?[n]:[],e=r.createNode({text:t,parentId:d.id,types:a,extraData:{_capture:"1"}});return r.createNode({text:s.trim()||"(sin audio detectado)",parentId:e.id}),r.sync(!0).catch(()=>{}),{parentId:e.id,title:t}}async function S(s,c){const d=m(),l=new Date,o=`${l.getHours().toString().padStart(2,"0")}:${l.getMinutes().toString().padStart(2,"0")}`;let t;try{t=await p(s,c)}catch(i){if(i instanceof Error&&i.message==="TOKENS")throw i;t={title:`Grabación ${o}`,summary:"",tasks:[],context:null}}const n=[];t.context&&n.push(t.context);const a=r.createNode({text:`🎙 ${t.title}`,parentId:d.id,types:n}),e=x(s,50);if(e.length<=1)r.createNode({text:s.trim()||"(sin audio detectado)",parentId:a.id});else{const i=r.createNode({text:"Transcripción",parentId:a.id});for(const u of e)r.createNode({text:u,parentId:i.id})}if(t.summary){const i=r.createNode({text:(c>=180,"Resumen"),parentId:a.id});r.updateNode(i.id,{isCollapsed:!0});for(const u of g(t.summary))r.createNode({text:u,parentId:i.id})}if(t.tasks.length>0){const i=r.createNode({text:"📋 Tareas identificadas",parentId:a.id});r.updateNode(i.id,{isCollapsed:!0});for(const u of t.tasks)r.createNode({text:u,parentId:i.id,isTask:!0})}return r.sync(!0).catch(()=>{}),{parentId:a.id,title:t.title,hasTasks:t.tasks.length>0}}export{T as createNoteFromTranscript,S as processRecording,w as restructureVoiceNote};
