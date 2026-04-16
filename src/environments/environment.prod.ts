import packageInfo from '../../package.json';

export const environment = {
  appVersion: packageInfo.version,
  production: true,
  apiUrl: 'http://192.168.99.106:5000/api' // Link api PC AQUI
};
