'use strict'

const debug = require('debug')('unifi')
const UnifiEvents = require('unifi-events')
const manifest = require('./package.json')

var Service, Characteristic

module.exports = function (homebridge) {
  Service = homebridge.hap.Service
  Characteristic = homebridge.hap.Characteristic
  homebridge.registerAccessory('homebridge-unifi-occupancy-sensor', 'UniFi Occupancy Sensor', OccupancySensor)
}

class OccupancySensor {
  constructor (log, config) {
    this.log = log
    this.name = config.name
    this.occupancyService = new Service.OccupancySensor(this.name)
    this.watch = config.watch || []
    this.watchGuests = config.watchGuests
    this.mode = config.mode || 'any'

    this.unifi = new UnifiEvents({
      controller: config.unifi.controller,
      username: config.unifi.username,
      password: config.unifi.password,
      site: config.unifi.site || 'default',
      rejectUnauthorized: config.unifi.secure || false,
      listen: true
    })

    this.unifi.on('websocket-status', (socketLog) => {
      this.log(socketLog)
    })

    this.unifi.on('connected', (data) => {
      debug(`Device Connected Event Received from UniFi Controller: ${data.msg}`)
      return this.checkOccupancy()
    })

    this.unifi.on('disconnected', (data) => {
      debug(`Device Disconnected Event Received from UniFi Controller: ${data.msg}`)
      return this.checkOccupancy()
    })

    this.occupancyDetected = Characteristic.OccupancyDetected.OCCUPANCY_NOT_DETECTED
    this.checkOccupancy()
    setInterval(this.checkOccupancy.bind(this), 1800 * 1000)
  }

  checkGuest (isGuest, mac) {
    if (this.watchGuests && isGuest) {
      debug(`Device [${mac}] is connected to a guest network and guest network monitoring is enabled.`)
      return true
    } else if (!this.watchGuests && isGuest) {
      debug(`Device [${mac}] is connected to a guest network but guest network monitoring is NOT enabled.`)
      return false
    } else {
      debug(`Device [${mac}] is NOT connected to a guest network.`)
      return true
    }
  }

  checkOccupancy () {
    debug('Getting list of connected clients from UniFi Controller...')
    return this.unifi.getClients()
      .then((res) => {
        debug(`${res.data.length} devices are currently connected to the UniFi network, checking each one to see if any are on the watch list...`)

        let activeDevices = res.data.filter((device) => {
          debug(`Device [${device.mac}] HOSTNAME: "${device.hostname}" , GUEST: "${device.is_guest}", SSID: "${device.essid}"`)
          if (this.watch.includes(device.mac) && this.checkGuest(device.is_guest, device.mac)) {
            debug(`Device [${device.mac}] Device is on the watch list. Going to trigger occupancy.`)
            return true
          } else {
            debug(`Device [${device.mac}] Ignoring. Not on the watch list.`)
            return false
          }
        })

        debug(`Monitored devices found:`, activeDevices.map(x => x.mac))

        if (this.mode === 'none') {
          if (activeDevices.length > 0) {
            this.log(`${activeDevices.length} monitored device(s) found. Accessory is in mode "none" so NOT triggering occupancy.`)
            this.occupancyDetected = Characteristic.OccupancyDetected.OCCUPANCY_NOT_DETECTED
          } else {
            this.log(`${activeDevices.length} monitored device(s) found. Accessory is in mode "none" so triggering occupancy.`)
            this.occupancyDetected = Characteristic.OccupancyDetected.OCCUPANCY_DETECTED
          }
        } else if (this.mode === 'all') {
          if (activeDevices.length === this.watch.length) {
            this.log(`${activeDevices.length} monitored device(s) found. Accessory is in mode "all" and all watched devices are connected so triggering occupancy.`)
            this.occupancyDetected = Characteristic.OccupancyDetected.OCCUPANCY_DETECTED
          } else {
            this.log(`${activeDevices.length} monitored device(s) found. Accessory is in mode "all" and not all watched devices are connected so NOT triggering occupancy.`)
            this.occupancyDetected = Characteristic.OccupancyDetected.OCCUPANCY_NOT_DETECTED
          }
        } else {
          if (activeDevices.length > 0) {
            this.log(`${activeDevices.length} monitored device(s) found. Accessory is in mode "any" so triggering occupancy.`)
            this.occupancyDetected = Characteristic.OccupancyDetected.OCCUPANCY_DETECTED
          } else {
            this.log(`${activeDevices.length} monitored device(s) found. Accessory is in mode "any" so NOT triggering occupancy.`)
            this.occupancyDetected = Characteristic.OccupancyDetected.OCCUPANCY_NOT_DETECTED
          }
        }

        this.setOccupancyDetected(this.occupancyDetected)
      })
      .catch((err) => {
        this.log(`ERROR: Failed to check occupancy: ${err.message}`)
      })
  }

  getOccupancyDetected (callback) {
    return callback(null, this.occupancyDetected)
  }

  setOccupancyDetected (value) {
    return this.occupancyService.setCharacteristic(Characteristic.OccupancyDetected, value)
  }

  getServices () {
    var informationService = new Service.AccessoryInformation()
      .setCharacteristic(Characteristic.Manufacturer, 'oznu')
      .setCharacteristic(Characteristic.Model, 'unifi-occupancy')
      .setCharacteristic(Characteristic.SerialNumber, manifest.version)

    this.occupancyService
      .getCharacteristic(Characteristic.OccupancyDetected)
      .on('get', this.getOccupancyDetected.bind(this))

    return [informationService, this.occupancyService]
  }
}
