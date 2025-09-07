const VAPID_PUBLIC_KEY = 'BBIRVaeDrhp_x22hEH75Mh2dC0_FiggnjZ7h0piBQNqgReef50xECvsyJg-PlMan0pIVWuCHX_vtpJZetnJUiuU';

// Boilerplate to convert VAPID key
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Main subscription logic
async function subscribeUser() {
  let swReg;
  try {
    swReg = await navigator.serviceWorker.ready;
  } catch (e) {
    console.error('Service Worker not ready', e);
    return;
  }

  try {
    const subscription = await swReg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });
    console.log('User is subscribed:', subscription);
    alert('プッシュ通知を購読しました！\nコンソールのログにSubscription JSONが出力されます。');

    // For testing, we just log the subscription object
    // In a real app, you'd send this to your server
    document.getElementById('subscription-json').textContent = JSON.stringify(subscription, null, 2);

  } catch (error) {
    if (Notification.permission === 'denied') {
      console.error('Notification permission was denied.');
      alert('プッシュ通知の許可が拒否されています。ブラウザの設定を確認してください。');
    } else {
      console.error('Failed to subscribe the user: ', error);
      alert('プッシュ通知の購読に失敗しました。');
    }
  }
}

// Attach event listener to the button
document.addEventListener('DOMContentLoaded', () => {
  const subscribeButton = document.getElementById('subscribe-button');
  if (!subscribeButton) return;

  subscribeButton.addEventListener('click', async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      alert('お使いのブラウザはプッシュ通知に対応していません。');
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      subscribeUser();
    }
  });
});