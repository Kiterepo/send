const fetch = require('node-fetch');
const config = require('../config');
const pkg = require('../../package.json');

function prepareEvent(
  event,
  ua,
  user_id,
  device_id,
  language,
  session_id,
  deltaT,
  ip
) {
  const event_properties = {
    browser: ua.browser.name,
    browser_version: ua.browser.version
  };
  return {
    ip,
    session_id,
    language,
    app_version: pkg.version,
    time: event.time + deltaT,
    event_type: event.event_type,
    os_name: ua.os.name,
    os_version: ua.os.version,
    user_id,
    device_id,
    event_properties
  };
}

module.exports = async function(req, res) {
  try {
    const data = req.body;
    const deltaT = Date.now() - data.now;
    const events = data.events.map(e =>
      prepareEvent(
        e,
        req.ua,
        data.user_id,
        data.device_id,
        data.lang,
        data.session_id + deltaT,
        deltaT,
        req.ip
      )
    );
    console.log(JSON.stringify(events));
    const result = await fetch('https://api.amplitude.com/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: config.amplitude_id,
        events
      })
    });
    res.sendStatus(result.status);
  } catch (e) {
    res.sendStatus(500);
  }
};
