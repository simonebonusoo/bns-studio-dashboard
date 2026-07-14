import{b as a}from"./downloadService-B8CaVC7O.js";function f(t){if(t==null)return"";const n=typeof t=="object"?JSON.stringify(t):String(t);return/[",\n;]/.test(n)?`"${n.replace(/"/g,'""')}"`:n}function g(t,n){if(n.length===0){i(`${t}.csv`,"");return}const o=Object.keys(n[0]).filter(e=>!["organizationId"].includes(e)),r=o.join(";"),c=n.map(e=>o.map(s=>f(e[s])).join(";")).join(`
`);i(`${t}.csv`,`${r}
${c}`)}async function i(t,n){await a(t,`\uFEFF${n}`,"text/csv;charset=utf-8;")}export{g as e};
