import{aS as g,aG as r,al as n}from"./outliner-DnBzyUcI.js";import{c,d as f,r as w}from"./react-vendor-DZMOm95h.js";const h=[{id:"blank",name:"Nota en blanco",icon:"📄",text:"",body:""},{id:"meeting",name:"Reunión",icon:"🤝",text:"Reunión - ",body:`## Objetivo

## Asistentes

## Notas

## Próximos pasos
`,types:["reunión"]},{id:"project",name:"Proyecto",icon:"🚀",text:"Proyecto - ",body:`## Objetivo

## Alcance

## Tareas clave

## Notas
`,types:["proyecto"]},{id:"decision",name:"Decisión",icon:"⚖️",text:"Decisión: ",body:`## Contexto

## Opciones consideradas

## Decisión tomada

## Motivo
`,types:["decisión"]},{id:"review",name:"Revisión semanal",icon:"📊",text:"Revisión semanal",body:`## Logros

## Pendiente

## Objetivos próxima semana
`},{id:"idea",name:"Idea",icon:"💡",text:"Idea: ",body:`## Descripción

## Siguiente paso
`,types:["idea"]},{id:"notes",name:"Apuntes",icon:"📓",text:"Apuntes: ",body:`## Contexto

## Puntos clave

## Preguntas
`,types:["apuntes"]},{id:"task-list",name:"Lista de tareas",icon:"✅",text:"Tareas: ",body:`- [ ] 
- [ ] 
- [ ] 
`,types:[]},{id:"reading",name:"Lectura",icon:"📚",text:"Resumen: ",body:`## ¿De qué trata?

## Ideas principales

## Citas

## Acción a tomar
`,types:["lectura"]},{id:"daily",name:"Plan del día",icon:"☀️",text:new Date().toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"long"}),body:`## Objetivos
- 

## Tareas
- [ ] 
- [ ] 

## Notas
`,types:[]}];function S({parentId:m,onClose:a}){const{t:l}=g(),[s,b]=c.useState(""),[d,v]=c.useState(""),p=c.useMemo(()=>{if(!s.trim()||s.trim().length<3)return[];const e=s.trim().toLowerCase();return r.allActive().filter(t=>!t.isDiaryEntry&&!t.deletedAt&&t.text.toLowerCase().includes(e)).slice(0,3)},[s]),u=(()=>{try{const t=JSON.parse(localStorage.getItem("from_custom_templates")||"[]").map(i=>({id:`custom_${i.id}`,name:i.name,icon:"⭐",text:"",body:i.body}));return[...h,...t]}catch{return h}})(),[o,j]=c.useState(u[0]),x=c.useRef(null),y=f();c.useEffect(()=>{var e;(e=x.current)==null||e.focus()},[]);function N(){const e=s.trim()||o.text||"Sin título",t=r.createNode({text:e+(o.text&&!s?new Date().toLocaleDateString("es-ES",{day:"numeric",month:"short"}):""),parentId:m!==void 0?m:null,types:o.types}),i=d.trim()?d.trim()+(o.body?`

`+o.body:""):o.body;i&&r.updateNode(t.id,{body:i}),y(`/node/${t.id}`),a()}return w.createPortal(n.jsx("div",{className:"modal-overlay",onClick:a,children:n.jsxs("div",{className:"modal-card new-note-modal",onClick:e=>e.stopPropagation(),children:[n.jsxs("div",{className:"modal-header",children:[n.jsx("span",{className:"modal-icon",children:"✎"}),n.jsx("h2",{children:l("modal.newNote")}),n.jsx("button",{className:"modal-close-btn",onClick:a,children:"×"})]}),n.jsx("div",{className:"modal-field",children:n.jsx("input",{ref:x,type:"text",className:"modal-input",placeholder:l("modal.newNotePlaceholder"),value:s,onChange:e=>b(e.target.value),onKeyDown:e=>{e.key==="Enter"&&N(),e.key==="Escape"&&a()}})}),p.length>0&&n.jsxs("div",{className:"modal-duplicates-warning",children:[n.jsx("span",{className:"modal-dup-icon",children:"⚠"}),n.jsx("span",{className:"modal-dup-label",children:l("modal.similarNotes")}),p.map(e=>n.jsx("button",{className:"modal-dup-link",onClick:()=>{y(`/node/${e.id}`),a()},children:e.text},e.id))]}),n.jsx("div",{className:"modal-field",children:n.jsx("textarea",{className:"modal-description",placeholder:"Descripción (opcional)",value:d,rows:2,onChange:e=>v(e.target.value),onKeyDown:e=>{e.key==="Escape"&&a()}})}),n.jsxs("div",{className:"note-templates",children:[n.jsx("div",{className:"note-templates-label",children:"Plantilla"}),n.jsx("div",{className:"note-templates-grid",children:u.map(e=>n.jsxs("button",{className:`note-template-btn ${o.id===e.id?"active":""}`,onClick:()=>j(e),children:[n.jsx("span",{className:"note-template-icon",children:e.icon}),n.jsx("span",{className:"note-template-name",children:e.name})]},e.id))})]}),n.jsxs("div",{className:"modal-actions",style:{marginTop:16},children:[n.jsx("button",{className:"btn-secondary",onClick:a,children:l("common.cancel")}),n.jsx("button",{className:"btn-primary",onClick:N,children:l("modal.newNote")})]})]})}),document.body)}export{S as default};
