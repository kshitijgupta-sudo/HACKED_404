import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// REPLACE WITH YOUR COMPUTER'S IP ADDRESS
// Run 'ipconfig' (Windows) or 'ifconfig' (Mac/Linux) to find it
const LOCAL_IP = '192.168.1.100'; // CHANGE THIS!

const API_BASE_URL = __DEV__
  ? Platform.select({
      android: 'http://10.0.2.2:8000',      // Android emulator
      ios: 'http://localhost:8000',          // iOS emulator
      default: `http://${LOCAL_IP}:8000`,    // Physical devices
    })
  : 'https://your-production-api.com';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default api;