import packageInfo from '../../package.json';

export const environment = {
  appVersion: packageInfo.version,
  production: false,
  apiUrl: 'http://localhost:5000/api', // Link api pc aqui
  uploadUrl: 'http://localhost:5000/api/uploads'
};


