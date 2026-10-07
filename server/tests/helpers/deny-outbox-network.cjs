const deny = () => { throw new Error('OFFLINE_TEST_NETWORK_BLOCKED'); };
require('node:net').Socket.prototype.connect = deny;
require('node:tls').connect = deny;
require('node:http').request = deny;
require('node:https').request = deny;
globalThis.fetch = deny;
