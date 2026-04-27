import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { router } from './router/index.js';
import { API_BASE_URL } from './utils/api';
import './style.css';

console.log('API_BASE_URL:', API_BASE_URL);

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount('#app');
