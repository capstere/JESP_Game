// Small counted assertion API for JSON-shaped data. Runs only in the authorized sandbox.
export const ASSERT_HARNESS=String.raw`let __jesp_assertions=0;
const assert=(ok,message="Assertion failed")=>{__jesp_assertions++;if(!ok)throw new Error(message);};
assert.equal=assert.strictEqual=(actual,expected,message="Expected strict equality")=>assert(Object.is(actual,expected),message);
const __jesp_deep=(a,b,depth=0)=>{if(Object.is(a,b))return true;if(depth>30)throw Error("deepEqual supports acyclic data up to depth 30");if(a===null||b===null||typeof a!=="object"||typeof b!=="object"||Array.isArray(a)!==Array.isArray(b))return false;const ak=Object.keys(a),bk=Object.keys(b);return ak.length===bk.length&&ak.every(k=>Object.hasOwn(b,k)&&__jesp_deep(a[k],b[k],depth+1));};
assert.deepEqual=assert.deepStrictEqual=(actual,expected,message="Expected deep equality")=>assert(__jesp_deep(actual,expected),message);
assert.throws=(fn,expected,message="Expected a thrown error")=>{if(typeof fn!=="function")throw Error("assert.throws requires a function");let error,thrown=false;try{fn();}catch(e){thrown=true;error=e;}assert(thrown&&(expected instanceof RegExp?expected.test(String(error)):typeof expected==="function"?error instanceof expected:true),typeof expected==="string"?expected:message);};
`;
