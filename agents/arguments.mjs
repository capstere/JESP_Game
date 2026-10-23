// Canonicalize one observed transport representation, then apply normal validation.
// No code evaluation, no fuzzy parsing, no permission changes.
export function normalizeToolArguments(tool,args){
 if(!args||typeof args!=="object"||Array.isArray(args))return {args,changes:[]};
 if(!["test_files","test_js"].includes(tool)||typeof args.files!=="string")return {args,changes:[]};
 const raw=args.files.trim();
 if(raw.length>1000||!raw.startsWith("[")||!raw.endsWith("]"))throw new Error('files måste vara en JSON-array av befintliga filnamn. Exempel: ["logic.js"].');
 let files;try{files=JSON.parse(raw);}catch{throw new Error('files innehåller ogiltig JSON. Skicka en riktig array, inte en sträng.');}
 if(!Array.isArray(files)||files.length<1||files.length>6||files.some(n=>typeof n!=="string")||new Set(files).size!==files.length)throw new Error('files ska innehålla 1–6 unika filnamn.');
 if(args.name!==undefined)throw new Error('Ange files eller name, inte båda.');
 return {args:{...args,files},changes:['files: strict JSON string -> string array; filenames and permissions still validated by workspace']};
}
