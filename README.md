<p align="center">
  <img src="https://user-images.githubusercontent.com/3979615/62948461-bae3bd00-be27-11e9-81b5-05c65c388a1e.png" height="120"><br>
</p>

# Homebridge UniFi Occupancy Sensor

[![npm](https://img.shields.io/npm/v/homebridge-unifi-occupancy-sensor.svg)](https://www.npmjs.com/package/homebridge-unifi-occupancy-sensor) [![npm](https://img.shields.io/npm/dt/homebridge-unifi-occupancy-sensor.svg)](https://www.npmjs.com/package/homebridge-unifi-occupancy-sensor) [![Donate](https://img.shields.io/badge/donate-paypal-yellowgreen.svg)](https://paypal.me/oznu)

This Homebridge plugin will provide an occupancy sensor accessory to HomeKit based on the devices connected to WiFi access points managed by a [UniFi Controller](https://www.ubnt.com/download/unifi).

The plugin connects to the UniFi Controller event web socket to get instant notifications of connecting devices - which can then be used to trigger HomeKit actions like turning on the lights.

## Requirements

* Node.js v10 or later
* [UniFi Controller](https://www.ubnt.com/download/unifi) v5

## Homebridge Config

The easiest way to configure this plugin is via [Homebridge Config UI X](https://github.com/oznu/homebridge-config-ui-x).

```javascript
"accessories": [
  {
    "accessory": "UniFi Occupancy Sensor",
    "name": "Occupancy Sensor",                    // Required. The name of the sensor.
    "unifi": {
      "controller": "https://demo.ubnt.com:8443",  // Required. The url of the UniFi Controller.
      "username": "superadmin",                    // Required. A read-only user is fine.
      "password": "password",                      // Required.
      "site": "default",                           // Optional. The UniFi site to connect to.
      "secure": false                              // Optional. Set true to validate the SSL certificate.
    },
    "watch": [                                     // Optional - use either watch or monitor.
      "44:00:10:f0:3e:66",                         // An array of device MAC addresses to watch for.
    "monitor": [
      {                                            // Optional - use either watch or monitor. 
        "device": "44:00:10:f0:3e:67",             // An array of device MAC/AP combinations to watch for.
        "ap": "44:00:10:f0:3e:44"
      }
    ],
    "watchGuests": true,                           // Optional. Set false to not monitor guest networks.
    "interval": 1800,                              // Optional. Polling interval used to query Unifi in seconds 
    "debounceTime": 10000,                         // Optional. Discard changes to occupancy that occur within the threshold in seconds
    "mode": "any"                                  // Optional. Set to "any", "all" or "none".
  }
]
```

### Site Name

If you're using a non-default site you will need to specify the name of the site in the plugin config. The internal site name might not match the name you have allocated to the site exactly, you can get the required site name by navigating to the site in the unifi controller then looking at the url bar:

```
https://unifi.com:8443/manage/site/mofkpypu/dashboard
```

In this case the site name is `mofkpypu` and this is the value that should be entered in your Homebridge config.

## License

Copyright (C) 2017-2020 oznu

This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the [GNU General Public License](./LICENSE) for more details.