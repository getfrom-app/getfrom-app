import{cp as g,c6 as r,bi as n}from"./outliner-DDPk9QjX.js";import{d as l,e as f,r as w}from"./react-vendor-Dz82BXTD.js";const N=[{id:"blank",name:"Nota en blanco",icon:"📄",text:"",body:""},{id:"meeting",name:"Reunión",icon:"🤝",text:"Reunión - ",body:`## Objetivo

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
`,types:[]}];function T({parentId:m,onClose:s}){const{t}=g(),[o,b]=l.useState(""),[d,v]=l.useState(""),p=l.useMemo(()=>{if(!o.trim()||o.trim().length<3)return[];const e=o.trim().toLowerCase();return r.allActive().filter(a=>!a.isDiaryEntry&&!a.deletedAt&&a.text.toLowerCase().includes(e)).slice(0,3)},[o]),u=(()=>{try{const a=JSON.parse(localStorage.getItem("from_custom_templates")||"[]").map(c=>({id:`custom_${c.id}`,name:c.name,icon:"⭐",text:"",body:c.body}));return[...N,...a]}catch{return N}})(),[i,j]=l.useState(u[0]),x=l.useRef(null),y=f();l.useEffect(()=>{var e;(e=x.current)==null||e.focus()},[]);function h(){const e=o.trim()||i.text||t("common.noTitle"),a=r.createNode({text:e+(i.text&&!o?new Date().toLocaleDateString("es-ES",{day:"numeric",month:"short"}):""),parentId:m!==void 0?m:null,types:i.types}),c=d.trim()?d.trim()+(i.body?`

`+i.body:""):i.body;c&&r.updateNode(a.id,{body:c}),y(`/node/${a.id}`),s()}return w.createPortal(n.jsx("div",{className:"modal-overlay",onClick:s,children:n.jsxs("div",{className:"modal-card new-note-modal",onClick:e=>e.stopPropagation(),children:[n.jsxs("div",{className:"modal-header",children:[n.jsx("span",{className:"modal-icon",children:"✎"}),n.jsx("h2",{children:t("modal.newNote")}),n.jsx("button",{className:"modal-close-btn",onClick:s,children:"×"})]}),n.jsx("div",{className:"modal-field",children:n.jsx("input",{ref:x,type:"text",className:"modal-input",placeholder:t("modal.newNotePlaceholder"),value:o,onChange:e=>b(e.target.value),onKeyDown:e=>{e.key==="Enter"&&h(),e.key==="Escape"&&s()}})}),p.length>0&&n.jsxs("div",{className:"modal-duplicates-warning",children:[n.jsx("span",{className:"modal-dup-icon",children:"⚠"}),n.jsx("span",{className:"modal-dup-label",children:t("modal.similarNotes")}),p.map(e=>n.jsx("button",{className:"modal-dup-link",onClick:()=>{y(`/node/${e.id}`),s()},children:e.text},e.id))]}),n.jsx("div",{className:"modal-field",children:n.jsx("textarea",{className:"modal-description",placeholder:t("ph.descriptionOptional"),value:d,rows:2,onChange:e=>v(e.target.value),onKeyDown:e=>{e.key==="Escape"&&s()}})}),n.jsxs("div",{className:"note-templates",children:[n.jsx("div",{className:"note-templates-label",children:t("modal.template")}),n.jsx("div",{className:"note-templates-grid",children:u.map(e=>n.jsxs("button",{className:`note-template-btn ${i.id===e.id?"active":""}`,onClick:()=>j(e),children:[n.jsx("span",{className:"note-template-icon",children:e.icon}),n.jsx("span",{className:"note-template-name",children:e.name})]},e.id))})]}),n.jsxs("div",{className:"modal-actions",style:{marginTop:16},children:[n.jsx("button",{className:"btn-secondary",onClick:s,children:t("common.cancel")}),n.jsx("button",{className:"btn-primary",onClick:h,children:t("modal.newNote")})]})]})}),document.body)}export{T as default};
