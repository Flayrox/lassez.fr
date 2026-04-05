import * as tricoteuses from '@tricoteuses/assemblee';

console.log("Exported keys from @tricoteuses/assemblee:");
console.log(Object.keys(tricoteuses));

// Let's print out what methods or properties are available
for (const key of Object.keys(tricoteuses)) {
    const val = tricoteuses[key];
    if (typeof val === 'function') {
        console.log(`- ${key}() [Function]`);
    } else if (typeof val === 'object' && val !== null) {
        console.log(`- ${key} [Object]`);
    } else {
        console.log(`- ${key} [${typeof val}]`);
    }
}
