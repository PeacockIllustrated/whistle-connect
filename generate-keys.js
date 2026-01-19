const fs = require('fs');
const webPush = require('web-push');
const vapidKeys = webPush.generateVAPIDKeys();
const content = `NEXT_PUBLIC_VAPID_PUBLIC_KEY=${vapidKeys.publicKey}\nVAPID_PRIVATE_KEY=${vapidKeys.privateKey}`;
fs.writeFileSync('vapid_keys.txt', content);
console.log('Keys written to vapid_keys.txt');
