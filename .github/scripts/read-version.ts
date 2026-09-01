const config: unknown = JSON.parse(await Deno.readTextFile('deno.jsonc'));

if (typeof config !== 'object' || config === null || Array.isArray(config)) {
  throw new TypeError('deno.jsonc must contain a top-level object');
}

const version = Reflect.get(config, 'version');
if (typeof version !== 'string') {
  throw new TypeError('deno.jsonc must contain a top-level string version property');
}

console.log(version);
