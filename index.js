'use strict'

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
      if (this.watch.includes(data.user)) {
        return this.checkOccupancy()
      }
    })

    this.unifi.on('disconnected', (data) => {
      if (this.watch.includes(data.user)) {
        return this.checkOccupancy()
      }
    })

    this.occupancyDetected = Characteristic.OccupancyDetected.OCCUPANCY_NOT_DETECTED
    this.checkOccupancy()
    setInterval(this.checkOccupancy.bind(this), 1800 * 1000)
  }

  checkGuest (isGuest) {
    if (this.watchGuests && isGuest) {
      return true
    } else if (!this.watchGuests && isGuest) {
      return false
    } else {
      return true
    }
  }

  checkOccupancy () {
    return this.unifi.getClients()
      .then((res) => {
        let activeDevices = res.data.filter((device) => {
          if (this.watch.includes(device.mac) && this.checkGuest(device.is_guest)) {
            return true
          } else {
            return false
          }
        })

        if (activeDevices.length > 0) {
          this.log(`${activeDevices.length} monitored device(s) found`)
          this.occupancyDetected = Characteristic.OccupancyDetected.OCCUPANCY_DETECTED
          this.setOccupancyDetected(this.occupancyDetected)
        } else {
          this.log(`Zero monitored devices found.`)
          this.occupancyDetected = Characteristic.OccupancyDetected.OCCUPANCY_NOT_DETECTED
          this.setOccupancyDetected(this.occupancyDetected)
        }
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
