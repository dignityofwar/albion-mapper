import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { router } from './router/index.js';
import './style.css';

console.log('All Envs:', import.meta.env);

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount('#app');
