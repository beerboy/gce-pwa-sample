const webpush = require('web-push');

// VAPID keys, subscription object, and mailto are now hardcoded
const vapidKeys = {
  publicKey: 'BBIRVaeDrhp_x22hEH75Mh2dC0_FiggnjZ7h0piBQNqgReef50xECvsyJg-PlMan0pIVWuCHX_vtpJZetnJUiuU',
  privateKey: '4hpF9uvcxfD5PVzWf5-aCIpN8LErykcJC2SPvsFJizA'
};

const pushSubscription = {
  "endpoint": "https://fcm.googleapis.com/fcm/send/dwEcAjhg5Ho:APA91bEfUlNw6FY0fao0jWG_psWO783r-NABJoVZvOMBX5oDFVQK06IFgaQ0JUHHjFhWymJJjWZ-ZAirH6kho37EO8jICZkMr8YVk0phQadm1wEDCgFQfp2s_DVBxEoaDWBVqHhJh5-o",
  "expirationTime": null,
  "keys": {
    "p256dh": "BDycfFlvw1zML2kmzk3zlxcGAcsTlvwCXKLjWz3Cdvb_JqVAyuC1lWzRAZYsXEFySiarGQoWGdiL16C8ZnLlNMA",
    "auth": "M9HN-H9QK7UklZBPdSxooQ"
  }
};

const message = process.argv[2] || 'サーバーからのテストプッシュ通知です！';

webpush.setVapidDetails(
  'mailto:example@yourdomain.org', // A valid email is required
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

console.log('プッシュ通知を送信します...');
console.log('メッセージ:', message);

webpush.sendNotification(pushSubscription, message)
  .then(() => {
    console.log('プッシュ通知は正常にキューに追加されました。');
  })
  .catch(err => {
    console.error('プッシュ通知の送信中にエラーが発生しました:', err);
  });
