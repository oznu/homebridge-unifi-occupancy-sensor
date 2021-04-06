'use strict';

const events = require('events');
const Rx = require('rxjs');
const RxOp = require('rxjs/operators');
const UnifiEvents = require('unifi-events');
const manifest = require('./package.json');
const url = require('url');

var Service, Characteristic;

module.exports = function (homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  homebridge.registerAccessory('homebridge-unifi-occupancy-sensor',
      'UniFi Occupancy Sensor', OccupancySensor)
};

class OccupancySensor {
  constructor(log, config) {
    this.log = log;
    this.name = config.name;
    this.occupancyService = new Service.OccupancySensor(this.name);

    this.watch = config.monitor || [];

    if (config.watch) {
      for (const watched of config.watch) {
        if (typeof watched === 'string' || watched instanceof String) {
          this.watch.push({ "device": watched, "ap": undefined });
        } else {
          this.watch.push(watched);
        }
      }
    }

    this.watchGuests = config.watchGuests;
    this.mode = config.mode || 'any';
    this.interval = config.interval || 1800;
    this.controller = url.parse(config.unifi.controller);

    this.unifi = new UnifiEvents({
      host: this.controller.hostname,
      port: this.controller.port || 443,
      username: config.unifi.username,
      password: config.unifi.password,
      site: config.unifi.site || 'default',
      insecure: !config.unifi.secure || true,
      unifios: config.unifi.unifios || false,
      listen: true
    });

    this.unifi.on('*.connected', (data) => {
      this.log.debug(`Device Connected Event Received from UniFi Controller: ${data.msg}`);
      return this.checkOccupancy()
    });

    this.unifi.on('*.disconnected', (data) => {
      this.log.debug(`Device Disconnected Event Received from UniFi Controller: ${data.msg}`);
      return this.checkOccupancy()
    });

    this.emitter = new events.EventEmitter();
    this.observable = Rx.fromEvent(this.emitter, 'data');
    this.observable
      .pipe(
        RxOp.debounceTime((config.debounceTime || 0) * 1000),
        RxOp.distinctUntilChanged()
      ).subscribe(value => {
        this.setOccupancyDetected(value);
      });
    this.occupancyDetected = Characteristic.OccupancyDetected.OCCUPANCY_NOT_DETECTED;
    this.checkOccupancy();
    setInterval(this.checkOccupancy.bind(this), this.interval * 1000)
  }

  checkGuest(isGuest, mac) {
    if (this.watchGuests && isGuest) {
      this.log.debug(`Device [${mac}] is connected to a guest network and guest network monitoring is enabled.`);
      return true
    } else if (!this.watchGuests && isGuest) {
      this.log.debug(`Device [${mac}] is connected to a guest network but guest network monitoring is NOT enabled.`);
      return false
    } else {
      this.log.debug(`Device [${mac}] is NOT connected to a guest network.`);
      return true
    }
  }

  isInWatchlist(device) {
    return this.watch.some(watchedDevice => (
        watchedDevice.device === device.mac && (watchedDevice.ap === undefined || watchedDevice.ap  === device.ap_mac))
    );
  }

  checkOccupancy() {
    this.log.debug('Getting list of connected clients from UniFi Controller...');

    return this.unifi.get('stat/sta')
    .then((res) => {
      this.log.debug(`${res.data.length} devices are currently connected to the UniFi network, checking each one to see if any are on the watch list...`);
      let activeDevices = res.data.filter((device) => {
        this.log.debug(`Device [${device.mac}, ${device.ap_mac}] HOSTNAME: "${device.hostname}" , GUEST: "${device.is_guest}", SSID: "${device.essid}"`);
        if (this.isInWatchlist(device) && this.checkGuest(device.is_guest, device.mac)) {
          this.log.debug(`Device [${device.mac}, ${device.ap_mac}] Device is on the watch list. Going to trigger occupancy.`);
          return true
        } else {
          this.log.debug(`Device [${device.mac}] Ignoring. Not on the watch list.`);
          return false
        }
      });

      this.log.debug(`Monitored devices found:`, activeDevices.map(x => x.mac));

      if (this.mode === 'none') {
        if (activeDevices.length > 0) {
          this.log(`${activeDevices.length} monitored device(s) found. Accessory is in mode "none" so NOT triggering occupancy.`);
          this.occupancyDetected = Characteristic.OccupancyDetected.OCCUPANCY_NOT_DETECTED
        } else {
          this.log(`${activeDevices.length} monitored device(s) found. Accessory is in mode "none" so triggering occupancy.`);
          this.occupancyDetected = Characteristic.OccupancyDetected.OCCUPANCY_DETECTED
        }
      } else if (this.mode === 'all') {
        if (activeDevices.length === this.watch.length) {
          this.log(`${activeDevices.length} monitored device(s) found. Accessory is in mode "all" and all watched devices are connected so triggering occupancy.`);
          this.occupancyDetected = Characteristic.OccupancyDetected.OCCUPANCY_DETECTED
        } else {
          this.log(`${activeDevices.length} monitored device(s) found. Accessory is in mode "all" and not all watched devices are connected so NOT triggering occupancy.`);
          this.occupancyDetected = Characteristic.OccupancyDetected.OCCUPANCY_NOT_DETECTED
        }
      } else {
        if (activeDevices.length > 0) {
          this.log(`${activeDevices.length} monitored device(s) found. Accessory is in mode "any" so triggering occupancy.`);
          this.occupancyDetected = Characteristic.OccupancyDetected.OCCUPANCY_DETECTED
        } else {
          this.log(`${activeDevices.length} monitored device(s) found. Accessory is in mode "any" so NOT triggering occupancy.`);
          this.occupancyDetected = Characteristic.OccupancyDetected.OCCUPANCY_NOT_DETECTED
        }
      }

      this.emitter.emit('data', this.occupancyDetected);
    })
    .catch((err) => {
      this.log(`ERROR: Failed to check occupancy: ${err.message}`)
    })
  }

  getOccupancyDetected(callback) {
    return callback(null, this.occupancyDetected)
  }

  setOccupancyDetected(value) {
    this.log(`Setting OccupancyDetected to ${value}`);
    return this.occupancyService.setCharacteristic(Characteristic.OccupancyDetected, value)
  }

  getServices() {
    var informationService = new Service.AccessoryInformation()
    .setCharacteristic(Characteristic.Manufacturer, 'oznu')
    .setCharacteristic(Characteristic.Model, 'unifi-occupancy')
    .setCharacteristic(Characteristic.SerialNumber, manifest.version);

    this.occupancyService
    .getCharacteristic(Characteristic.OccupancyDetected)
    .on('get', this.getOccupancyDetected.bind(this));

    return [informationService, this.occupancyService]
  }
}
