// Explicit test-process preload. Never referenced by production entry points.
if (process.env.NODE_ENV === "production") throw new Error("Refusing test fault controls in production");
const net = require('node:net');
const tls = require('node:tls');
const dns = require('node:dns');
const fs = require('node:fs');
const allowed = h => h === undefined || h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '[::1]';
function reject(host) {
  if (allowed(host)) return;
  const entry = JSON.stringify({at:new Date().toISOString(),pid:process.pid,event:'blocked-network-egress',host:String(host).slice(0,255)})+'\n';
  fs.appendFileSync(process.env.BLUEPRINT_TEST_EGRESS_LOG || require('node:path').resolve('work/site-reliability/blocked-egress.jsonl'),entry);
  const error = new Error('Test-only outbound network denied'); error.code='BLUEPRINT_TEST_EGRESS_DENIED'; throw error;
}
function check(args) {
  let arg = args[0];
  if (Array.isArray(arg)) return check(arg);
  if (arg && typeof arg === 'object') { if (!arg.path) reject(arg.host || arg.hostname); }
  else if (typeof arg === 'number') reject(typeof args[1] === 'string' ? args[1] : undefined);
}
const origSocketConnect=net.Socket.prototype.connect;
net.Socket.prototype.connect=function(...args){check(args);return origSocketConnect.apply(this,args);};
const origTlsConnect=tls.connect;
tls.connect=function(...args){check(args);return origTlsConnect.apply(this,args);};
const origLookup=dns.lookup;
dns.lookup=function(host,...args){reject(host);return origLookup.call(this,host,...args);};
const origPromisesLookup=dns.promises.lookup;
dns.promises.lookup=function(host,...args){reject(host);return origPromisesLookup.call(this,host,...args);};

// Node DNS resolver/UDP paths do not necessarily call Socket.connect.
for (const target of [dns, dns.promises, dns.Resolver.prototype, dns.promises.Resolver.prototype]) {
  for (const name of Object.getOwnPropertyNames(target)) {
    if (!/^(resolve|reverse)/.test(name) || typeof target[name] !== 'function') continue;
    const original = target[name];
    target[name] = function(host, ...args) { reject(host); return original.call(this, host, ...args); };
  }
}
require('node:dgram').Socket.prototype.send = function() { reject('UDP transport'); };
