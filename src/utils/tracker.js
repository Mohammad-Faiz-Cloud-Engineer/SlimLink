const geoip = require('geoip-lite');
const UAParser = require('ua-parser-js');
const http = require('http');

function getClientIP(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

function getCountry(ip) {
  if (!ip || ip === 'unknown' || ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') {
    return null;
  }
  const geo = geoip.lookup(ip);
  return geo ? geo.country : null;
}

function parseUA(userAgent) {
  if (!userAgent) {
    return { browser: null, os: null, deviceType: null, deviceVendor: null, deviceModel: null };
  }
  const parser = new UAParser(userAgent);
  const browser = parser.getBrowser();
  const os = parser.getOS();
  const device = parser.getDevice();

  return {
    browser: browser.name && browser.version ? browser.name + ' ' + browser.version : (browser.name || null),
    os: os.name && os.version ? os.name + ' ' + os.version : (os.name || null),
    deviceType: device.type || null,
    deviceVendor: device.vendor || null,
    deviceModel: device.model || null
  };
}

function isPrivateIP(ip) {
  if (!ip) return true;
  return /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|::1|::ffff:)/.test(ip);
}

function lookupISP(ip) {
  return new Promise(function(resolve) {
    var url = 'http://ip-api.com/json/' + ip + '?fields=isp,org,as';
    http.get(url, function(res) {
      var data = '';
      res.on('data', function(c) { data += c; });
      res.on('end', function() {
        try { resolve(JSON.parse(data).isp || null); }
        catch (e) { resolve(null); }
      });
    }).on('error', function() { resolve(null); });
  });
}

module.exports = { getClientIP, getCountry, parseUA, isPrivateIP, lookupISP };
