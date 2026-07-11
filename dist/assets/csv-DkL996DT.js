function a(t){if(t==null)return"";const n=typeof t=="object"?JSON.stringify(t):String(t);return/[",\n;]/.test(n)?`"${n.replace(/"/g,'""')}"`:n}function f(t,n){if(n.length===0){i(`${t}.csv`,"");return}const c=Object.keys(n[0]).filter(e=>!["organizationId"].includes(e)),r=c.join(";"),o=n.map(e=>c.map(s=>a(e[s])).join(";")).join(`
`);i(`${t}.csv`,`${r}
${o}`)}function i(t,n){const r=new Blob([`\uFEFF${n}`],{type:"text/csv;charset=utf-8;"}),o=URL.createObjectURL(r),e=document.createElement("a");e.href=o,e.download=t,e.click(),URL.revokeObjectURL(o)}export{f as e};
