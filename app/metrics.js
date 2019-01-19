import storage from './storage';

let appState = null;
// let experiment = null;
const events = [];
const session_id = Date.now();

export default function initialize(state, emitter) {
  appState = state;
  emitter.on('DOMContentLoaded', () => {
    addExitHandlers();
    // experiment = storage.enrolled[0];
    addEvent(category(), 'visit', {
      cm5: storage.totalUploads,
      cm6: storage.files.length,
      cm7: storage.totalDownloads
    });
  });
  emitter.on('exit', exitEvent);
  emitter.on('experiment', experimentEvent);
  window.addEventListener('unload', submitEvents);
}

function category() {
  switch (appState.route) {
    case '/':
    case '/share/:id':
      return 'sender';
    case '/download/:id/:key':
    case '/download/:id':
    case '/completed':
      return 'recipient';
    default:
      return 'other';
  }
}

// function sizeOrder(n) {
//   return Math.floor(Math.log10(n));
// }

function submitEvents() {
  const data = new Blob(
    [
      JSON.stringify({
        now: Date.now(),
        session_id,
        user_id: appState.user.id,
        device_id: storage.id,
        lang: document.querySelector('html').lang,
        user_properties: {
          account: appState.user.loggedIn,
          current_uploads: storage.files.length
        },
        events
      })
    ],
    { type: 'application/json' }
  );
  events.splice(0);
  if (!navigator.sendBeacon) {
    return;
  }
  navigator.sendBeacon('/api/metrics', data);
}

function addEvent(category, type, info) {
  events.push({
    time: Date.now(),
    event_type: type,
    event_properties: info
  });
  if (events.length === 25) {
    submitEvents();
  }
}

function urlToMetric(url) {
  switch (url) {
    case 'https://www.mozilla.org/':
      return 'mozilla';
    case 'https://www.mozilla.org/about/legal':
      return 'legal';
    case 'https://testpilot.firefox.com/about':
      return 'about';
    case 'https://testpilot.firefox.com/privacy':
      return 'privacy';
    case 'https://testpilot.firefox.com/terms':
      return 'terms';
    case 'https://www.mozilla.org/privacy/websites/#cookies':
      return 'cookies';
    case 'https://github.com/mozilla/send':
      return 'github';
    case 'https://twitter.com/FxTestPilot':
      return 'twitter';
    case 'https://www.mozilla.org/firefox/new/?scene=2':
      return 'download-firefox';
    case 'https://qsurvey.mozilla.com/s3/txp-firefox-send':
      return 'survey';
    case 'https://www.mozilla.org/firefox/new/?utm_campaign=send-acquisition&utm_medium=referral&utm_source=send.firefox.com':
      return 'promo';
    default:
      return 'other';
  }
}

function setReferrer(state) {
  if (category() === 'sender') {
    if (state) {
      storage.referrer = `${state}-upload`;
    }
  } else if (category() === 'recipient') {
    if (state) {
      storage.referrer = `${state}-download`;
    }
  }
}

function takeReferrer() {
  const referrer = storage.referrer || 'external';
  storage.referrer = null;
  return referrer;
}

function startedUpload(params) {
  return addEvent('sender', 'upload-started', {
    cm1: params.size,
    cm5: storage.totalUploads,
    cm6: storage.files.length + 1,
    cm7: storage.totalDownloads,
    cd1: params.type,
    cd5: takeReferrer()
  });
}

function cancelledUpload(params) {
  setReferrer('cancelled');
  return addEvent('sender', 'upload-stopped', {
    cm1: params.size,
    cm5: storage.totalUploads,
    cm6: storage.files.length,
    cm7: storage.totalDownloads,
    cd1: params.type,
    cd2: 'cancelled'
  });
}

function completedUpload(params) {
  return addEvent('sender', 'upload-stopped', {
    cm1: params.size,
    cm2: params.time,
    cm3: params.speed,
    cm5: storage.totalUploads,
    cm6: storage.files.length,
    cm7: storage.totalDownloads,
    cd1: params.type,
    cd2: 'completed'
  });
}

function addedPassword(params) {
  return addEvent('sender', 'password-added', {
    cm1: params.size,
    cm5: storage.totalUploads,
    cm6: storage.files.length,
    cm7: storage.totalDownloads
  });
}

function startedDownload(params) {
  return addEvent('recipient', 'download-started', {
    cm1: params.size,
    cm4: params.ttl,
    cm5: storage.totalUploads,
    cm6: storage.files.length,
    cm7: storage.totalDownloads
  });
}

function stoppedDownload(params) {
  return addEvent('recipient', 'download-stopped', {
    cm1: params.size,
    cm5: storage.totalUploads,
    cm6: storage.files.length,
    cm7: storage.totalDownloads,
    cd2: 'errored',
    cd6: params.err
  });
}

function cancelledDownload(params) {
  setReferrer('cancelled');
  return addEvent('recipient', 'download-stopped', {
    cm1: params.size,
    cm5: storage.totalUploads,
    cm6: storage.files.length,
    cm7: storage.totalDownloads,
    cd2: 'cancelled'
  });
}

function stoppedUpload(params) {
  return addEvent('sender', 'upload-stopped', {
    cm1: params.size,
    cm5: storage.totalUploads,
    cm6: storage.files.length,
    cm7: storage.totalDownloads,
    cd1: params.type,
    cd2: 'errored',
    cd6: params.err
  });
}

function changedDownloadLimit(params) {
  return addEvent('sender', 'download-limit-changed', {
    cm1: params.size,
    cm5: storage.totalUploads,
    cm6: storage.files.length,
    cm7: storage.totalDownloads,
    cm8: params.dlimit
  });
}

function completedDownload(params) {
  return addEvent('recipient', 'download-stopped', {
    cm1: params.size,
    cm2: params.time,
    cm3: params.speed,
    cm5: storage.totalUploads,
    cm6: storage.files.length,
    cm7: storage.totalDownloads,
    cd2: 'completed'
  });
}

function deletedUpload(params) {
  return addEvent(category(), 'upload-deleted', {
    cm1: params.size,
    cm2: params.time,
    cm3: params.speed,
    cm4: params.ttl,
    cm5: storage.totalUploads,
    cm6: storage.files.length,
    cm7: storage.totalDownloads,
    cd1: params.type,
    cd4: params.location
  });
}

function unsupported(params) {
  return addEvent(category(), 'unsupported', {
    cd6: params.err
  });
}

function copiedLink(params) {
  return addEvent('sender', 'copied', {
    cd4: params.location
  });
}

function exitEvent(target) {
  return addEvent(category(), 'exited', {
    cd3: urlToMetric(target.currentTarget.href)
  });
}

function experimentEvent(params) {
  return addEvent(category(), 'experiment', params);
}

// eslint-disable-next-line no-unused-vars
function addExitHandlers() {
  const links = Array.from(document.querySelectorAll('a'));
  links.forEach(l => {
    if (/^http/.test(l.getAttribute('href'))) {
      l.addEventListener('click', exitEvent);
    }
  });
}

function restart(state) {
  setReferrer(state);
  return addEvent(category(), 'restarted', {
    cd2: state
  });
}

export {
  copiedLink,
  startedUpload,
  cancelledUpload,
  stoppedUpload,
  completedUpload,
  changedDownloadLimit,
  deletedUpload,
  startedDownload,
  cancelledDownload,
  stoppedDownload,
  completedDownload,
  addedPassword,
  restart,
  unsupported
};
