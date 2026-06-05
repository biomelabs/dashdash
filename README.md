
`dashdash` is a live data dashboard for Bluetooth Low Energy (BLE) devices advertising the Running Speed and Cadence (RSC) service.

## Getting Started

You can use the deployed version at [shoemath.github.io/dashdash](https://shoemath.github.io/dashdash/), or you can run it locally by cloning the repo and running:

```bash
npm install
npm run dev
```

## Compatibility

### BLE Devices

The dashboard is currently designed to work with BLE devices that advertise the Running Speed and Cadence (RSC) service. Any BLE device not advertising this service (`0x1814`) will get filtered out via the Web Bluetooth API.

There are a couple other relevant services that could be added fairly easily, including the Cycling Speed and Cadence (CSC) service (`0x1816`) and the Fitness Machine Service (`0x1826`), which includes support for treadmills. If you have one of these BLE devices with which to test, and would like to see it added to the dashboard, please submit an issue or a PR!

### Browsers

The dashboard is built using the Web Bluetooth API, which is currently only supported in Chromium-based browsers (e.g. Chrome, Edge, Opera). It is not supported (and likely won't be in the near future) in Firefox or Safari.

## Contributing

Contributions are welcome! Please [open an issue](https://github.com/shoemath/dashdash/issues) to discuss any changes you'd like to make, and submit a PR when you're ready.

## Authors

[Seb Seager](https://github.com/sebseager)

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.