import w from"fs";import g from"path";const p=async(e,t,i)=>{const a=await e.readdir(t);return(await Promise.all(a.map(async r=>{const c=g.join(t,r);if((await e.stat(c)).isDirectory()){const o=await p(e,c,!0);return i?o:o.map(l=>`./${g.relative(t,l)}`)}return i?c:`./${g.relative(t,c)}`}))).flat()},j="*",O=e=>{const t=e.split(j),i=t[0],a=t.length-1,n=t[a],r=t.slice(1,a);return{prefix:i,middle:r,suffix:n}},b=({prefix:e,suffix:t,middle:i},a)=>{if(!a.startsWith(e)||!a.endsWith(t))return;const n=a.slice(e.length,-t.length||void 0);if(i.length===0)return n;let r=0,c="";for(const s of i){const o=n.indexOf(s,r);if(o===-1)return;const l=n.slice(r,o);if(!c)c=l;else if(c!==l)return;r=o+s.length}return c},m=(e,t,i=[],a={})=>{if(t===null||typeof t=="string"){i.length===0&&i.push("default");const n=JSON.stringify(i);if(!Object.hasOwn(a,n))if(t===null)a[n]=t;else if(t.includes(j)){const r=O(t);a[n]=e.map(c=>{const s=b(r,c);return s&&[c,s]}).filter(c=>c!==void 0)}else e.includes(t)&&(a[n]=[t])}else if(Array.isArray(t))for(const n of t)m(e,n,i,a);else if(typeof t=="object"&&t)for(const n in t){if(!Object.hasOwn(t,n))continue;const r=i.slice();r.includes(n)||r.push(n),m(e,t[n],r.sort(),a)}return a},A=(e,t)=>{if(e===null)return{};let i=Object.keys(e);i[0][0]==="."||(e={".":e},i=["."]);const n={},r=[];for(const s of i){const o=m(t,e[s]),l=s.includes(j);for(const f in o){if(!Object.hasOwn(o,f))continue;const h=o[f];if(h)for(let u of h){let d=s;if(l){const y=Array.isArray(u);d=s.split(j).join(y?u[1]:"_"),y&&([u]=u)}n[d]||(n[d]={}),n[d][f]=Array.isArray(u)?u[0]:u}else r.push([l?O(s):s,f])}}const c={};for(const s in n){if(!Object.hasOwn(n,s))continue;const o=Object.entries(n[s]).filter(([l])=>!r.some(([f,h])=>(typeof f=="string"?f===s:b(f,s))&&l===h)).map(([l,f])=>[JSON.parse(l),f]).sort(([l],[f])=>l.length-f.length);o.length>0&&(c[s]=o)}return c},E=async(e,t=w.promises)=>{var i;const a=await t.readFile(g.join(e,"package.json"),"utf8"),n=JSON.parse(a),r=await p(t,e);if(n.exports!==void 0)return A(n.exports,r);const c=/\.(?:json|[cm]?js)$/,s=Object.fromEntries(r.filter(l=>c.test(l)).map(l=>[l,[[["default"],l]]]));let o=(i=n.main)!=null?i:"./index.js";return o[0]!=="."&&(o=`./${o}`),r.includes(o)&&(s["."]=[[["default"],o]]),s};export{E as getPackageEntryPoints};
