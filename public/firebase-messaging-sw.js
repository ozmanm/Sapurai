// Sapurai — Service Worker dedie a Firebase Cloud Messaging
// Charge automatiquement par Firebase quand l'app appelle getMessaging() + getToken()
// URL standard attendue : /firebase-messaging-sw.js (cote racine du domaine)

importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyCYMOYJwigfnDmThyZo35SI4C_IK0NP-so',
  authDomain: 'sapurai-84984.firebaseapp.com',
  projectId: 'sapurai-84984',
  storageBucket: 'sapurai-84984.firebasestorage.app',
  messagingSenderId: '347109027508',
  appId: '1:347109027508:web:c1b9ab8df00292f9eb71e1',
});

var messaging = firebase.messaging();

// Notif quand app fermee : FCM affiche automatiquement la notif si payload.notification est defini.
// onBackgroundMessage : pour customisation supplementaire (icone, action, click)
messaging.onBackgroundMessage(function (payload) {
  var n = payload && payload.notification ? payload.notification : {};
  var data = payload && payload.data ? payload.data : {};
  var title = n.title || 'Sapurai';
  var options = {
    body: n.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: data,
    tag: data.tag || 'sapurai-default',
    renotify: true,
    requireInteraction: false,
  };
  return self.registration.showNotification(title, options);
});

// Click sur notif : ouvre l'URL data.url ou la racine
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientsList) {
      // Si une fenetre est deja ouverte, focus dessus
      for (var i = 0; i < clientsList.length; i++) {
        var c = clientsList[i];
        if (c.url.indexOf(self.location.origin) === 0 && 'focus' in c) {
          return c.focus().then(function () {
            if ('navigate' in c) c.navigate(url);
          });
        }
      }
      // Sinon ouvrir une nouvelle fenetre
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
